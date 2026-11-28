import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import {
  ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES,
  ASSISTANT_STATE_TOMBSTONE_TTL_MS,
  clearAssistantStateTombstones,
  getAssistantStateTombstone,
  isSameAssistantState,
  mergeAssistantState,
  reconcileMessageAssistantState,
  reconcileMessagePageAssistantState,
  recordAssistantStateTombstone,
} from "@/lib/queries/chat/assistant-state";
import {
  chatKeys,
  CONTINUUM_AI_HANDLE,
  isAssistantMessage,
  type ChatAssistantFailureCode,
  type ChatAssistantJobState,
  type ChatAssistantMentionInput,
  type ChatAssistantStatus,
  type ChatAssistantStatusEvent,
  type ChatCapabilities,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
} from "@/lib/queries/chat/useChat";
import { foldSearchText, matchesNamePrefixes } from "./search-text";

export {
  ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES,
  ASSISTANT_STATE_TOMBSTONE_TTL_MS,
  clearAssistantStateTombstones,
  getAssistantStateTombstone,
  mergeAssistantState,
  reconcileMessageAssistantState,
  reconcileMessagePageAssistantState,
  recordAssistantStateTombstone,
};

const VALID_ASSISTANT_STATUSES = new Set<ChatAssistantStatus>([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "INSUFFICIENT_EVIDENCE",
  "CANCELLED",
  "FAILED",
]);

const VALID_FAILURE_CODES = new Set<ChatAssistantFailureCode>([
  "SOURCE_CHANGED",
  "TRIGGER_DELETED",
  "ACCESS_REVOKED",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  "INVALID_MODEL_OUTPUT",
]);

const ASSISTANT_MENTION_TOKEN_RE = /(?:^|\s)@continuumAI(?=$|[\s.,!?;:)\]])/u;
const ASSISTANT_MENTION_STRIP_RE = /(?:^|\s)@continuumAI(?=$|[\s.,!?;:)\]])/gu;

export const MAX_ASSISTANT_QUERY_LENGTH = 2000;

export function hasAssistantMentionToken(content: string): boolean {
  return ASSISTANT_MENTION_TOKEN_RE.test(content);
}

export function extractAssistantMentionQuery(content: string): string {
  return content
    .replace(ASSISTANT_MENTION_STRIP_RE, " ")
    .replace(/^[\s,:;-]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesAssistantMentionTerm(term: string): boolean {
  if (term === "") return true;
  if (/\s/.test(term)) return false;
  const folded = foldSearchText(term);
  return (
    "continuumai".startsWith(folded) ||
    "ai".startsWith(folded) ||
    matchesNamePrefixes("Continuum AI", term)
  );
}

export function resolveBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.trim().length > 0 && tz.length <= 64) {
      return tz;
    }
  } catch {
    // Fall back to canonical default timezone.
  }
  return "Asia/Ho_Chi_Minh";
}

export function buildAssistantMentionInput(
  query: string,
): ChatAssistantMentionInput {
  return {
    handle: CONTINUUM_AI_HANDLE,
    query: query.trim(),
    timezone: resolveBrowserTimezone(),
  };
}

export function isDmAssistantEnabledForConversation(
  conversation: Pick<ChatConversation, "type" | "capabilities"> | undefined,
  fallbackCapabilities?: ChatCapabilities,
  preferredCapabilities?: ChatCapabilities,
): boolean {
  if (!conversation || conversation.type !== "DIRECT") {
    return false;
  }
  return Boolean(
    preferredCapabilities?.dmAssistantEnabled ??
      conversation.capabilities?.dmAssistantEnabled ??
      fallbackCapabilities?.dmAssistantEnabled,
  );
}

export function getAssistantRetryPayload(triggerMessage: ChatMessage): {
  content: string;
  assistantMention: ChatAssistantMentionInput;
} | null {
  const query =
    triggerMessage.assistantMention?.query?.trim() ||
    extractAssistantMentionQuery(triggerMessage.content);
  if (!query || query.length > MAX_ASSISTANT_QUERY_LENGTH) {
    return null;
  }
  return {
    content: `@${CONTINUUM_AI_HANDLE} ${query}`,
    assistantMention: buildAssistantMentionInput(query),
  };
}

export function buildAssistantRetryFingerprint(
  triggerMessage: Pick<
    ChatMessage,
    "conversationId" | "replyToMessageId" | "assistantState"
  >,
  payload: Readonly<{
    content: string;
    assistantMention: ChatAssistantMentionInput;
  }>,
): string {
  return JSON.stringify([
    triggerMessage.conversationId,
    triggerMessage.replyToMessageId ?? null,
    triggerMessage.assistantState?.jobId ?? null,
    payload.content,
    payload.assistantMention.handle,
    payload.assistantMention.query ?? "",
    payload.assistantMention.timezone ?? "",
  ]);
}

export function resolveChatSendErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "CHAT_ASSISTANT_RATE_LIMITED":
        return "assistantErrorRateLimited";
      case "CHAT_AI_NOT_ENABLED":
        return "assistantErrorDisabled";
      case "CHAT_ASSISTANT_QUERY_INVALID":
        return "assistantQueryEmpty";
      case "CHAT_ASSISTANT_DIRECT_ONLY":
        return "assistantErrorDirectOnly";
      case "CHAT_DIRECT_UNAVAILABLE":
        return "assistantErrorBlocked";
      default:
        break;
    }
    if (error.status === 429) {
      return "assistantErrorRateLimited";
    }
  }
  return "sendError";
}

