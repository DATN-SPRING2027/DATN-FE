"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  isResourceId,
  parseMembership,
  parseMemberPage,
  type ProjectMemberFilter,
} from "./project-members.contract";
export type {
  ProjectMembership,
  ProjectMemberPage,
  ProjectMemberFilter,
} from "./project-members.contract";

export const projectMemberKeys = {
  scope: (organizationId: string, projectId: string) =>
    ["project-members", organizationId, projectId] as const,
  list: (
    organizationId: string,
    projectId: string,
    filter: ProjectMemberFilter,
  ) => [...projectMemberKeys.scope(organizationId, projectId), filter] as const,
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
) {
  return useQuery({
    queryKey: projectMemberKeys.list(organizationId, projectId, filter),
    enabled: Boolean(organizationId && isResourceId(projectId)),
    retry: false,
    throwOnError: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    networkMode: "always",
    queryFn: ({ signal }) => {
      if (
        !Number.isInteger(filter.page) ||
        filter.page < 1 ||
        !Number.isInteger(filter.pageSize) ||
        filter.pageSize < 1 ||
        filter.pageSize > 100 ||
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
      return apiClient<unknown>(
        `${path(organizationId, projectId)}?${params}`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          cache: "no-store",
        },
      ).then((data) => parseMemberPage(data, organizationId, projectId));
    },
  });
}
export function useAddProjectMember(organizationId: string, projectId: string) {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    throwOnError: false,
    networkMode: "always",
    mutationFn: (userId: string) =>
      apiClient<unknown>(path(organizationId, projectId), {
        method: "POST",
        body: JSON.stringify({ userId: requireId(userId) }),
        signal: AbortSignal.timeout(15_000),
      }).then((data) => parseMembership(data, organizationId, projectId)),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: projectMemberKeys.scope(organizationId, projectId),
      }),
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
      client.invalidateQueries({
        queryKey: projectMemberKeys.scope(organizationId, projectId),
      }),
  });
}
