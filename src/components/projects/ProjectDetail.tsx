"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ComponentCard from "@/components/common/ComponentCard";
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
  const t = useTranslations("projects");
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
  const fields = {
    name: project.data.name,
    code: project.data.code,
    description: project.data.description || t("noDescription"),
    visibility: t(project.data.visibility),
    status: t(project.data.status === "ACTIVE" ? "active" : "archived"),
    createdAt: project.data.createdAt,
    updatedAt: project.data.updatedAt,
  };
  return (
    <dl className="space-y-4">
      {Object.entries(fields).map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-gray-500 dark:text-gray-400">
            {t(label)}
          </dt>
          <dd className="break-words text-gray-800 dark:text-gray-200">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default function ProjectDetail({ projectId }: { projectId: string }) {
  const t = useTranslations("projects");
  const user = useCurrentUserQuery();
  return (
    <ComponentCard title={t("detail")}>
      <div className="space-y-5">
        <Link href="/projects" className="text-brand-500 dark:text-brand-400">
          {t("back")}
        </Link>
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
    </ComponentCard>
  );
}
