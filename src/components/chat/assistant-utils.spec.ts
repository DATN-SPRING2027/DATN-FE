import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chatKeys,
  type ChatAssistantJobState,
  type ChatMessage,
} from "@/lib/queries/chat/useChat";
import {
  ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES,
  ASSISTANT_STATE_TOMBSTONE_TTL_MS,
  clearAssistantStateTombstones,
  getAssistantStateTombstone,
  invalidateConversationMessageQueries,
  isDmAssistantEnabledForConversation,
  mergeAssistantState,
  reconcileMessageAssistantState,
  recordAssistantStateTombstone,
} from "./assistant-utils";

afterEach(() => {
  clearAssistantStateTombstones();
  vi.restoreAllMocks();
});

const makeState = (
  overrides: Partial<ChatAssistantJobState>,
): ChatAssistantJobState => ({
  jobId: "job-1",
  status: "PENDING",
  failureCode: null,
  responseMessageId: null,
  updatedAt: "2026-11-28T08:00:00.000Z",
  ...overrides,
});

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "trigger-1",
  conversationId: "dm-1",
  senderId: "actor",
  senderName: "Actor",
  senderAvatarUrl: null,
  content: "@continuumAI summary",
  createdAt: "2026-11-28T08:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyToMessageId: null,
  replyTo: null,
  attachments: [],
  reactions: [],
  ...overrides,
});

describe("mergeAssistantState", () => {
  it("advances strictly monotonically and never regresses same-job or missing-job states", () => {
    const pending = makeState({
      status: "PENDING",
      updatedAt: "2026-11-28T08:00:01.000Z",
    });
    const processing = makeState({
      status: "PROCESSING",
      updatedAt: "2026-11-28T08:00:02.000Z",
    });
    const completed = makeState({
      status: "COMPLETED",
      responseMessageId: "ai-reply-1",
      updatedAt: "2026-11-28T08:00:05.000Z",
    });
    const latePending = makeState({
      status: "PENDING",
      updatedAt: "2026-11-28T08:00:09.000Z",
    });
    const missingJobPending = makeState({
      jobId: "",
      status: "PENDING",
      updatedAt: "2026-11-28T08:00:10.000Z",
    });

    expect(mergeAssistantState(pending, processing)).toEqual(processing);
    expect(mergeAssistantState(processing, pending)).toEqual(processing);
    expect(mergeAssistantState(processing, completed)).toEqual(completed);
    expect(mergeAssistantState(completed, latePending)).toEqual(completed);
    expect(mergeAssistantState(completed, processing)).toEqual(completed);
    expect(mergeAssistantState(completed, missingJobPending)).toEqual(completed);
  });

  it("allows progression to a strictly newer jobId while ignoring stale older jobs", () => {
    const oldFailed = makeState({
      jobId: "job-1",
      status: "FAILED",
      failureCode: "TIMEOUT",
      updatedAt: "2026-11-28T08:00:05.000Z",
    });
    const newerRetryPending = makeState({
      jobId: "job-2",
      status: "PENDING",
      updatedAt: "2026-11-28T08:01:00.000Z",
    });
    const newerProcessing = makeState({
      jobId: "job-2",
      status: "PROCESSING",
      updatedAt: "2026-11-28T08:01:02.000Z",
    });

    expect(mergeAssistantState(oldFailed, newerRetryPending)).toEqual(
      newerRetryPending,
    );
    expect(mergeAssistantState(newerProcessing, oldFailed)).toEqual(
      newerProcessing,
    );
  });

  it("preserves terminal state synthesized from message.created when late POST PENDING brings real jobId", () => {
    const syntheticCompleted = makeState({
      jobId: "ai-reply-1",
      status: "COMPLETED",
      responseMessageId: "ai-reply-1",
      updatedAt: "2026-11-28T08:00:05.000Z",
    });
    const latePostPending = makeState({
      jobId: "job-real-1",
      status: "PENDING",
      updatedAt: "2026-11-28T08:00:01.000Z",
    });

    expect(mergeAssistantState(syntheticCompleted, latePostPending)).toEqual({
      jobId: "job-real-1",
      status: "COMPLETED",
      failureCode: null,
      responseMessageId: "ai-reply-1",
      updatedAt: "2026-11-28T08:00:05.000Z",
    });
  });
});

