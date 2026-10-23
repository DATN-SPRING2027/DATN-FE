import { afterEach, describe, expect, it, vi } from "vitest";
import { chatApi, type ChatMessage } from "./useChat";

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
});
