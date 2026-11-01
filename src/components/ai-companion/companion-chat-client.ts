import { ApiError, apiClient } from "@/lib/api-client";
import {
  aiChatCsrfHeaders,
  streamAiChatAsk,
} from "@/lib/queries/ai-chat/ai-chat-stream";
import type { AiChatThread } from "@/lib/queries/ai-chat/ai-chat.types";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";

/** Reuses the approved, project-scoped AI Chat contract; never fabricates answers. */
export class CompanionChatClient {
  private readonly threads = new Map<string, string>();

  async ask(
    projectId: string,
    query: string,
    signal: AbortSignal,
    onText: (text: string) => void,
  ) {
    const user = await apiClient<CurrentUserResponse>("/auth/me", {
      signal,
      cache: "no-store",
    });
    if (!user.organizationId)
      throw new ApiError(
        403,
        "PROJECT_CONTEXT_REQUIRED",
        "Select an organization and project.",
      );
    const key = `${user.id}:${user.organizationId}:${projectId}`;
    let threadId = this.threads.get(key);
    if (!threadId) {
      const created = await apiClient<AiChatThread>(
        `/ai-chat/projects/${encodeURIComponent(projectId)}/threads`,
        {
          method: "POST",
          headers: aiChatCsrfHeaders(),
          body: JSON.stringify({ title: query.slice(0, 72) }),
          signal,
        },
      );
      threadId = created.id;
      this.threads.set(key, threadId);
    }
    let content = "";
    let completed = false;
    try {
      await streamAiChatAsk({
        projectId,
        threadId,
        query,
        signal,
        onEvent: (event) => {
          if (event.event === "delta") {
            content += event.data.text;
            onText(content);
          }
          if (event.event === "completed") {
            content = event.data.content || content;
            completed = true;
            onText(content);
          }
          if (event.event === "failed")
            throw new ApiError(503, event.data.code, event.data.message);
        },
      });
      if (!completed || !content.trim())
        throw new ApiError(
          502,
          "AI_STREAM_INCOMPLETE",
          "AI response did not complete.",
        );
      return { content, threadId };
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status))
        this.threads.delete(key);
      throw error;
    }
  }
}