describe("assistant state tombstone tracker", () => {
  it("guards late POST trigger message with recorded terminal tombstone and honors TTL & LRU cap", () => {
    const cancelled = makeState({
      jobId: "job-cancelled",
      status: "CANCELLED",
      failureCode: "SOURCE_CHANGED",
      updatedAt: "2026-11-28T08:00:04.000Z",
    });
    recordAssistantStateTombstone("trigger-race", cancelled, 1_000);

    expect(getAssistantStateTombstone("trigger-race", 1_000)).toEqual(cancelled);
    expect(
      getAssistantStateTombstone(
        "trigger-race",
        1_000 + ASSISTANT_STATE_TOMBSTONE_TTL_MS + 1,
      ),
    ).toBeUndefined();

    recordAssistantStateTombstone("trigger-race-2", cancelled);
    const latePostMessage = makeMessage({
      id: "trigger-race-2",
      assistantState: makeState({
        jobId: "job-cancelled",
        status: "PENDING",
        updatedAt: "2026-11-28T08:00:01.000Z",
      }),
    });
    const reconciled = reconcileMessageAssistantState(latePostMessage);
    expect(reconciled.assistantState).toEqual(cancelled);

    clearAssistantStateTombstones();
    for (let i = 0; i <= ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES + 5; i += 1) {
      recordAssistantStateTombstone(
        `trigger-cap-${i}`,
        makeState({ jobId: `job-${i}`, status: "COMPLETED" }),
        10_000 + i,
      );
    }
    expect(
      getAssistantStateTombstone("trigger-cap-0", 20_000),
    ).toBeUndefined();
    expect(
      getAssistantStateTombstone(
        `trigger-cap-${ASSISTANT_STATE_TOMBSTONE_MAX_ENTRIES + 5}`,
        20_000,
      )?.status,
    ).toBe("COMPLETED");
  });
});

describe("isDmAssistantEnabledForConversation", () => {
  it("prefers fresh detail capabilities over stale list item and fallback capabilities", () => {
    const staleListConv = {
      type: "DIRECT" as const,
      capabilities: { dmAssistantEnabled: true },
    };
    expect(
      isDmAssistantEnabledForConversation(
        staleListConv,
        { dmAssistantEnabled: true },
        { dmAssistantEnabled: false },
      ),
    ).toBe(false);
    expect(
      isDmAssistantEnabledForConversation(
        staleListConv,
        { dmAssistantEnabled: false },
        undefined,
      ),
    ).toBe(true);
    expect(
      isDmAssistantEnabledForConversation(
        { type: "DIRECT", capabilities: undefined },
        { dmAssistantEnabled: true },
        undefined,
      ),
    ).toBe(true);
  });
});

describe("invalidateConversationMessageQueries", () => {
  it("invalidates conversation messages, inline search, relevant ChatTools search, and pinned library while leaving unrelated conversations untouched", async () => {
    const client = new QueryClient();
    const orgId = "org-1";
    const convId = "dm-1";
    const otherConvId = "dm-2";

    const scopedSearchKey = [
      ...chatKeys.toolsSearch(orgId),
      convId,
      "deadline",
      "",
      "",
      "",
      "",
      true,
      "IMAGE",
    ] as const;
    const globalSearchKey = [
      ...chatKeys.toolsSearch(orgId),
      "",
      "deadline",
      "",
      "",
      "",
      "",
      false,
      "IMAGE",
    ] as const;
    const crossConvSearchKey = [
      ...chatKeys.toolsSearch(orgId),
      otherConvId,
      "deadline",
      "",
      "",
      "",
      "",
      false,
      "IMAGE",
    ] as const;
    const unrelatedScopedSearchKey = [
      ...chatKeys.toolsSearch(orgId),
      otherConvId,
      "deadline",
      "",
      "",
      "",
      "",
      true,
      "IMAGE",
    ] as const;
    const pinnedLibraryKey = [
      ...chatKeys.toolsLibrary(orgId, convId),
      "",
      "",
      "",
      "",
      "",
      true,
      "PIN",
    ] as const;
    const unrelatedPinnedKey = [
      ...chatKeys.toolsLibrary(orgId, otherConvId),
      "",
      "",
      "",
      "",
      "",
      true,
      "PIN",
    ] as const;

    const allKeys = [
      chatKeys.messages(orgId, convId),
      chatKeys.search(orgId, convId, "deadline"),
      scopedSearchKey,
      globalSearchKey,
      crossConvSearchKey,
      unrelatedScopedSearchKey,
      pinnedLibraryKey,
      unrelatedPinnedKey,
    ];
    for (const key of allKeys) {
      client.setQueryData(key, { data: [], nextCursor: null });
    }

    await invalidateConversationMessageQueries(client, orgId, convId);

    expect(
      client.getQueryState(chatKeys.messages(orgId, convId))?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(chatKeys.search(orgId, convId, "deadline"))
        ?.isInvalidated,
    ).toBe(true);
    expect(client.getQueryState(scopedSearchKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(globalSearchKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(crossConvSearchKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(pinnedLibraryKey)?.isInvalidated).toBe(true);

    expect(client.getQueryState(unrelatedScopedSearchKey)?.isInvalidated).toBe(
      false,
    );
    expect(client.getQueryState(unrelatedPinnedKey)?.isInvalidated).toBe(false);
    client.clear();
  });
});
