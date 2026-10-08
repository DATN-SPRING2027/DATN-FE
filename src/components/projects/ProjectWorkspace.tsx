"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useProjectsQuery,
  type Project,
} from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";
import ProjectCard from "./ProjectCard";

function OrganizationProjects({ organizationId }: { organizationId: string }) {
  const t = useTranslations("projects");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Project["status"]>();
  const projects = useProjectsQuery(organizationId, {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });
  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 @xl:flex-row @xl:items-end @xl:justify-between dark:border-gray-800">
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-status" className="mb-0 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("status")}
          </Label>
          <div className="w-56">
            <Select
              id="project-status"
              defaultValue="all"
              options={[
                { value: "all", label: t("all") },
                { value: "ACTIVE", label: t("active") },
                { value: "ARCHIVED", label: t("archived") },
              ]}
              onChange={(value) => {
                setStatus(
                  value === "all" ? undefined : (value as Project["status"]),
                );
                setPage(1);
              }}
            />
          </div>
        </div>
        {projects.isSuccess && !projects.isFetching && (
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {t("totalProjects", {
              count: projects.data.pagination.totalItems,
            })}
          </p>
        )}
      </div>
      {(projects.isPending || projects.isFetching) && <ProjectState />}
      {projects.isError && (
        <ProjectState
          error={projects.error}
          retry={() => {
            void projects.refetch();
          }}
        />
      )}
      {projects.isSuccess && !projects.isFetching && (
        <>
          {projects.data.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900">
              <h3 className="font-semibold text-gray-800 dark:text-white/90">
                {t("emptyTitle")}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t("empty")}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
              {projects.data.data.map((project) => (
                <li key={project.id} className="min-w-0">
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 @md:flex-row @md:items-center @md:justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("pageOf", {
                page: projects.data.pagination.page,
                total: Math.max(1, projects.data.pagination.totalPages),
              })}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                disabled={page >= projects.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default function ProjectWorkspace() {
  const t = useTranslations("projects");
  const user = useCurrentUserQuery();
  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 @xl:flex-row @xl:items-center @xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("workspaceHint")}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {t("create")}
        </Link>
      </header>
      {user.isPending ? (
        <ProjectState />
      ) : user.isError ? (
        <ProjectState
          error={user.error}
          retry={() => {
            void user.refetch();
          }}
        />
      ) : user.data?.organizationId ? (
        <OrganizationProjects
          key={`${user.data.id}:${user.data.organizationId}`}
          organizationId={user.data.organizationId}
        />
      ) : (
        <ProjectState error={new Error("No trusted organization")} />
      )}
    </div>
  );
}
