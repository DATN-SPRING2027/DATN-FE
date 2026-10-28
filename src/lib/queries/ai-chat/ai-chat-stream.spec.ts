import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { streamAiChatAsk } from "./ai-chat-stream";
import type { AiChatStreamEvent } from "./ai-chat.types";

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]!);
        index += 1;
      } else {
        controller.close();
      }
    },
  });
}

describe("streamAiChatAsk", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (typeof document !== "undefined") {
      document.cookie = "continuum_csrf=; Max-Age=0; path=/";
    }
  });

  it("sends X-CSRF-Token cookie header and parses split UTF-8 SSE frames end-to-end", async () => {
    if (typeof document !== "undefined") {
      document.cookie = "continuum_csrf=csrf-token-abc; path=/";
    }
    const encoder = new TextEncoder();
    const rawSse =
      'event: started\r\ndata: {"runId":"r1","threadId":"t1","userMessageId":"u1"}\r\n\r\n' +
      'event: step\r\ndata: {"kind":"tool","label":"Search Knowledge","durationMs":110,"count":2}\r\n\r\n' +
      'event: delta\r\ndata: {"text":"Tổng hợp kiến trúc [1, S1]."}\r\n\r\n' +
      'event: completed\r\ndata: {"messageId":"a1","content":"Tổng hợp kiến trúc [1, S1].","answerStatus":"answered","citations":[{"number":1,"sourceId":"s1","documentId":"d1","documentName":"Spec"}],"sessionCitations":[{"ref":"S1","source":"selected_group","groupId":"g1","turnIds":["u0"],"summaryExcerpt":"Context"}],"retrievalSteps":[{"kind":"tool","label":"Search Knowledge","durationMs":110,"count":2}]}\r\n\r\n';

    const bytes = encoder.encode(rawSse);
    const split: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 9) {
      split.push(bytes.subarray(i, i + 9));
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(streamFromChunks(split), {
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const events: AiChatStreamEvent[] = [];
    await streamAiChatAsk({
      projectId: "proj-1",
      threadId: "t1",
      query: "Tổng hợp kiến trúc?",
      onEvent: (ev) => events.push(ev),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentHeaders = new Headers(init.headers);
    if (typeof document !== "undefined") {
      expect(sentHeaders.get("X-CSRF-Token")).toBe("csrf-token-abc");
    }
    expect(events.map((e) => e.event)).toEqual([
      "started",
      "step",
      "delta",
      "completed",
    ]);
    const completed = events[3];
    expect(completed?.event).toBe("completed");
    if (completed?.event === "completed") {
      expect(completed.data.content).toBe("Tổng hợp kiến trúc [1, S1].");
      expect(completed.data.citations[0]?.documentName).toBe("Spec");
      expect(completed.data.sessionCitations[0]?.ref).toBe("S1");
    }
  });

  it("throws structured ApiError when pre-stream response is non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            code: "PROJECT_NOT_FOUND",
            message: "Project is inaccessible.",
            details: {},
            requestId: "req-404",
          },
          { status: 404 },
        ),
      ),
    );

    await expect(
      streamAiChatAsk({
        projectId: "proj-missing",
        threadId: "t1",
        query: "Hello",
        onEvent: () => undefined,
      }),
    ).rejects.toMatchObject({
      status: 404,
      code: "PROJECT_NOT_FOUND",
    } satisfies Partial<ApiError>);
  });

  it("cancels the ReadableStream reader when consumption terminates before EOF", async () => {
    const cancelSpy = vi.fn();
    const encoder = new TextEncoder();
    const infiniteStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: delta\ndata: {"text":"chunk-1"}\n\n'),
        );
      },
      cancel: cancelSpy,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(infiniteStream, {
          status: 200,
          headers: { "content-type": "text/event-stream; charset=utf-8" },
        }),
      ),
    );

    await expect(
      streamAiChatAsk({
        projectId: "proj-1",
        threadId: "t1",
        query: "Stop test",
        onEvent: () => {
          throw new DOMException("The operation was aborted", "AbortError");
        },
      }),
    ).rejects.toThrow("The operation was aborted");

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
