"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import { useProjectVisibilityAccess } from "./useProjectVisibility";

/** Navigation and route UX use the same scoped decisions as the settings forms. */
export function useProjectManagementAccess(
  organizationId: string,
  projectId: string,
  active: boolean,
) {
  const settings = useProjectSettingsAccess(organizationId, projectId, active);
  const visibility = useProjectVisibilityAccess(
    organizationId,
    projectId,
    active,
  );
  const canUpdateProject =
    active && settings.isSuccess && settings.data === true;
  const canManageVisibility =
    active && visibility.isSuccess && visibility.data === true;

  return {
    settings,
    canUpdateProject,
    canManageVisibility,
    canAccessSettings: canUpdateProject || canManageVisibility,
    isPending: active && (settings.isPending || visibility.isPending),
    error: settings.error ?? visibility.error,
    refetch: () => Promise.all([settings.refetch(), visibility.refetch()]),
  };
}

const PROJECT_ACCESS_STALE_TIME_MS = 30_000;
const PROJECT_ACCESS_GC_TIME_MS = 5 * 60_000;

export function useProjectSettingsAccess(
  organizationId: string,
  projectId: string,
  active: boolean,
) {
  return useQuery({
    queryKey: ["project-settings-access", organizationId, projectId],
    enabled: active && Boolean(organizationId && projectId),
    retry: false,
    gcTime: PROJECT_ACCESS_GC_TIME_MS,
    staleTime: PROJECT_ACCESS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      try {
        const result = await apiClient<unknown>(
          `/iam/projects/${encodeURIComponent(projectId)}/settings-access`,
          {
            cache: "no-store",
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          },
        );
        if (
          !result ||
          typeof result !== "object" ||
          (result as Record<string, unknown>).canUpdateProject !== true
        )
          throw new Error("Invalid project settings access response");
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return false;
        throw error;
      }
    },
  });
}
