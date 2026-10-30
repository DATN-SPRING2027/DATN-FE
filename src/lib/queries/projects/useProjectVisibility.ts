"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { projectKeys, type Project } from "./useProjects";

export function useChangeProjectVisibility(
  organizationId: string,
  projectId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["project-visibility-change", organizationId, projectId],
    retry: false,
    networkMode: "always",
    mutationFn: async (visibility: Project["visibility"]) => {
      const result = await apiClient<Project>(
        `/iam/projects/${encodeURIComponent(projectId)}/visibility`,
        {
          method: "PATCH",
          body: JSON.stringify({ visibility }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (
        !result ||
        result.id !== projectId ||
        result.organizationId !== organizationId ||
        result.visibility !== visibility ||
        result.status !== "ACTIVE" ||
        typeof result.name !== "string" ||
        typeof result.code !== "string" ||
        typeof result.createdBy !== "string" ||
        (result.description != null &&
          typeof result.description !== "string") ||
        !Number.isFinite(Date.parse(result.createdAt)) ||
        !Number.isFinite(Date.parse(result.updatedAt))
      ) {
        throw new Error("Invalid visibility response");
      }
      return result;
    },
    onSuccess: async (project) => {
      // Prevent an older in-flight detail read from overwriting publication.
      await client.cancelQueries({
        queryKey: projectKeys.detail(organizationId, projectId),
      });
      client.setQueryData(
        projectKeys.detail(organizationId, projectId),
        project,
      );
      await client.invalidateQueries({
        queryKey: [...projectKeys.scope(organizationId), "list"],
      });
      if (project.visibility === "PRIVATE") {
        await client.invalidateQueries({
          queryKey: projectKeys.detail(organizationId, projectId),
        });
      }
    },
  });
}

const PROJECT_VISIBILITY_STALE_TIME_MS = 30_000;
const PROJECT_VISIBILITY_GC_TIME_MS = 5 * 60_000;

export function useProjectVisibilityAccess(
  organizationId: string,
  projectId: string,
  active: boolean,
) {
  return useQuery({
    queryKey: ["project-visibility-access", organizationId, projectId],
    enabled: active && Boolean(organizationId && projectId),
    retry: false,
    gcTime: PROJECT_VISIBILITY_GC_TIME_MS,
    staleTime: PROJECT_VISIBILITY_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      try {
        const result = await apiClient<unknown>(
          `/iam/projects/${encodeURIComponent(projectId)}/visibility`,
          {
            cache: "no-store",
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          },
        );
        if (
          !result ||
          typeof result !== "object" ||
          (result as Record<string, unknown>).canManageVisibility !== true
        )
          throw new Error("Invalid visibility access response");
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return false;
        throw error;
      }
    },
  });
}
