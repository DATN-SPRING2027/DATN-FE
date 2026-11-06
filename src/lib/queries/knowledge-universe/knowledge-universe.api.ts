import { apiClient } from "@/lib/api-client";
import { aiChatCsrfHeaders } from "@/lib/queries/ai-chat/ai-chat-stream";
import type {
  UniverseKnowledgeDetail,
  UniverseKnowledgePage,
  UniverseKnowledgeReference,
  UniverseKnowledgeResolve,
  UniverseManifest,
} from "./knowledge-universe.types";

function projectUniverseBasePath(projectId: string): string {
  return `/ai-chat/projects/${encodeURIComponent(projectId)}/knowledge-universe`;
}

export const knowledgeUniverseApi = {
  overview(projectId: string, signal?: AbortSignal): Promise<UniverseManifest> {
    return apiClient<UniverseManifest>(
      `${projectUniverseBasePath(projectId)}/overview`,
      { method: "GET", signal },
    );
  },

  cluster(
    projectId: string,
    params: {
      tree_version: string;
      node_id: string;
      limit?: number;
      cursor?: string;
      related_to?: string;
    },
    signal?: AbortSignal,
  ): Promise<UniverseKnowledgePage> {
    const search = new URLSearchParams({
      tree_version: params.tree_version,
      node_id: params.node_id,
    });
    if (params.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    if (params.cursor) {
      search.set("cursor", params.cursor);
    }
    if (params.related_to) {
      search.set("related_to", params.related_to);
    }
    return apiClient<UniverseKnowledgePage>(
      `${projectUniverseBasePath(projectId)}/cluster?${search.toString()}`,
      { method: "GET", signal },
    );
  },

  unit(
    projectId: string,
    unitId: string,
    treeVersion: string,
    signal?: AbortSignal,
  ): Promise<UniverseKnowledgeDetail> {
    const search = new URLSearchParams({
      tree_version: treeVersion,
    });
    return apiClient<UniverseKnowledgeDetail>(
      `${projectUniverseBasePath(projectId)}/units/${encodeURIComponent(unitId)}?${search.toString()}`,
      { method: "GET", signal },
    );
  },

  resolve(
    projectId: string,
    references: UniverseKnowledgeReference[],
    signal?: AbortSignal,
  ): Promise<UniverseKnowledgeResolve> {
    return apiClient<UniverseKnowledgeResolve>(
      `${projectUniverseBasePath(projectId)}/resolve`,
      {
        method: "POST",
        headers: aiChatCsrfHeaders(),
        body: JSON.stringify({ references }),
        signal,
      },
    );
  },
};
