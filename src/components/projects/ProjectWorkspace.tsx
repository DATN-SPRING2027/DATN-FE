"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { GridIcon, ListIcon } from "@/icons";
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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const projects = useProjectsQuery(organizationId, {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });
  const filters: readonly { value: "all" | Project["status"]; label: string }[] = [
    { value: "all", label: t("all") },
    { value: "ACTIVE", label: t("active") },
    { value: "ARCHIVED", label: t("archived") },
  ];
  const sortedProjects = projects.data?.data.slice().sort((left, right) =>
    sort === "name"
      ? left.name.localeCompare(right.name)
      : Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 @xl:flex-row @xl:items-center @xl:justify-between dark:border-gray-800">
        <div className="flex w-max items-center gap-1" role="group" aria-label={t("filterByStatus")}>
          {filters.map((filter) => {
            const selected = (status ?? "all") === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setStatus(filter.value === "all" ? undefined : filter.value);
                  setPage(1);
                }}
                className={`inline-flex h-9 cursor-pointer items-center rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${selected ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projects.isSuccess && !projects.isFetching && (
            <p className="me-1 text-sm text-gray-500 dark:text-gray-400">
              {t("totalProjects", { count: projects.data.pagination.totalItems })}
            </p>
          )}
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900" role="group" aria-label={t("viewMode")}>
            <button type="button" aria-label={t("gridView")} aria-pressed={view === "grid"} onClick={() => setView("grid")} className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-lg ${view === "grid" ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
              <GridIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("listView")} aria-pressed={view === "list"} onClick={() => setView("list")} className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-lg ${view === "list" ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
              <ListIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <label className="sr-only" htmlFor="project-sort">{t("sortProjects")}</label>
          <select id="project-sort" aria-label={t("sortProjects")} value={sort} onChange={(event) => setSort(event.target.value as "updated" | "name")} className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-theme-xs outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <option value="updated">{t("sortUpdated")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        </div>
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
            <ul className={view === "grid" ? "grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3" : "flex flex-col gap-3"}>
              {sortedProjects?.map((project) => (
                <li key={project.id} className="min-w-0">
                  <ProjectCard project={project} layout={view} />
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
