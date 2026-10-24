"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type ProjectLeaderSummary = Readonly<{
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  roleCode?: "TEAM_LEADER" | "MEMBER" | "ADMIN";
}>;

export type Project = Readonly<{
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string | null;
  category?: string | null;
  coverImageUrl?: string | null;
  icon?: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  status: "ACTIVE" | "ARCHIVED";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activeMemberCount?: number;
  effectiveLeaderCount?: number;
  leaders?: readonly ProjectLeaderSummary[];
  memberPreviews?: readonly ProjectLeaderSummary[];
  requiresLeaderRecovery?: boolean;
}>;
export type CreateProjectInput = Readonly<{
  name: string;
  code: string;
  description?: string;
  visibility?: "PRIVATE" | "PUBLIC";
  memberUserIds?: readonly string[];
  leaderUserIds?: readonly string[];
}>;
export type ProjectListInput = Readonly<{
  page: number;
  pageSize: number;
  status?: Project["status"];
  q?: string;
  includeTotal?: boolean;
}>;
export type ProjectList = Readonly<{
  data: readonly Project[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems?: number;
    totalPages?: number;
    hasMore?: boolean;
  }>;
}>;
export const projectKeys = {
  scope: (organizationId: string) => ["projects", organizationId] as const,
  list: (organizationId: string, input: ProjectListInput) =>
    ["projects", organizationId, "list", input] as const,
  detail: (organizationId: string, id: string) =>
    ["projects", organizationId, "detail", id] as const,
};

async function fetchProjectsPage(
  input: ProjectListInput,
  signal?: AbortSignal,
): Promise<ProjectList> {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.status) params.set("status", input.status);
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.includeTotal === false) params.set("includeTotal", "false");
  return apiClient<ProjectList>(`/iam/projects?${params}`, {
    signal,
    cache: "no-store",
  });
}

export function useProjectsQuery(
  organizationId: string,
  input: ProjectListInput,
  options: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  } = {},
) {
  return useQuery({
    queryKey: projectKeys.list(organizationId, input),
    queryFn: ({ signal }) => fetchProjectsPage(input, signal),
    enabled: Boolean(organizationId) && options.enabled !== false,
    retry: false,
    staleTime: options.staleTime ?? 0,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
  });
}
export function useProjectQuery(organizationId: string, id: string) {
  return useQuery({
    queryKey: projectKeys.detail(organizationId, id),
    queryFn: ({ signal }) =>
      apiClient<Project>(`/iam/projects/${encodeURIComponent(id)}`, {
        signal,
        cache: "no-store",
      }),
    enabled: Boolean(organizationId && id),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
export function useCreateProjectMutation(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      code,
      description,
      visibility,
      memberUserIds,
      leaderUserIds,
    }: CreateProjectInput) =>
      apiClient<Project>("/iam/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          code,
          ...(description !== undefined ? { description } : {}),
          ...(visibility && visibility !== "PRIVATE" ? { visibility } : {}),
          ...(memberUserIds && memberUserIds.length > 0
            ? { memberUserIds }
            : {}),
          ...(leaderUserIds && leaderUserIds.length > 0
            ? { leaderUserIds }
            : {}),
        }),
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: projectKeys.scope(organizationId) }),
  });
}

export type UpdateProjectInput = Readonly<{
  name?: string;
  description?: string | null;
  category?: string | null;
  coverImageUrl?: string | null;
  icon?: string | null;
}>;

export function useUpdateProjectMutation(
  organizationId: string,
  projectId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["project-update", organizationId, projectId],
    retry: false,
    networkMode: "always",
    mutationFn: async (input: UpdateProjectInput) => {
      const result = await apiClient<Project>(
        `/iam/projects/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (
        !result ||
        result.id !== projectId ||
        result.organizationId !== organizationId ||
        result.status !== "ACTIVE" ||
        typeof result.name !== "string" ||
        typeof result.code !== "string" ||
        typeof result.createdBy !== "string" ||
        (result.description != null &&
          typeof result.description !== "string") ||
        !Number.isFinite(Date.parse(result.createdAt)) ||
        !Number.isFinite(Date.parse(result.updatedAt))
      ) {
        throw new Error("Invalid project update response");
      }
      return result;
    },
    onSuccess: async (updated) => {
      await client.cancelQueries({
        queryKey: projectKeys.detail(organizationId, projectId),
      });
      client.setQueryData(
        projectKeys.detail(organizationId, projectId),
        updated,
      );
      await client.invalidateQueries({
        queryKey: [...projectKeys.scope(organizationId), "list"],
      });
    },
  });
}
