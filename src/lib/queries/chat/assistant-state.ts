import { registerSessionCacheCleanup } from "@/lib/session-cleanup";
import type {
  ChatAssistantJobState,
  ChatAssistantStatus,
  ChatMessage,
  ChatPage,
} from "./useChat";

const ASSISTANT_STATUS_RANK: Readonly<Record<ChatAssistantStatus, number>> = {
  PENDING: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  INSUFFICIENT_EVIDENCE: 3,
  CANCELLED: 3,
  FAILED: 3,
};

export const ASSISTANT_STATE_TOMBSTONE_TTL_MS = 5 * 60 * 1000;
export const ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES = 256;

type AssistantStateTombstoneEntry = Readonly<{
  state: ChatAssistantJobState;
  recordedAt: number;
}>;

type DeletedMessageTombstoneEntry = Readonly<{
  deletedAt: string;
  recordedAt: number;
}>;

const assistantStateTombstones = new Map<
  string,
  AssistantStateTombstoneEntry
>();

const deletedMessageTombstones = new Map<
  string,
  DeletedMessageTombstoneEntry
>();

export function clearAssistantStateTombstones(): void {
  assistantStateTombstones.clear();
  deletedMessageTombstones.clear();
}

registerSessionCacheCleanup(() => {
  clearAssistantStateTombstones();
});

export function getDeletedMessageTombstone(
  messageId: string,
  now = Date.now(),
): string | undefined {
  const entry = deletedMessageTombstones.get(messageId);
  if (!entry) return undefined;
  if (now - entry.recordedAt > ASSISTANT_STATE_TOMBSTONE_TTL_MS) {
    deletedMessageTombstones.delete(messageId);
    return undefined;
  }
  deletedMessageTombstones.delete(messageId);
  deletedMessageTombstones.set(messageId, entry);
  return entry.deletedAt;
}

export function recordDeletedMessageTombstone(
  messageId: string,
  deletedAt: string,
  now = Date.now(),
): string {
  const existing = getDeletedMessageTombstone(messageId, now);
  const resolvedDeletedAt = existing ?? deletedAt;
  assistantStateTombstones.delete(messageId);
  deletedMessageTombstones.delete(messageId);
  deletedMessageTombstones.set(messageId, {
    deletedAt: resolvedDeletedAt,
    recordedAt: now,
  });
  while (
    deletedMessageTombstones.size > ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES
  ) {
    const oldestKey = deletedMessageTombstones.keys().next().value;
    if (oldestKey === undefined) break;
    deletedMessageTombstones.delete(oldestKey);
  }
  return resolvedDeletedAt;
}

function isSyntheticJobId(state: ChatAssistantJobState): boolean {
  return (
    !state.jobId ||
    (state.responseMessageId !== null &&
      state.jobId === state.responseMessageId)
  );
}

export function isSameAssistantState(
  left: ChatAssistantJobState | null | undefined,
  right: ChatAssistantJobState | null | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.jobId === right.jobId &&
    left.status === right.status &&
    left.failureCode === right.failureCode &&
    left.responseMessageId === right.responseMessageId &&
    left.updatedAt === right.updatedAt
  );
}

