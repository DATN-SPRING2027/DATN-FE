"use client";

import { useEffect, useMemo } from "react";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { useInfiniteProjectsQuery } from "./useProjects";

/** Loads every active project visible to the current organization member. */
export function useActiveOrganizationProjects(organizationId: string, enabled = true) {
  const query = useInfiniteProjectsQuery(
    organizationId,
    { pageSize: 100, status: "ACTIVE" },
    { enabled: enabled && Boolean(organizationId), staleTime: 30_000 },
  );
  const { isSuccess, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;

  useEffect(() => {
    if (isSuccess && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [isSuccess, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const accessLost = isAccessOrResourceUnavailableError(query.error);
  const projects = useMemo(
    () => accessLost ? [] : (query.data?.pages.flatMap((page) => page.data) ?? []),
    [accessLost, query.data],
  );
  const leaderUserIds = useMemo(
    () => new Set(projects.flatMap((project) => project.leaders?.map((leader) => leader.userId) ?? [])),
    [projects],
  );

  return {
    ...query,
    data: accessLost ? undefined : query.data,
    projects,
    leaderUserIds,
    isComplete: query.isSuccess && !query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError,
  };
}
