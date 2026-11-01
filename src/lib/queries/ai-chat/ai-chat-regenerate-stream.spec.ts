import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { streamAiChatRegenerate } from "./ai-chat-stream";
import type { AiChatStreamEvent } from "./ai-chat.types";

describe("streamAiChatRegenerate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams started, delta, and completed events with lineage fields from POST .../regenerate", async () => {
    const sseBody = [
      'event: started\ndata: {"runId":"run-2","threadId":"thread-1","userMessageId":"q-1"}\n\n',
      'event: delta\ndata: {"text":"Regenerated answer [1]."}\n\n',
      'event: completed\ndata: {"messageId":"a-2","replyToMessageId":"q-1","regeneratedFromMessageId":"a-1","content":"Regenerated answer [1].","answerStatus":"answered","citations":[],"sessionCitations":[],"retrievalSteps":[]}\n\n',
    ].join("");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const events: AiChatStreamEvent[] = [];
    await streamAiChatRegenerate({
      projectId: "proj-1",
      threadId: "thread-1",
      messageId: "a-1",
      onEvent: (ev) => events.push(ev),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/backend/ai-chat/projects/proj-1/threads/thread-1/messages/a-1/regenerate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(events).toHaveLength(3);
    expect(events[2]).toEqual({
      event: "completed",
      data: expect.objectContaining({
        messageId: "a-2",
        replyToMessageId: "q-1",
        regeneratedFromMessageId: "a-1",
      }),
    });
  });

  it("surfaces 409 ApiError when another live run is active in the thread", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "AI_CHAT_ACTIVE_RUN_CONFLICT",
          message: "Another run is already active in this thread.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      streamAiChatRegenerate({
        projectId: "proj-1",
        threadId: "thread-1",
        messageId: "a-1",
        onEvent: () => undefined,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "AI_CHAT_ACTIVE_RUN_CONFLICT",
    } satisfies Partial<ApiError>);
  });
});