export function mergeAssistantState(
  current: ChatAssistantJobState | null | undefined,
  incoming: ChatAssistantJobState | null | undefined,
): ChatAssistantJobState | null | undefined {
  if (!incoming) return current ?? incoming;
  if (!current) return incoming;
  if (isSameAssistantState(current, incoming)) return current;

  const currentRank = ASSISTANT_STATUS_RANK[current.status] ?? 0;
  const incomingRank = ASSISTANT_STATUS_RANK[incoming.status] ?? 0;
  const currentTs = Date.parse(current.updatedAt);
  const incomingTs = Date.parse(incoming.updatedAt);
  const hasComparableTs =
    !Number.isNaN(currentTs) && !Number.isNaN(incomingTs);

  const currentSynthetic = isSyntheticJobId(current);
  const incomingSynthetic = isSyntheticJobId(incoming);
  const hasDistinctRealJobs =
    !currentSynthetic &&
    !incomingSynthetic &&
    current.jobId !== incoming.jobId;

  if (hasDistinctRealJobs) {
    if (hasComparableTs) {
      if (incomingTs > currentTs) return incoming;
      if (incomingTs < currentTs) return current;
    }
    return incomingRank > currentRank ? incoming : current;
  }

  const resolvedJobId = !incomingSynthetic
    ? incoming.jobId
    : !currentSynthetic
      ? current.jobId
      : incoming.jobId || current.jobId;

  if (incomingRank < currentRank) {
    if (current.jobId === resolvedJobId) return current;
    return { ...current, jobId: resolvedJobId };
  }

  if (incomingRank > currentRank) {
    if (incoming.jobId === resolvedJobId) return incoming;
    return { ...incoming, jobId: resolvedJobId };
  }

  if (hasComparableTs) {
    if (incomingTs < currentTs) {
      if (current.jobId === resolvedJobId) return current;
      return { ...current, jobId: resolvedJobId };
    }
    if (incomingTs > currentTs) {
      return {
        ...incoming,
        jobId: resolvedJobId,
        responseMessageId:
          incoming.responseMessageId ?? current.responseMessageId,
      };
    }
  }

  const resolvedResponseId =
    incoming.responseMessageId ?? current.responseMessageId;
  if (
    resolvedJobId === current.jobId &&
    resolvedResponseId === current.responseMessageId
  ) {
    return current;
  }
  return {
    ...current,
    jobId: resolvedJobId,
    responseMessageId: resolvedResponseId,
  };
}

export function getAssistantStateTombstone(
  triggerMessageId: string,
  now = Date.now(),
): ChatAssistantJobState | undefined {
  const entry = assistantStateTombstones.get(triggerMessageId);
  if (!entry) return undefined;
  if (now - entry.recordedAt > ASSISTANT_STATE_TOMBSTONE_TTL_MS) {
    assistantStateTombstones.delete(triggerMessageId);
    return undefined;
  }
  assistantStateTombstones.delete(triggerMessageId);
  assistantStateTombstones.set(triggerMessageId, entry);
  return entry.state;
}

export function recordAssistantStateTombstone(
  triggerMessageId: string,
  incoming: ChatAssistantJobState,
  now = Date.now(),
): ChatAssistantJobState {
  const existing = getAssistantStateTombstone(triggerMessageId, now);
  const merged = mergeAssistantState(existing, incoming) ?? incoming;
  assistantStateTombstones.delete(triggerMessageId);
  assistantStateTombstones.set(triggerMessageId, {
    state: merged,
    recordedAt: now,
  });
  while (
    assistantStateTombstones.size > ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES
  ) {
    const oldestKey = assistantStateTombstones.keys().next().value;
    if (oldestKey === undefined) break;
    assistantStateTombstones.delete(oldestKey);
  }
  return merged;
}

function isExistingEditStrictlyNewer(
  existing: ChatMessage,
  incoming: ChatMessage,
): boolean {
  const existingVersion = existing.contentVersion;
  const incomingVersion = incoming.contentVersion;

  if (
    typeof existingVersion === "number" &&
    typeof incomingVersion === "number"
  ) {
    if (existingVersion !== incomingVersion) {
      return existingVersion > incomingVersion;
    }
  } else if (
    typeof existingVersion === "number" ||
    typeof incomingVersion === "number"
  ) {
    if (existing.editedAt && !incoming.editedAt) {
      return true;
    }
    if (!existing.editedAt && incoming.editedAt) {
      return false;
    }
    const resolvedExistingVersion = existingVersion ?? 1;
    const resolvedIncomingVersion = incomingVersion ?? 1;
    if (resolvedExistingVersion !== resolvedIncomingVersion) {
      return resolvedExistingVersion > resolvedIncomingVersion;
    }
  }

  if (existing.editedAt && !incoming.editedAt) {
    return true;
  }
  if (!existing.editedAt || !incoming.editedAt) {
    return false;
  }
  const existingEditedTs = Date.parse(existing.editedAt);
  const incomingEditedTs = Date.parse(incoming.editedAt);
  if (!Number.isNaN(existingEditedTs) && !Number.isNaN(incomingEditedTs)) {
    return existingEditedTs > incomingEditedTs;
  }
  return false;
}

