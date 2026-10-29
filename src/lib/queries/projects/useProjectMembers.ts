"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  isResourceId,
  parseCandidate,
  parseMembership,
  parseMemberPage,
  type ProjectMemberFilter,
} from "./project-members.contract";
export type {
  ProjectMembership,
  ProjectMemberPage,
  ProjectMemberFilter,
  ProjectMemberCandidate,
  ProjectMemberUser,
} from "./project-members.contract";

export const projectMemberKeys = {
  scope: (organizationId: string, projectId: string) =>
    ["project-members", organizationId, projectId] as const,
  list: (
    organizationId: string,
    projectId: string,
    filter: ProjectMemberFilter,
  ) => [...projectMemberKeys.scope(organizationId, projectId), filter] as const,
  candidates: (
    organizationId: string,
    projectId: string,
    search?: string,
  ) =>
    [
      ...projectMemberKeys.scope(organizationId, projectId),
      "candidates",
      search ?? "",
    ] as const,
};

function path(organizationId: string, projectId: string) {
  if (!organizationId || !isResourceId(projectId))
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid Project context");
  return `/iam/projects/${encodeURIComponent(projectId)}/memberships`;
}

function requireId(id: string) {
  if (!isResourceId(id))
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      "Invalid membership or user identifier",
    );
  return id;
}

export function useProjectMembersQuery(
  organizationId: string,
  projectId: string,
  filter: ProjectMemberFilter,
  options: { enabled?: boolean; staleTime?: number; allPages?: boolean } = {},
) {
  return useQuery({
    queryKey: options.allPages
      ? [
          ...projectMemberKeys.scope(organizationId, projectId),
          "directory",
          filter,
        ]
      : projectMemberKeys.list(organizationId, projectId, filter),
    enabled:
      Boolean(organizationId && isResourceId(projectId)) &&
      options.enabled !== false,
    retry: false,
    throwOnError: false,
    staleTime: options.staleTime ?? 0,
    gcTime: 120_000,
    refetchOnWindowFocus: true,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      if (
        !Number.isInteger(filter.page) ||
        filter.page < 1 ||
        !Number.isInteger(filter.pageSize) ||
        filter.pageSize < 1 ||
        filter.pageSize > 100 ||
        (options.allPages && filter.page !== 1) ||
        (filter.status !== undefined &&
          !["ACTIVE", "INACTIVE"].includes(filter.status))
      )
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          "Invalid member list filter",
        );
      const params = new URLSearchParams({
        page: String(filter.page),
        pageSize: String(filter.pageSize),
      });
      if (filter.status) params.set("status", filter.status);
      const fetchPage = async (page: number) => {
        params.set("page", String(page));
        const response = await apiClient<unknown>(
          `${path(organizationId, projectId)}?${params}`,
          {
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
            cache: "no-store",
          },
        );
        const parsed = parseMemberPage(response, organizationId, projectId);
        if (parsed.pagination.page !== page) {
          throw new ApiError(
            502,
            "INVALID_PROJECT_MEMBER_RESPONSE",
            "Unexpected membership page",
          );
        }
        return parsed;
      };
      const first = await fetchPage(filter.page);
      if (!options.allPages) return first;
      // Directory consumers use data only. Keep server pagination metadata and
      // the aggregate in a separate cache from ordinary paged lists.
      const members = new Map(first.data.map((member) => [member.id, member]));
      for (let page = 2; page <= first.pagination.totalPages; page += 1) {
        const result = await fetchPage(page);
        for (const member of result.data) members.set(member.id, member);
      }
      return { ...first, data: [...members.values()] };
    },
  });
}

export function useProjectMemberCandidatesQuery(
  organizationId: string,
  projectId: string,
  search?: string,
) {
  const trimmed = search?.trim();
  return useQuery({
    queryKey: projectMemberKeys.candidates(organizationId, projectId, trimmed),
    enabled: Boolean(organizationId && isResourceId(projectId)),
    retry: false,
    throwOnError: false,
    staleTime: 5_000,
    gcTime: 30_000,
    refetchOnWindowFocus: false,
    networkMode: "always",
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (trimmed) params.set("email", trimmed);
      return apiClient<{ data: unknown[]; pagination?: unknown }>(
        `/iam/projects/${encodeURIComponent(projectId)}/member-candidates?${params}`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          cache: "no-store",
        },
      ).then((res) => {
        if (!res || !Array.isArray(res.data))
          throw new ApiError(
            502,
            "INVALID_PROJECT_MEMBER_RESPONSE",
            "Unexpected Project member response",
          );
        if ("pagination" in res) return [];
        return res.data.map(parseCandidate);
      });
    },
  });
}

/** The read-only candidate endpoint enforces the command's project.members.add permission. */
export function useProjectMemberAddAccess(organizationId: string, projectId: string, active = true) {
  return useQuery({
    queryKey: [...projectMemberKeys.scope(organizationId, projectId), "add-access"],
    enabled: active && Boolean(organizationId && isResourceId(projectId)),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      const result = await apiClient<{ data: unknown[] }>(`/iam/projects/${encodeURIComponent(projectId)}/member-candidates`, {
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      });
      if (!result || !Array.isArray(result.data)) throw new Error("Invalid Project member access response");
      return true;
    },
  });
}

export type AddProjectMemberInput =
  | string
  | {
      userId: string;
      role?: "MEMBER" | "TEAM_LEADER";
    };

export function useAddProjectMember(organizationId: string, projectId: string) {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn: (input: AddProjectMemberInput) => {
      const userId = typeof input === "string" ? input : input.userId;
      const role = typeof input === "string" ? undefined : input.role;
      return apiClient<unknown>(path(organizationId, projectId), {
        method: "POST",
        body: JSON.stringify(
          role && role !== "MEMBER"
            ? { userId: requireId(userId), role }
            : { userId: requireId(userId) },
        ),
        signal: AbortSignal.timeout(15_000),
      }).then((data) => parseMembership(data, organizationId, projectId));
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["project-settings-access", organizationId, projectId] }),
        client.invalidateQueries({ queryKey: ["project-visibility-access", organizationId, projectId] }),
        client.invalidateQueries({
          queryKey: projectMemberKeys.scope(organizationId, projectId),
        }),
        client.invalidateQueries({
          queryKey: ["project-leaders", organizationId, projectId],
        }),
        client.invalidateQueries({
          queryKey: ["projects", organizationId],
        }),
        client.invalidateQueries({
          queryKey: ["organization-overview"],
        }),
      ]),
  });
}

export function useRemoveProjectMember(
  organizationId: string,
  projectId: string,
) {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn: (membershipId: string) =>
      apiClient<void>(
        `${path(organizationId, projectId)}/${encodeURIComponent(requireId(membershipId))}`,
        { method: "DELETE", signal: AbortSignal.timeout(15_000) },
      ),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["project-settings-access", organizationId, projectId] }),
        client.invalidateQueries({ queryKey: ["project-visibility-access", organizationId, projectId] }),
        client.invalidateQueries({
          queryKey: projectMemberKeys.scope(organizationId, projectId),
        }),
        client.invalidateQueries({
          queryKey: ["projects", organizationId],
        }),
        client.invalidateQueries({
          queryKey: ["organization-overview"],
        }),
      ]),
  });
}
