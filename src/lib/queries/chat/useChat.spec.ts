import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  acquireSharedChatWsTicket,
  getChatWsCooldownRemainingMs,
  getChatWsPolicyFailureCooldownMs,
  recordChatWsConnectionFailure,
  resetChatWsCooldown,
} from "@/components/chat/floating/chat-shared-helpers";
import {
  chatApi,
  normalizeChatAttachmentUrl,
  type ChatMessage,
} from "./useChat";

const message = (id: string, content = id) =>
  ({
    id,
    content,
    createdAt: `2026-10-21T10:00:${id.padStart(2, "0")}.000Z`,
  }) as ChatMessage;

afterEach(() => vi.restoreAllMocks());

describe("chat history recovery", () => {
  it("loads every missed page through the cached boundary and replaces offline edits", async () => {
    const signal = new AbortController().signal;
    vi.spyOn(chatApi, "messages").mockResolvedValue({
      data: [message("5"), message("6")],
      nextCursor: "p2",
    });
    const older = vi
      .spyOn(chatApi, "olderMessages")
      .mockResolvedValueOnce({
        data: [message("3"), message("4")],
        nextCursor: "p3",
      })
      .mockResolvedValueOnce({
        data: [message("1", "edited while offline"), message("2")],
        nextCursor: "p4",
      });
    const result = await chatApi.syncMessages(
      "conversation",
      [message("1", "old content"), message("2")],
      signal,
    );
    expect(result.data.map((item) => item.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(result.data[0].content).toBe("edited while offline");
    expect(result.nextCursor).toBe("p4");
    expect(older).toHaveBeenNthCalledWith(1, "conversation", "p2", signal);
    expect(older).toHaveBeenNthCalledWith(2, "conversation", "p3", signal);
  });

  it("fetches just the latest page on first open and propagates failed recovery", async () => {
    const latest = { data: [message("1")], nextCursor: "p2" };
    const fetch = vi.spyOn(chatApi, "messages").mockResolvedValue(latest);
    const older = vi.spyOn(chatApi, "olderMessages");
    expect(await chatApi.syncMessages("conversation")).toEqual(latest);
    expect(older).not.toHaveBeenCalled();
    fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(chatApi.syncMessages("conversation")).rejects.toThrow(
      "offline",
    );
  });

  it("rewrites relative /api/v1/ attachment URLs to /api/backend/ while leaving external URLs intact", () => {
    expect(
      normalizeChatAttachmentUrl(
        "/api/v1/chat/conversations/c1/attachments/a1/content",
      ),
    ).toBe("/api/backend/chat/conversations/c1/attachments/a1/content");
    expect(normalizeChatAttachmentUrl("https://cdn.example.com/file.png")).toBe(
      "https://cdn.example.com/file.png",
    );
    expect(normalizeChatAttachmentUrl("blob:mock-url")).toBe("blob:mock-url");
  });

  it("applies stepped WS backoff (5s->15s->30s->60s) and honors 429 Retry-After cooldown", async () => {
    resetChatWsCooldown();
    expect(recordChatWsConnectionFailure("u1:o1")).toBe(5_000);
    expect(recordChatWsConnectionFailure("u1:o1")).toBe(15_000);
    expect(recordChatWsConnectionFailure("u1:o1")).toBe(30_000);
    expect(recordChatWsConnectionFailure("u1:o1")).toBe(60_000);
    expect(recordChatWsConnectionFailure("u1:o1")).toBe(60_000);

    resetChatWsCooldown("u1:o1");
    expect(
      recordChatWsConnectionFailure("u1:o1", getChatWsPolicyFailureCooldownMs()),
    ).toBe(15_000);

    resetChatWsCooldown("u1:o1");
    vi.spyOn(chatApi, "wsTicket").mockRejectedValueOnce(
      new ApiError(429, "RATE_LIMITED", "Too many requests", undefined, false, undefined, 45_000),
    );
    await expect(acquireSharedChatWsTicket("u1:o1")).rejects.toMatchObject({
      status: 429,
    });
    expect(getChatWsCooldownRemainingMs("u1:o1")).toBeGreaterThanOrEqual(40_000);
    resetChatWsCooldown();
  });
});
