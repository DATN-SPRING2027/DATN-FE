import {
  ApiError,
  getApiBaseUrl,
  getCsrfToken,
  getExpectedOrganizationId,
} from "@/lib/api-client";
import type { AiChatStreamEvent } from "./ai-chat.types";

export function aiChatCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-CSRF-Token": token } : {};
}

export interface StreamAiChatAskInput {
  projectId: string;
  threadId: string;
  query: string;
  signal?: AbortSignal;
  onEvent: (event: AiChatStreamEvent) => void;
}

export interface StreamAiChatRegenerateInput {
  projectId: string;
  threadId: string;
  messageId: string;
  signal?: AbortSignal;
  onEvent: (event: AiChatStreamEvent) => void;
}

function parseSseFrameBlock(rawBlock: string): AiChatStreamEvent | null {
  const lines = rawBlock.split(/\r?\n/);
  let eventName = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!eventName || dataLines.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  switch (eventName) {
    case "started":
      return {
        event: "started",
        data: parsed as Extract<AiChatStreamEvent, { event: "started" }>["data"],
      };
    case "step":
      return {
        event: "step",
        data: parsed as Extract<AiChatStreamEvent, { event: "step" }>["data"],
      };
    case "delta":
      return {
        event: "delta",
        data: parsed as Extract<AiChatStreamEvent, { event: "delta" }>["data"],
      };
    case "completed":
      return {
        event: "completed",
        data: parsed as Extract<
          AiChatStreamEvent,
          { event: "completed" }
        >["data"],
      };
    case "failed":
      return {
        event: "failed",
        data: parsed as Extract<AiChatStreamEvent, { event: "failed" }>["data"],
      };
    default:
      return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function streamInterruptedError(): ApiError {
  return new ApiError(
    503,
    "STREAM_INTERRUPTED",
    "The AI response stream ended before a final result was received.",
  );
}

async function consumeAiChatSseStream(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onEvent: (event: AiChatStreamEvent) => void,
): Promise<void> {
  const buildHeaders = () => {
    const nextHeaders = new Headers({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...aiChatCsrfHeaders(),
    });
    const expectedOrg = getExpectedOrganizationId();
    if (expectedOrg) {
      nextHeaders.set("X-Expected-Organization-Id", expectedOrg);
    }
    return nextHeaders;
  };

  const executeFetch = async () => {
    try {
      return await fetch(url, {
        method: "POST",
        headers: buildHeaders(),
        credentials: "include",
        cache: "no-store",
        signal,
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      throw streamInterruptedError();
    }
  };

  const response = await executeFetch();

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    let detail: {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    } = {};
    try {
      detail = JSON.parse(errorBody) as typeof detail;
    } catch {
      // Keep raw fallback message when non-JSON.
    }
    const parsedDetails =
      typeof detail.details === "object" &&
      detail.details !== null &&
      !Array.isArray(detail.details)
        ? detail.details
        : undefined;
    throw new ApiError(
      response.status,
      detail.code,
      detail.message ??
        `AI Chat stream request failed (${response.status} ${response.statusText})`,
      undefined,
      false,
      parsedDetails,
    );
  }

  if (!response.body) {
    throw new ApiError(
      502,
      "SAG_STREAM_UNAVAILABLE",
      "Streaming response body is unavailable.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let streamDone = false;
  let receivedTerminalEvent = false;

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (receivedTerminalEvent) break;
        if (signal?.aborted || isAbortError(error)) throw error;
        throw streamInterruptedError();
      }
      const { value, done } = chunk;
      if (done) {
        streamDone = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let match = /\r?\n\r?\n/.exec(buffer);
      while (match) {
        const rawBlock = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parseSseFrameBlock(rawBlock);
        if (event) {
          receivedTerminalEvent ||=
            event.event === "completed" || event.event === "failed";
          onEvent(event);
        }
        match = /\r?\n\r?\n/.exec(buffer);
      }
      if (receivedTerminalEvent) break;
    }

    if (streamDone) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        const trailing = parseSseFrameBlock(buffer);
        if (trailing) {
          receivedTerminalEvent ||=
            trailing.event === "completed" || trailing.event === "failed";
          onEvent(trailing);
        }
      }
    }
    if (!receivedTerminalEvent) throw streamInterruptedError();
  } finally {
    if (!streamDone) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}

export async function streamAiChatAsk({
  projectId,
  threadId,
  query,
  signal,
  onEvent,
}: StreamAiChatAskInput): Promise<void> {
  const url = `${getApiBaseUrl()}/ai-chat/projects/${encodeURIComponent(
    projectId,
  )}/threads/${encodeURIComponent(threadId)}/ask`;
  await consumeAiChatSseStream(url, { query }, signal, onEvent);
}

export async function streamAiChatRegenerate({
  projectId,
  threadId,
  messageId,
  signal,
  onEvent,
}: StreamAiChatRegenerateInput): Promise<void> {
  const url = `${getApiBaseUrl()}/ai-chat/projects/${encodeURIComponent(
    projectId,
  )}/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(
    messageId,
  )}/regenerate`;
  await consumeAiChatSseStream(url, {}, signal, onEvent);
}
