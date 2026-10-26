"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import { isResourceId } from "./project-members.contract";
import { projectMemberKeys } from "./useProjectMembers";

export type ProjectLeader = Readonly<{
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: "TEAM_LEADER";
  status: "ACTIVE" | "INACTIVE";
}>;

export type ProjectLeaderCandidate = Readonly<{
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: "MEMBER";
  status: "ACTIVE";
}>;

const invalidResponse = () =>
  new ApiError(
    502,
    "INVALID_PROJECT_LEADER_RESPONSE",
    "Unexpected Project Leader response",
  );

function parseLeader(value: unknown): ProjectLeader {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isResourceId((value as Record<string, unknown>).userId) ||
    typeof (value as Record<string, unknown>).fullName !== "string" ||
    typeof (value as Record<string, unknown>).email !== "string" ||
    ((value as Record<string, unknown>).avatarUrl !== null &&
      typeof (value as Record<string, unknown>).avatarUrl !== "string") ||
    (value as Record<string, unknown>).role !== "TEAM_LEADER" ||
    !["ACTIVE", "INACTIVE"].includes(
      String((value as Record<string, unknown>).status),
    )
  )
    throw invalidResponse();
  const item = value as Record<string, unknown>;
  return {
    userId: item.userId as string,
    fullName: item.fullName as string,
    email: item.email as string,
    avatarUrl: item.avatarUrl as string | null,
    role: "TEAM_LEADER",
    status: item.status as ProjectLeader["status"],
  };
}

function parseCandidate(value: unknown): ProjectLeaderCandidate {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isResourceId((value as Record<string, unknown>).userId) ||
    typeof (value as Record<string, unknown>).fullName !== "string" ||
    typeof (value as Record<string, unknown>).email !== "string" ||
    ((value as Record<string, unknown>).avatarUrl !== null &&
      typeof (value as Record<string, unknown>).avatarUrl !== "string") ||
    (value as Record<string, unknown>).role !== "MEMBER" ||
    (value as Record<string, unknown>).status !== "ACTIVE"
  )
    throw invalidResponse();
  const item = value as Record<string, unknown>;
  return {
    userId: item.userId as string,
    fullName: item.fullName as string,
    email: item.email as string,
    avatarUrl: item.avatarUrl as string | null,
    role: "MEMBER",
    status: "ACTIVE",
  };
}

export const projectLeaderKeys = {
  scope: (organizationId: string, projectId: string) =>
    ["project-leaders", organizationId, projectId] as const,
  candidates: (organizationId: string, projectId: string, email?: string) =>
    [
      "project-leader-candidates",
      organizationId,
      projectId,
      email ?? "",
    ] as const,
};

function projectPath(projectId: string) {
  if (!isResourceId(projectId))
    throw new ApiError(422, "VALIDATION_FAILED", "Invalid Project context");
  return `/iam/projects/${encodeURIComponent(projectId)}`;
}

export function useProjectLeadersQuery(
  organizationId: string,
  projectId: string,
) {
  return useQuery({
    queryKey: projectLeaderKeys.scope(organizationId, projectId),
    enabled: Boolean(organizationId && isResourceId(projectId)),
    retry: false,
    staleTime: 15_000,
    gcTime: 120_000,
    refetchOnWindowFocus: true,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      const response = await apiClient<{ data: unknown[] }>(
        `${projectPath(projectId)}/leaders`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          cache: "no-store",
        },
      );
      if (!response || !Array.isArray(response.data)) throw invalidResponse();
      return response.data.map(parseLeader);
    },
  });
}

export function useProjectLeaderCandidatesQuery(
  organizationId: string,
  projectId: string,
  email?: string,
) {
  const trimmed = email?.trim();
  return useQuery({
    queryKey: projectLeaderKeys.candidates(organizationId, projectId, trimmed),
    enabled: Boolean(organizationId && isResourceId(projectId) && trimmed),
    retry: false,
    staleTime: 2_000,
    gcTime: 15_000,
    refetchOnWindowFocus: false,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ email: trimmed ?? "" });
      const response = await apiClient<{ data: unknown[] }>(
        `${projectPath(projectId)}/leader-candidates?${params}`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          cache: "no-store",
        },
      );
      if (!response || !Array.isArray(response.data)) throw invalidResponse();
      return response.data.map(parseCandidate);
    },
  });
}

export function useProjectLeaderActions(
  organizationId: string,
  projectId: string,
) {
  const client = useQueryClient();
  const path = projectPath(projectId);
  const onSuccess = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["project-settings-access", organizationId, projectId] }),
      client.invalidateQueries({ queryKey: ["project-visibility-access", organizationId, projectId] }),
      client.invalidateQueries({
        queryKey: projectLeaderKeys.scope(organizationId, projectId),
      }),
      client.invalidateQueries({
        queryKey: ["project-leader-candidates", organizationId, projectId],
      }),
      client.invalidateQueries({
        queryKey: projectMemberKeys.scope(organizationId, projectId),
      }),
      client.invalidateQueries({
        queryKey: ["projects", organizationId],
      }),
      client.invalidateQueries({
        queryKey: ["organization-overview"],
      }),
    ]);
  };
  return {
    assign: useMutation({
      retry: false,
      networkMode: "always",
      mutationFn: (userId: string) =>
        apiClient<void>(`${path}/leaders`, {
          method: "POST",
          body: JSON.stringify({ userId }),
          signal: AbortSignal.timeout(15_000),
        }),
      onSuccess,
    }),
    change: useMutation({
      retry: false,
      networkMode: "always",
      mutationFn: (input: { previousUserId: string; nextUserId: string }) =>
        apiClient<void>(`${path}/leaders`, {
          method: "PUT",
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(15_000),
        }),
      onSuccess,
    }),
    revoke: useMutation({
      retry: false,
      networkMode: "always",
      mutationFn: (userId: string) =>
        apiClient<void>(`${path}/leaders/${encodeURIComponent(userId)}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(15_000),
        }),
      onSuccess,
    }),
  };
}
