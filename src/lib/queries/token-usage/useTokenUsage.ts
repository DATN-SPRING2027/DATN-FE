"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export const AI_TOKEN_USAGE_TASK_KINDS = [
  "ai_chat",
  "mind_map",
  "knowledge_sync",
  "note_assessment",
  "note_rewrite",
] as const;

export type AiTokenUsageTaskKind = (typeof AI_TOKEN_USAGE_TASK_KINDS)[number];

export type AiTokenUsageScope = "personal" | "project" | "organization";

export type AiTokenUsageOwnerKind = "project" | "member";

export interface AiTokenUsageOwner {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
  readonly subtitle?: string;
  readonly avatarUrl?: string | null;
  readonly kind: AiTokenUsageOwnerKind;
}

export interface AiTokenUsageTaskMeta {
  readonly id: AiTokenUsageTaskKind;
  readonly index: number;
}

export type AiTokenUsageBucketRow = readonly [
  hourEpoch: number,
  ownerIndex: number,
  taskIndex: number,
  inputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  outputTokens: number,
  calls: number,
];

export interface AiTokenUsageProjectOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly isLeader: boolean;
}

export interface AiTokenUsageResponse {
  readonly effectiveScope: AiTokenUsageScope;
  readonly availableScopes: readonly AiTokenUsageScope[];
  readonly ownerGroupKind: AiTokenUsageOwnerKind;
  readonly selectedProjectId: string | null;
  readonly actor: {
    readonly id: string;
    readonly name: string;
    readonly role: "ADMIN" | "TEAM_LEADER" | "MEMBER";
  };
  readonly projects: readonly AiTokenUsageProjectOption[];
  readonly owners: readonly AiTokenUsageOwner[];
  readonly tasks: readonly AiTokenUsageTaskMeta[];
  readonly rows: readonly AiTokenUsageBucketRow[];
  readonly generatedAt: string;
}

export const tokenUsageKeys = {
  all: ["ai-token-usage"] as const,
  detail: (
    organizationId: string,
    scope?: AiTokenUsageScope,
    projectId?: string | null,
  ) =>
    [
      "ai-token-usage",
      organizationId,
      scope ?? "auto",
      projectId ?? "all",
    ] as const,
};

export function useTokenUsageQuery(
  organizationId: string,
  params: {
    scope?: AiTokenUsageScope;
    projectId?: string | null;
    enabled?: boolean;
  } = {},
) {
  const { scope, projectId, enabled = true } = params;
  return useQuery({
    queryKey: tokenUsageKeys.detail(organizationId, scope, projectId),
    queryFn: ({ signal }) => {
      const search = new URLSearchParams();
      if (scope) search.set("scope", scope);
      if (projectId && projectId !== "all") search.set("projectId", projectId);
      const qs = search.toString();
      return apiClient<AiTokenUsageResponse>(
        `/ai-chat/token-usage${qs ? `?${qs}` : ""}`,
        {
          signal,
        },
      );
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
    retry: false,
  });
}
