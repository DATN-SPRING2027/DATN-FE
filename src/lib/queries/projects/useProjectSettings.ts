"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";

export function useProjectSettingsAccess(
  organizationId: string,
  projectId: string,
  active: boolean,
) {
  return useQuery({
    queryKey: ["project-settings-access", organizationId, projectId],
    enabled: active && Boolean(organizationId && projectId),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
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
