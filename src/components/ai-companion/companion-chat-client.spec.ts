import { beforeEach, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { streamAiChatAsk } from "@/lib/queries/ai-chat/ai-chat-stream";
import { CompanionChatClient } from "./companion-chat-client";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/lib/queries/ai-chat/ai-chat-stream", () => ({
  aiChatCsrfHeaders: () => ({}),
  streamAiChatAsk: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(apiClient).mockReset();
  vi.mocked(streamAiChatAsk).mockReset();
  vi.mocked(apiClient).mockImplementation(async (path) =>
    path === "/auth/me"
      ? { id: "user-1", organizationId: "org-1" }
      : ({ id: "thread-1" } as never),
  );
  vi.mocked(streamAiChatAsk).mockImplementation(async ({ query, onEvent }) => {
    onEvent({ event: "delta", data: { text: `Answer: ${query}` } });
    onEvent({
      event: "completed",
      data: {
        content: `Answer: ${query}`,
        messageId: "message-1",
        answerStatus: "answered",
        citations: [],
        sessionCitations: [],
        retrievalSteps: [],
      },
    });
  });
});
it("sends each distinct question to real AI and keeps conversation continuity in the same project", async () => {
  const client = new CompanionChatClient();
  const signal = new AbortController().signal;
  const onText = vi.fn();
  expect((await client.ask("project-1", "hello", signal, onText)).content).toBe(
    "Answer: hello",
  );
  expect(
    (await client.ask("project-1", "explain this task", signal, onText))
      .content,
  ).toBe("Answer: explain this task");
  expect(
    vi
      .mocked(apiClient)
      .mock.calls.filter(([path]) => path.endsWith("/threads")),
  ).toHaveLength(1);
  expect(streamAiChatAsk).toHaveBeenLastCalledWith(
    expect.objectContaining({
      query: "explain this task",
      threadId: "thread-1",
      signal,
    }),
  );
});
it("isolates thread context between projects", async () => {
  const client = new CompanionChatClient();
  const signal = new AbortController().signal;
  await client.ask("project-1", "first", signal, vi.fn());
  await client.ask("project-2", "second", signal, vi.fn());
  expect(apiClient).toHaveBeenCalledWith(
    "/ai-chat/projects/project-2/threads",
    expect.objectContaining({ method: "POST" }),
  );
});
it("does not claim success when the stream closes before completed", async () => {
  vi.mocked(streamAiChatAsk).mockResolvedValue(undefined);
  await expect(
    new CompanionChatClient().ask(
      "project-1",
      "hello",
      new AbortController().signal,
      vi.fn(),
    ),
  ).rejects.toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
});
it("propagates configuration and stream errors without a canned fallback", async () => {
  vi.mocked(streamAiChatAsk).mockImplementation(async ({ onEvent }) =>
    onEvent({
      event: "failed",
      data: {
        code: "AI_ENGINE_NOT_CONFIGURED",
        message: "Not configured",
        retryable: false,
      },
    }),
  );
  await expect(
    new CompanionChatClient().ask(
      "project-1",
      "hello",
      new AbortController().signal,
      vi.fn(),
    ),
  ).rejects.toMatchObject({ code: "AI_ENGINE_NOT_CONFIGURED" });
});
