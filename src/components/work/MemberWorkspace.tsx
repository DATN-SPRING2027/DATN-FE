"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  useInfiniteProjectsQuery,
  useProjectQuery,
} from "@/lib/queries/projects/useProjects";
import ProjectState from "@/components/projects/ProjectState";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import WorkWorkspace from "./WorkWorkspace";
import type { WorkView } from "./WorkPageHeader";

export default function MemberWorkspace({
  initialProjectId,
  initialView,
}: {
  initialProjectId?: string;
  initialView?: WorkView;
}) {
  const t = useTranslations("work");
  const common = useTranslations("common");
  const pathname = usePathname?.() ?? "/workspace";
  const router = useRouter?.();
  const user = useCurrentUserQuery();
  const userAccessLost = isAccessOrResourceUnavailableError(user.error);
  const visibleUser = userAccessLost ? undefined : user.data;
  const organizationId = visibleUser?.organizationId ?? "";
  const projects = useInfiniteProjectsQuery(organizationId, {
    pageSize: 20,
    status: "ACTIVE",
  });
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >(initialProjectId);
  const [view, setView] = useState<WorkView>(initialView ?? "list");

  useEffect(() => {
    setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  function handleProjectChange(nextProjectId: string) {
    setSelectedProjectId(nextProjectId);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    params.set("projectId", nextProjectId);
    const nextHref = `${pathname}?${params.toString()}`;
    if (router?.replace) {
      router.replace(nextHref, { scroll: false });
    } else if (typeof window !== "undefined") {
      window.history.replaceState(null, "", nextHref);
    }
  }

  const projectsAccessLost = isAccessOrResourceUnavailableError(projects.error);
  const visibleProjects = projectsAccessLost ? undefined : projects.data;
  const loadedProjects = visibleProjects?.pages.flatMap((page) => page.data) ?? [];
  const matchedFromPage = selectedProjectId
    ? loadedProjects.find((project) => project.id === selectedProjectId)
    : undefined;
  const needsDirectProjectFetch = Boolean(
    organizationId &&
      projects.isSuccess &&
      selectedProjectId &&
      !matchedFromPage,
  );
  const directProject = useProjectQuery(
    organizationId,
    needsDirectProjectFetch ? (selectedProjectId ?? "") : "",
  );

  if (
      (user.isPending && !visibleUser) ||
    (organizationId && projects.isPending && !visibleProjects) ||
    (needsDirectProjectFetch && directProject.isPending && !directProject.data)
  ) {
    return <ProjectState />;
  }
  if (user.isError && !visibleUser) return <ProjectState error={user.error} />;
  if (!organizationId) {
    return <ProjectState error={new Error("No trusted organization")} />;
  }
  if (projects.isError && !visibleProjects) {
    return (
      <ProjectState
        error={projects.error}
        retry={() => void projects.refetch()}
      />
    );
  }
  const directProjectAccessLost = isAccessOrResourceUnavailableError(directProject.error);
  const visibleDirectProject = directProjectAccessLost ? undefined : directProject.data;
  if (needsDirectProjectFetch && directProject.isError && !visibleDirectProject) {
    return (
      <ProjectState
        error={directProject.error}
        retry={() => void directProject.refetch()}
      />
    );
  }

  const activeProject =
    matchedFromPage ?? visibleDirectProject ?? loadedProjects[0];

  if (!activeProject) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-theme-xs !rounded-none [&_*]:!rounded-none dark:border-gray-700 dark:bg-gray-900"
      >
        <h1 className="text-base font-semibold text-gray-900 dark:text-white/90">
          {t("emptyProjectsTitle")}
        </h1>
        <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
          {t("emptyProjectsDescription")}
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-flex h-9 items-center justify-center bg-brand-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {t("browseProjects")}
        </Link>
      </div>
    );
  }

  const workspaceProjects =
    visibleDirectProject && !matchedFromPage
      ? [
          visibleDirectProject,
          ...loadedProjects.filter(
            (project) => project.id !== visibleDirectProject.id,
          ),
        ]
      : loadedProjects;

  return (
    <div className="space-y-3">
      {!userAccessLost && user.isFetching && <UpdatingStatus>{common("updating")}</UpdatingStatus>}
      {!userAccessLost && user.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void user.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      {!projectsAccessLost && projects.isFetching && visibleProjects && (
        <UpdatingStatus>{common("updating")}</UpdatingStatus>
      )}
      {!projectsAccessLost && projects.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void projects.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      {!directProjectAccessLost && directProject.isFetching && visibleDirectProject && (
        <UpdatingStatus>{common("updating")}</UpdatingStatus>
      )}
      {!directProjectAccessLost && directProject.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void directProject.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      <WorkWorkspace
        key={activeProject.id}
        projectId={activeProject.id}
        project={activeProject}
        projects={workspaceProjects}
        onProjectChange={handleProjectChange}
        hasMoreProjects={projects.hasNextPage}
        isLoadingMoreProjects={projects.isFetchingNextPage}
        onLoadMoreProjects={() => void projects.fetchNextPage()}
        view={view}
        onViewChange={setView}
        hideProjectBanner
      />
    </div>
  );
}
