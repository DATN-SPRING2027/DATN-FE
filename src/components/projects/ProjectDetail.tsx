"use client";

import ProjectOverview from "./ProjectOverview";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";

function OrganizationProject({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId: string;
}) {
  const project = useProjectQuery(organizationId, projectId);
  if (project.isPending || project.isFetching) return <ProjectState />;
  if (project.isError)
    return (
      <ProjectState
        error={project.error}
        retry={() => {
          void project.refetch();
        }}
      />
    );
  return <ProjectOverview project={project.data} />;
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
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
        />
      ) : (
        <ProjectState error={new Error("No trusted organization")} />
      )}
    </div>
  );
}
