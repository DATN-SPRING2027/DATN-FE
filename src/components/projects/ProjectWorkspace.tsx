"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import {
  CheckCircleIcon,
  EyeIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
  LockIcon,
  PlusIcon,
  SearchIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useProjectsQuery,
  type Project,
} from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";
import ProjectCard from "./ProjectCard";

function isProjectLeaderless(project: Project): boolean {
  return (
    Boolean(project.requiresLeaderRecovery) ||
    (project.status === "ACTIVE" && project.effectiveLeaderCount === 0)
  );
}

function OrganizationProjects({ organizationId }: { organizationId: string }) {
  const t = useTranslations("projects");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Project["status"]>();
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | Project["visibility"]
  >("all");
  const [onlyLeaderless, setOnlyLeaderless] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"updated" | "name" | "code">("updated");

  const projects = useProjectsQuery(organizationId, {
    page,
    pageSize: 20,
    ...(status ? { status } : {}),
  });

  const filters: readonly {
    value: "all" | Project["status"];
    label: string;
  }[] = [
    { value: "all", label: t("all") },
    { value: "ACTIVE", label: t("active") },
    { value: "ARCHIVED", label: t("archived") },
  ];

  const loadedProjects = projects.data?.data ?? [];
  const totalItems = projects.data?.pagination.totalItems ?? 0;
  const activeCount = loadedProjects.filter(
    (item) => item.status === "ACTIVE",
  ).length;
  const privateCount = loadedProjects.filter(
    (item) => item.visibility === "PRIVATE",
  ).length;
  const publicCount = loadedProjects.filter(
    (item) => item.visibility === "PUBLIC",
  ).length;
  const leaderlessCount = loadedProjects.filter(isProjectLeaderless).length;

  const normalizedQuery = search.trim().toLowerCase();
  const filteredProjects = loadedProjects
    .filter((item) => {
      if (
        visibilityFilter !== "all" &&
        item.visibility !== visibilityFilter
      ) {
        return false;
      }
      if (onlyLeaderless && !isProjectLeaderless(item)) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.code.toLowerCase().includes(normalizedQuery) ||
        (item.description ?? "").toLowerCase().includes(normalizedQuery)
      );
    })
    .slice()
    .sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name);
      if (sort === "code") return left.code.localeCompare(right.code);
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });

  const hasActiveFilters =
    Boolean(status) ||
    visibilityFilter !== "all" ||
    onlyLeaderless ||
    normalizedQuery.length > 0;

  const resetFilters = () => {
    setStatus(undefined);
    setVisibilityFilter("all");
    setOnlyLeaderless(false);
    setSearch("");
    setPage(1);
  };

  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      {/* Leaderless Projects Warning Banner */}
      {projects.isSuccess && !projects.isFetching && leaderlessCount > 0 && (
        <section
          aria-label={t("leaderlessProjectsBannerTitle", {
            count: leaderlessCount,
          })}
          className="flex flex-col justify-between gap-3 rounded-2xl border border-error-200 bg-error-50/80 p-4 sm:flex-row sm:items-center dark:border-error-500/30 dark:bg-error-500/10"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-error-900 dark:text-error-200">
              {t("leaderlessProjectsBannerTitle", { count: leaderlessCount })}
            </p>
            <p className="text-xs text-error-700 dark:text-error-300/90">
              {t("leaderlessProjectsBannerDescription")}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={onlyLeaderless}
            onClick={() => setOnlyLeaderless((prev) => !prev)}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-xl border border-error-300 bg-white px-3 text-xs font-semibold text-error-700 shadow-theme-xs transition hover:bg-error-50 dark:border-error-500/40 dark:bg-gray-900 dark:text-error-300 dark:hover:bg-error-500/15"
          >
            {onlyLeaderless
              ? t("showAllProjectsFilter")
              : t("filterLeaderlessOnly")}
          </button>
        </section>
      )}

      {/* B2B KPI Summary Strip */}
      {projects.isSuccess && !projects.isFetching && (
        <section
          aria-label={t("workspace")}
          className="grid grid-cols-2 gap-3 @xl:grid-cols-4 @xl:gap-4"
        >
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiTotalLabel")}
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
                {totalItems}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("kpiTotalHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <FolderIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiActiveLabel")}
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-success-600 tabular-nums dark:text-success-400">
                {activeCount}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("kpiActiveHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
            >
              <CheckCircleIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiPrivateLabel")}
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-warning-600 tabular-nums dark:text-warning-400">
                {privateCount}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("kpiPrivateHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400"
            >
              <LockIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiPublicLabel")}
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-blue-light-600 tabular-nums dark:text-blue-light-400">
                {publicCount}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("kpiPublicHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-400"
            >
              <EyeIcon className="h-5 w-5" />
            </span>
          </div>
        </section>
      )}

      {/* Multi-Criteria Filter & Control Toolbar */}
      <div className="rounded-2xl border border-gray-200/90 bg-white p-3 shadow-theme-xs sm:p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
          {/* Left: Search input + Status segmented tabs */}
          <div className="flex flex-col gap-2.5 @lg:flex-row @lg:items-center">
            <div className="relative min-w-0 flex-1 @lg:w-80 @2xl:w-96">
              <label htmlFor="project-search" className="sr-only">
                {t("searchProjects")}
              </label>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-gray-400"
              >
                <SearchIcon className="h-4 w-4" />
              </span>
              <input
                id="project-search"
                type="search"
                aria-describedby="project-search-page-hint"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 ps-9 pe-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800/70 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-500"
              />
            </div>

            <div
              className="inline-flex w-max items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
              role="group"
              aria-label={t("filterByStatus")}
            >
              {filters.map((filter) => {
                const selected = (status ?? "all") === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setStatus(
                        filter.value === "all" ? undefined : filter.value,
                      );
                      setPage(1);
                    }}
                    className={`inline-flex h-7 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                      selected
                        ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Total count + Visibility filter + Sort + View switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 @2xl:justify-end">
            {projects.isSuccess && !projects.isFetching && (
              <span className="me-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                {t("totalProjects", {
                  count: projects.data.pagination.totalItems,
                })}
              </span>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="project-visibility-filter">
                {t("filterByVisibility")}
              </label>
              <select
                id="project-visibility-filter"
                aria-label={t("filterByVisibility")}
                value={visibilityFilter}
                onChange={(event) =>
                  setVisibilityFilter(
                    event.target.value as "all" | Project["visibility"],
                  )
                }
                className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white ps-3 pe-8 text-xs font-medium text-gray-700 shadow-theme-xs outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="all">{t("allVisibility")}</option>
                <option value="PRIVATE">{t("PRIVATE")}</option>
                <option value="PUBLIC">{t("PUBLIC")}</option>
              </select>

              <label className="sr-only" htmlFor="project-sort">
                {t("sortProjects")}
              </label>
              <select
                id="project-sort"
                aria-label={t("sortProjects")}
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as "updated" | "name" | "code")
                }
                className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white ps-3 pe-8 text-xs font-medium text-gray-700 shadow-theme-xs outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="updated">{t("sortUpdated")}</option>
                <option value="name">{t("sortName")}</option>
                <option value="code">{t("sortCode")}</option>
              </select>

              <div
                className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800"
                role="group"
                aria-label={t("viewMode")}
              >
                <button
                  type="button"
                  aria-label={t("gridView")}
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                    view === "grid"
                      ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  <GridIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t("listView")}
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                    view === "list"
                      ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  <ListIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>
          </div>
        </div>
        <p
          id="project-search-page-hint"
          className="mt-2.5 border-t border-gray-100 pt-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400"
        >
          {t("searchLoadedPageHint")}
        </p>
      </div>

      {/* Loading & Error states */}
      {(projects.isPending || projects.isFetching) && <ProjectState />}
      {projects.isError && (
        <ProjectState
          error={projects.error}
          retry={() => {
            void projects.refetch();
          }}
        />
      )}

      {/* Loaded content */}
      {projects.isSuccess && !projects.isFetching && (
        <>
          {projects.data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
              <span
                aria-hidden="true"
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
              >
                <FolderIcon className="h-6 w-6" />
              </span>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
                {t("emptyTitle")}
              </h3>
              <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
                {t("empty")}
              </p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
                {t("noMatchingProjectsTitle")}
              </h3>
              <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
                {t("noMatchingProjects")}
              </p>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  {t("clearFilters")}
                </Button>
              </div>
            </div>
          ) : (
            <ul
              className={
                view === "grid"
                  ? "grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3"
                  : "flex flex-col gap-3"
              }
            >
              {filteredProjects.map((project) => (
                <li key={project.id} className="min-w-0">
                  <ProjectCard project={project} layout={view} />
                </li>
              ))}
            </ul>
          )}

          {/* Unified B2B Pagination Footer */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/90 bg-white px-4 py-3 shadow-theme-xs @md:flex-row @md:items-center @md:justify-between dark:border-gray-800 dark:bg-gray-900">
            <span className="text-xs font-medium text-gray-500 tabular-nums dark:text-gray-400">
              {t("pageOf", {
                page: projects.data.pagination.page,
                total: Math.max(1, projects.data.pagination.totalPages),
              })}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white/90">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("workspaceHint")}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{t("create")}</span>
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
