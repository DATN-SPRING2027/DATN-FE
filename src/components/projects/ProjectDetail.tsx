"use client";

import { useMutationState } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import ProjectVisibilityNotification from "./ProjectVisibilityNotification";
import ProjectOverview, {
  type ProjectTab,
  resolveTabFromPathname,
} from "./ProjectOverview";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import ProjectState from "./ProjectState";
import TeamsWorkspace from "@/components/teams/TeamsWorkspace";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";

const TeamFixturePreview = lazy(
  () => import("@/components/team-preview/TeamPreview"),
);

function OrganizationProject({
  organizationId,
  projectId,
  showTeams,
  teamMode,
  initialTab,
}: {
  organizationId: string;
  projectId: string;
  showTeams: boolean;
  teamMode: "fixture" | "api";
  initialTab?: ProjectTab;
}) {
  const [activeTab, setActiveTab] = useState<ProjectTab>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== "undefined") {
      const fromUrl = resolveTabFromPathname(
        window.location.pathname,
        projectId,
      );
      if (fromUrl) return fromUrl;
    }
    return showTeams && teamMode === "fixture" ? "teams" : "overview";
  });
  const project = useProjectQuery(organizationId, projectId);
  const t = useTranslations("projectVisibility");
  const common = useTranslations("common");
  const changes = useMutationState({
    filters: {
      mutationKey: ["project-visibility-change", organizationId, projectId],
    },
    select: (mutation) => ({
      id: mutation.mutationId,
      status: mutation.state.status,
      target: mutation.state.variables,
    }),
  });
  const latest = changes.at(-1);
  const accessWasRevoked = isAccessOrResourceUnavailableError(project.error);
  const notice =
    latest?.status === "success" &&
    (project.isError || project.data?.visibility === latest.target) &&
    (latest.target === "PRIVATE" || latest.target === "PUBLIC") ? (
      <ProjectVisibilityNotification
        key={latest.id}
        message={t(latest.target === "PRIVATE" ? "privateSuccess" : "success")}
      />
    ) : null;

  if (project.isPending && !project.data)
    return <ProjectState variant="detail" />;
  if (project.isError && (!project.data || accessWasRevoked))
    return (
      <div className="space-y-3">
        {notice}
        <ProjectState
          error={project.error}
          retry={() => {
            void project.refetch();
          }}
        />
      </div>
    );
  return (
    <div className="space-y-3">
      {notice}
      {project.isFetching && <UpdatingStatus>{common("updating")}</UpdatingStatus>}
      {project.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void project.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      <ProjectOverview
        project={project.data!}
        showTeams={showTeams}
        initialTab={activeTab}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        teamPanel={
          !showTeams ? undefined : teamMode === "fixture" ? (
            <Suspense fallback={null}>
              <TeamFixturePreview embedded />
            </Suspense>
          ) : (
            <TeamsWorkspace projectId={projectId} embedded />
          )
        }
      />
    </div>
  );
}

export default function ProjectDetail({
  projectId,
  showTeams = false,
  teamMode = "api",
  initialTab,
}: {
  projectId: string;
  showTeams?: boolean;
  teamMode?: "fixture" | "api";
  initialTab?: ProjectTab;
}) {
  const user = useCurrentUserQuery();
  const userAccessLost = isAccessOrResourceUnavailableError(user.error);
  const visibleUser = userAccessLost ? undefined : user.data;
  return (
    <div className="space-y-5">
      {user.isPending && !visibleUser ? (
        <ProjectState />
      ) : user.isError && !visibleUser ? (
        <ProjectState error={user.error} />
      ) : visibleUser?.organizationId ? (
        <OrganizationProject
          key={`${visibleUser.id}:${visibleUser.organizationId}:${projectId}`}
          organizationId={visibleUser.organizationId}
          projectId={projectId}
          showTeams={showTeams}
          teamMode={teamMode}
          initialTab={initialTab}
        />
      ) : (
        <ProjectState error={new Error("No trusted organization")} />
      )}
    </div>
  );
}
