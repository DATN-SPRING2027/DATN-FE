"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import ProjectState from "@/components/projects/ProjectState";
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
  const user = useCurrentUserQuery();
  const organizationId = user.data?.organizationId ?? "";
  const projects = useProjectsQuery(organizationId, {
    page: 1,
    pageSize: 20,
    status: "ACTIVE",
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(
    initialProjectId,
  );
  const [view, setView] = useState<WorkView>(initialView ?? "list");

  if (user.isPending || (organizationId && projects.isPending)) {
    return <ProjectState />;
  }
  if (user.isError) return <ProjectState error={user.error} />;
  if (!organizationId) {
    return <ProjectState error={new Error("No trusted organization")} />;
  }
  if (projects.isError) {
    return (
      <ProjectState
        error={projects.error}
        retry={() => void projects.refetch()}
      />
    );
  }

  const loadedProjects = projects.data?.data ?? [];
  if (loadedProjects.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900"
      >
        <h1 className="text-base font-semibold text-gray-900 dark:text-white/90">
          {t("emptyProjectsTitle")}
        </h1>
        <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
          {t("emptyProjectsDescription")}
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-xl bg-brand-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {t("browseProjects")}
        </Link>
      </div>
    );
  }

  const activeProject =
    loadedProjects.find((project) => project.id === selectedProjectId) ??
    loadedProjects[0];

  return (
    <WorkWorkspace
      key={activeProject.id}
      projectId={activeProject.id}
      project={activeProject}
      projects={loadedProjects}
      onProjectChange={setSelectedProjectId}
      view={view}
      onViewChange={setView}
    />
  );
}
