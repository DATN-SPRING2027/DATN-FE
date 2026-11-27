import { ApiError } from "@/lib/api-client";
import { registerSessionCacheCleanup } from "@/lib/session-cleanup";
import {
  chatApi,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
  type ChatParticipant,
} from "@/lib/queries/chat/useChat";

export type FloatingConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting";

const WS_RATE_LIMIT_COOLDOWN_MS = 30_000;
const WS_POLICY_FAILURE_COOLDOWN_MS = 15_000;
const WS_FAILURE_BACKOFF_STEPS_MS = [5_000, 15_000, 30_000, 60_000] as const;
const WS_FAILURE_MAX_COOLDOWN_MS = 300_000;

const wsCooldownUntilByIdentity = new Map<string, number>();
const wsFailureCountByIdentity = new Map<string, number>();
const wsTicketInFlightByIdentity = new Map<
  string,
  Promise<{ ticket: string; expiresInSeconds: number }>
>();

export function resolveChatRealtimeWsUrl(): string {
  const explicitWsUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim();
  if (explicitWsUrl) {
    return explicitWsUrl;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBaseUrl && /^https?:\/\//i.test(apiBaseUrl)) {
    try {
      const parsed = new URL(apiBaseUrl);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${parsed.host}/internal/chat/ws`;
    } catch {
      // Fall back to current location host below.
    }
  }

  const fallbackProtocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const fallbackHost =
    typeof window !== "undefined" ? window.location.host : "localhost:3000";
  return `${fallbackProtocol}//${fallbackHost}/internal/chat/ws`;
}

export function getChatWsCooldownRemainingMs(identity: string): number {
  const until = wsCooldownUntilByIdentity.get(identity) ?? 0;
  return Math.max(0, until - Date.now());
}

export function recordChatWsConnectionFailure(
  identity: string,
  minCooldownMs?: number,
): number {
  const nextCount = (wsFailureCountByIdentity.get(identity) ?? 0) + 1;
  wsFailureCountByIdentity.set(identity, nextCount);
  const stepIndex = Math.min(nextCount - 1, WS_FAILURE_BACKOFF_STEPS_MS.length - 1);
  const stepped = WS_FAILURE_BACKOFF_STEPS_MS[stepIndex] ?? 60_000;
  const waitMs = Math.min(
    WS_FAILURE_MAX_COOLDOWN_MS,
    Math.max(stepped, minCooldownMs ?? 0),
  );
  wsCooldownUntilByIdentity.set(identity, Date.now() + waitMs);
  return waitMs;
}

export function getChatWsPolicyFailureCooldownMs(): number {
  return WS_POLICY_FAILURE_COOLDOWN_MS;
}

export function resetChatWsCooldown(identity?: string): void {
  if (identity) {
    wsCooldownUntilByIdentity.delete(identity);
    wsFailureCountByIdentity.delete(identity);
  } else {
    wsCooldownUntilByIdentity.clear();
    wsFailureCountByIdentity.clear();
  }
}

registerSessionCacheCleanup(() => {
  resetChatWsCooldown();
});

export function acquireSharedChatWsTicket(identity: string) {
  const existing = wsTicketInFlightByIdentity.get(identity);
  if (existing) return existing;

  const request = chatApi
    .wsTicket()
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 429) {
        const rateLimitCooldown = Math.max(
          WS_RATE_LIMIT_COOLDOWN_MS,
          error.retryAfterMs ?? 0,
        );
        recordChatWsConnectionFailure(identity, rateLimitCooldown);
      } else if (!(error instanceof ApiError && error.status === 401)) {
        recordChatWsConnectionFailure(identity);
      }
      throw error;
    })
    .finally(() => {
      if (wsTicketInFlightByIdentity.get(identity) === request) {
        wsTicketInFlightByIdentity.delete(identity);
      }
    });

  wsTicketInFlightByIdentity.set(identity, request);
  return request;
}

export function getConversationPeer(
  conversation: ChatConversation,
  actorId: string,
): ChatParticipant | undefined {
  if (conversation.type !== "DIRECT") return undefined;
  return conversation.members.find((member) => member.userId !== actorId);
}

export function getConversationDisplayName(
  conversation: ChatConversation | undefined,
  actorId: string,
): string {
  if (!conversation) return "";
  if (conversation.type === "ROOM") return conversation.title ?? "";
  return getConversationPeer(conversation, actorId)?.displayName ?? "";
}

export function getEffectiveConversationUnreadCount(
  conversation: Pick<ChatConversation, "unreadCount" | "markedUnread">,
): number {
  const raw = Math.max(0, conversation.unreadCount ?? 0);
  if (raw > 0) return raw;
  return conversation.markedUnread ? 1 : 0;
}

export function mergeChatMessage(
  page: ChatPage<ChatMessage> | undefined,
  message: ChatMessage,
): ChatPage<ChatMessage> {
  const existing = page?.data ?? [];
  const replaced = existing.some((item) => item.id === message.id)
    ? existing.map((item) => (item.id === message.id ? message : item))
    : [...existing, message];
  return {
    data: replaced.sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id),
    ),
    nextCursor: page?.nextCursor ?? null,
  };
}

export function isChatMessagePacket(value: unknown): value is ChatMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "conversationId" in value &&
    typeof value.conversationId === "string" &&
    "senderId" in value &&
    typeof value.senderId === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "replyTo" in value &&
    (value.replyTo === null ||
      (typeof value.replyTo === "object" &&
        value.replyTo !== null &&
        "id" in value.replyTo &&
        typeof value.replyTo.id === "string" &&
        "senderName" in value.replyTo &&
        typeof value.replyTo.senderName === "string" &&
        "preview" in value.replyTo &&
        typeof value.replyTo.preview === "string" &&
        "deleted" in value.replyTo &&
        typeof value.replyTo.deleted === "boolean"))
  );
}

export function hasParticipantDelivered(
  participant: ChatParticipant,
  message: ChatMessage,
): boolean {
  if (!participant.lastDeliveredMessageId || !participant.lastDeliveredAt) {
    return false;
  }
  const deliveredAt = Date.parse(participant.lastDeliveredAt);
  const messageAt = Date.parse(message.createdAt);
  return (
    deliveredAt > messageAt ||
    (deliveredAt === messageAt &&
      participant.lastDeliveredMessageId.localeCompare(message.id) >= 0)
  );
}

export function formatCompactConversationTime(
  isoString: string | null,
  locale?: string,
): string {
  if (!isoString) return "";
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const resolvedLocale = locale ? [locale] : [];
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString(resolvedLocale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(resolvedLocale, {
    month: "short",
    day: "numeric",
  });
}
