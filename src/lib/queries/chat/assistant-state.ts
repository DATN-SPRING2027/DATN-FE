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

const assistantStateTombstones = new Map<
  string,
  AssistantStateTombstoneEntry
>();

export function clearAssistantStateTombstones(): void {
  assistantStateTombstones.clear();
}

registerSessionCacheCleanup(() => {
  clearAssistantStateTombstones();
});

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

export function reconcileMessageAssistantState(
  incoming: ChatMessage,
  existing?: ChatMessage,
): ChatMessage {
  const tombstone = getAssistantStateTombstone(incoming.id);
  if (!existing?.assistantState && !tombstone && !incoming.assistantState) {
    return incoming;
  }
  const baseline = mergeAssistantState(existing?.assistantState, tombstone);
  const merged = mergeAssistantState(baseline, incoming.assistantState);
  if (
    merged &&
    (tombstone || (ASSISTANT_STATUS_RANK[merged.status] ?? 0) >= 2)
  ) {
    recordAssistantStateTombstone(incoming.id, merged);
  }
  if (isSameAssistantState(incoming.assistantState, merged)) {
    return incoming;
  }
  return {
    ...incoming,
    assistantState: merged ?? null,
  };
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
    const reconciled = reconcileMessageAssistantState(
      message,
      cachedById?.get(message.id),
    );
    if (reconciled !== message) {
      changed = true;
    }
    return reconciled;
  });
  return changed ? { ...fetched, data } : fetched;
}
