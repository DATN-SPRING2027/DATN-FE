"use client";

import { useMutationState } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";
import ProjectVisibilityNotification from "./ProjectVisibilityNotification";
import ProjectOverview from "./ProjectOverview";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";
import TeamsWorkspace from "@/components/teams/TeamsWorkspace";

const TeamFixturePreview = lazy(
  () => import("@/components/team-preview/TeamPreview"),
);

function OrganizationProject({
  organizationId,
  projectId,
  showTeams,
  teamMode,
}: {
  organizationId: string;
  projectId: string;
  showTeams: boolean;
  teamMode: "fixture" | "api";
}) {
  const project = useProjectQuery(organizationId, projectId);
  const t = useTranslations("projectVisibility");
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
  const notice =
    latest?.status === "success" &&
    (project.isError || project.data?.visibility === latest.target) &&
    (latest.target === "PRIVATE" || latest.target === "PUBLIC") ? (
      <ProjectVisibilityNotification
        key={latest.id}
        message={t(latest.target === "PRIVATE" ? "privateSuccess" : "success")}
      />
    ) : null;

  if (project.isPending || project.isFetching) return <ProjectState />;
  if (project.isError)
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
      <ProjectOverview
        project={project.data}
        showTeams={showTeams}
        initialTab={showTeams && teamMode === "fixture" ? "teams" : "overview"}
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
}: {
  projectId: string;
  showTeams?: boolean;
  teamMode?: "fixture" | "api";
}) {
  const user = useCurrentUserQuery();
  return (
    <div className="space-y-5">
      {user.isPending ? (
        <ProjectState />
      ) : user.isError ? (
        <ProjectState error={user.error} />
      ) : user.data?.organizationId ? (
        <OrganizationProject
          key={`${user.data.id}:${user.data.organizationId}:${projectId}`}
          organizationId={user.data.organizationId}
          projectId={projectId}
          showTeams={showTeams}
          teamMode={teamMode}
        />
      ) : (
        <ProjectState error={new Error("No trusted organization")} />
      )}
    </div>
  );
}