function redactDeletedMessage(
  base: ChatMessage,
  deletedAt: string,
): ChatMessage {
  const alreadyRedacted =
    base.deletedAt === deletedAt &&
    base.content === "" &&
    base.attachments.length === 0 &&
    base.reactions.length === 0 &&
    base.assistantState === undefined &&
    (base.mentionUserIds === undefined || base.mentionUserIds.length === 0) &&
    !base.isPinned &&
    !base.forwardedFrom;
  if (alreadyRedacted) {
    return base;
  }
  return {
    ...base,
    content: "",
    deletedAt,
    attachments: [],
    reactions: [],
    ...(base.mentionUserIds !== undefined ? { mentionUserIds: [] } : {}),
    ...(base.isPinned !== undefined ? { isPinned: false } : {}),
    ...(base.forwardedFrom !== undefined ? { forwardedFrom: null } : {}),
    assistantState: undefined,
  };
}

export function mergeMessage(
  existing: ChatMessage | undefined,
  incoming: ChatMessage,
): ChatMessage {
  const deletedTombstone = getDeletedMessageTombstone(incoming.id);
  const effectiveDeletedAt =
    existing?.deletedAt ?? incoming.deletedAt ?? deletedTombstone ?? null;

  if (effectiveDeletedAt) {
    const recordedDeletedAt = recordDeletedMessageTombstone(
      incoming.id,
      effectiveDeletedAt,
    );
    const base =
      existing?.deletedAt && !incoming.deletedAt
        ? { ...incoming, ...existing }
        : existing && !incoming.deletedAt
          ? { ...incoming, ...existing }
          : incoming;
    return redactDeletedMessage(base, recordedDeletedAt);
  }

  let mergedBase: ChatMessage = incoming;
  if (existing && isExistingEditStrictlyNewer(existing, incoming)) {
    const resolvedContentVersion =
      existing.contentVersion !== undefined
        ? existing.contentVersion
        : incoming.contentVersion;
    const resolvedIsEdited =
      existing.isEdited !== undefined
        ? existing.isEdited
        : incoming.isEdited !== undefined
          ? Boolean(existing.editedAt)
          : undefined;
    mergedBase = {
      ...incoming,
      content: existing.content,
      editedAt: existing.editedAt,
      ...(resolvedContentVersion !== undefined
        ? { contentVersion: resolvedContentVersion }
        : {}),
      ...(resolvedIsEdited !== undefined
        ? { isEdited: resolvedIsEdited }
        : {}),
      ...(existing.mentionUserIds !== undefined
        ? { mentionUserIds: existing.mentionUserIds }
        : {}),
    };
  }

  const tombstone = getAssistantStateTombstone(mergedBase.id);
  if (!existing?.assistantState && !tombstone && !incoming.assistantState) {
    return mergedBase;
  }
  const baseline = mergeAssistantState(existing?.assistantState, tombstone);
  const merged = mergeAssistantState(baseline, incoming.assistantState);
  if (
    merged &&
    (tombstone || (ASSISTANT_STATUS_RANK[merged.status] ?? 0) >= 2)
  ) {
    recordAssistantStateTombstone(mergedBase.id, merged);
  }
  if (isSameAssistantState(mergedBase.assistantState, merged)) {
    return mergedBase;
  }
  return {
    ...mergedBase,
    assistantState: merged ?? null,
  };
}

export function reconcileMessageAssistantState(
  incoming: ChatMessage,
  existing?: ChatMessage,
): ChatMessage {
  return mergeMessage(existing, incoming);
}

export function reconcileMessagePageAssistantState(
  fetched: ChatPage<ChatMessage>,
  cached?: ChatPage<ChatMessage>,
): ChatPage<ChatMessage> {
  const cachedById = cached?.data.length
    ? new Map(cached.data.map((item) => [item.id, item]))
    : undefined;
  let changed = false;
  const data = fetched.data.map((message) => {
    const reconciled = mergeMessage(cachedById?.get(message.id), message);
    if (reconciled !== message) {
      changed = true;
    }
    return reconciled;
  });
  return changed ? { ...fetched, data } : fetched;
}