export function isAssistantStatusEvent(
  value: unknown,
): value is ChatAssistantStatusEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.conversationId === "string" &&
    typeof candidate.triggerMessageId === "string" &&
    typeof candidate.jobId === "string" &&
    typeof candidate.status === "string" &&
    VALID_ASSISTANT_STATUSES.has(candidate.status as ChatAssistantStatus) &&
    (candidate.failureCode === null ||
      (typeof candidate.failureCode === "string" &&
        VALID_FAILURE_CODES.has(
          candidate.failureCode as ChatAssistantFailureCode,
        ))) &&
    (candidate.responseMessageId === null ||
      typeof candidate.responseMessageId === "string") &&
    typeof candidate.updatedAt === "string"
  );
}

export function applyAssistantStatusToMessagePage(
  page: ChatPage<ChatMessage> | undefined,
  event: ChatAssistantStatusEvent,
): ChatPage<ChatMessage> | undefined {
  if (!page) return page;
  let changed = false;
  const nextState: ChatAssistantJobState = {
    jobId: event.jobId,
    status: event.status,
    failureCode: event.failureCode,
    responseMessageId: event.responseMessageId,
    updatedAt: event.updatedAt,
  };
  const data = page.data.map((message) => {
    if (message.id !== event.triggerMessageId) return message;
    const merged = mergeAssistantState(message.assistantState, nextState);
    if (!merged || isSameAssistantState(message.assistantState, merged)) {
      return message;
    }
    changed = true;
    return {
      ...message,
      assistantState: merged,
    };
  });
  return changed ? { ...page, data } : page;
}

export function syncTriggerStateFromAssistantMessage(
  page: ChatPage<ChatMessage> | undefined,
  incoming: ChatMessage,
): ChatPage<ChatMessage> | undefined {
  if (!isAssistantMessage(incoming) || !incoming.triggerMessageId) {
    return page;
  }
  const resolvedStatus: ChatAssistantStatus =
    incoming.assistantStatus === "INSUFFICIENT_EVIDENCE"
      ? "INSUFFICIENT_EVIDENCE"
      : "COMPLETED";
  const existingTrigger = page?.data.find(
    (item) => item.id === incoming.triggerMessageId,
  );
  const tracked = getAssistantStateTombstone(incoming.triggerMessageId);
  const incomingState: ChatAssistantJobState = {
    jobId:
      existingTrigger?.assistantState?.jobId ?? tracked?.jobId ?? incoming.id,
    status: resolvedStatus,
    failureCode: null,
    responseMessageId: incoming.id,
    updatedAt: incoming.createdAt,
  };
  const effectiveState = recordAssistantStateTombstone(
    incoming.triggerMessageId,
    incomingState,
  );
  if (!page) {
    return page;
  }
  let changed = false;
  const data = page.data.map((item) => {
    if (item.id !== incoming.triggerMessageId) return item;
    const merged = mergeAssistantState(item.assistantState, effectiveState);
    if (!merged || isSameAssistantState(item.assistantState, merged)) {
      return item;
    }
    changed = true;
    return {
      ...item,
      assistantState: merged,
    };
  });
  return changed ? { ...page, data } : page;
}

export function applyAssistantStatusToCaches(
  queryClient: QueryClient,
  organizationId: string,
  event: ChatAssistantStatusEvent,
): void {
  const incomingState: ChatAssistantJobState = {
    jobId: event.jobId,
    status: event.status,
    failureCode: event.failureCode,
    responseMessageId: event.responseMessageId,
    updatedAt: event.updatedAt,
  };
  const effectiveState = recordAssistantStateTombstone(
    event.triggerMessageId,
    incomingState,
  );
  const effectiveEvent: ChatAssistantStatusEvent = {
    ...event,
    jobId: effectiveState.jobId,
    status: effectiveState.status,
    failureCode: effectiveState.failureCode,
    responseMessageId: effectiveState.responseMessageId,
    updatedAt: effectiveState.updatedAt,
  };

  const baseKey = chatKeys.messages(organizationId, event.conversationId);
  queryClient.setQueriesData<ChatPage<ChatMessage>>(
    { queryKey: baseKey },
    (page) => applyAssistantStatusToMessagePage(page, effectiveEvent),
  );

  if (
    (event.status === "COMPLETED" ||
      event.status === "INSUFFICIENT_EVIDENCE") &&
    (effectiveEvent.status === "COMPLETED" ||
      effectiveEvent.status === "INSUFFICIENT_EVIDENCE")
  ) {
    const responseId =
      effectiveEvent.responseMessageId ?? event.responseMessageId;
    const regularPage =
      queryClient.getQueryData<ChatPage<ChatMessage>>(baseKey);
    const hasResponse =
      Boolean(responseId) &&
      Boolean(regularPage?.data.some((item) => item.id === responseId));
    if (!hasResponse) {
      void queryClient.invalidateQueries({ queryKey: baseKey });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
    }
  }
}

export function invalidateConversationMessageQueries(
  queryClient: QueryClient,
  organizationId: string,
  conversationId: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: chatKeys.messages(organizationId, conversationId),
    }),
    queryClient.invalidateQueries({
      queryKey: chatKeys.search(organizationId, conversationId),
    }),
    queryClient.invalidateQueries({
      queryKey: chatKeys.toolsSearch(organizationId),
      predicate: (query) => {
        const queryCid = query.queryKey[4];
        const onlyCurrent = query.queryKey[10];
        return (
          queryCid === undefined ||
          queryCid === "" ||
          queryCid === conversationId ||
          onlyCurrent === false
        );
      },
    }),
    queryClient.invalidateQueries({
      queryKey: chatKeys.toolsLibrary(organizationId, conversationId),
    }),
  ]).then(() => undefined);
}
