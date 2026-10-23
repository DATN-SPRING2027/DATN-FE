"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import {
  AlertIcon,
  BoxIconLine,
  CheckCircleIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
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

  // Subscribe to server-side pagination totals for each status without relying on unobserved cache or 20-row page samples
  const allProjectsTotalQuery = useProjectsQuery(organizationId, {
    page: 1,
    pageSize: 1,
  });
  const activeProjectsTotalQuery = useProjectsQuery(organizationId, {
    page: 1,
    pageSize: 1,
    status: "ACTIVE",
  });
  const archivedProjectsTotalQuery = useProjectsQuery(organizationId, {
    page: 1,
    pageSize: 1,
    status: "ARCHIVED",
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

  const totalProjectsCount =
    status === undefined
      ? projects.data?.pagination.totalItems
      : allProjectsTotalQuery.data?.pagination.totalItems;

  const activeCount =
    status === "ACTIVE"
      ? projects.data?.pagination.totalItems
      : activeProjectsTotalQuery.data?.pagination.totalItems;

  const archivedCount =
    status === "ARCHIVED"
      ? projects.data?.pagination.totalItems
      : archivedProjectsTotalQuery.data?.pagination.totalItems;

  // Scoped strictly to the loaded page; only show "Healthy" when the entire organization directory fits on the single loaded page
  const leaderlessCount = loadedProjects.filter(isProjectLeaderless).length;
  const isCompleteOrgDirectoryLoaded =
    status === undefined && (projects.data?.pagination.totalPages ?? 1) <= 1;

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

      {/* B2B KPI Summary Strip — Server Totals + Page-Scoped Leaderless Indicator */}
      {projects.isSuccess && !projects.isFetching && (
        <section
          aria-label={t("workspace")}
          className="continuum-stagger-2 grid grid-cols-2 gap-3 @xl:grid-cols-4 @xl:gap-4"
        >
          {/* Card 1: Total Projects */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiTotalLabel")}
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
                {totalProjectsCount ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {totalProjectsCount === undefined
                  ? t(
                      status !== undefined && allProjectsTotalQuery.isError
                        ? "kpiCountUnavailable"
                        : "kpiCountLoading",
                    )
                  : t("kpiTotalHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <FolderIcon viewBox="0 0 20 18" className="h-5 w-5" />
            </span>
          </div>

          {/* Card 2: Active Projects */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiActiveLabel")}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
                  {activeCount ?? "—"}
                </p>
                {activeCount !== undefined && activeCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-400">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-success-500"
                    />
                    {t("kpiActiveBadge")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {activeCount === undefined
                  ? t(
                      status !== "ACTIVE" && activeProjectsTotalQuery.isError
                        ? "kpiCountUnavailable"
                        : "kpiCountLoading",
                    )
                  : t("kpiActiveHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <CheckCircleIcon viewBox="0 0 24 24" className="h-5 w-5" />
            </span>
          </div>

          {/* Card 3: Need Attention (Missing Effective Leader on current page) */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiAttentionLabel")}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
                  {leaderlessCount}
                </p>
                {leaderlessCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-warning-500"
                    />
                    {t("kpiAttentionBadge")}
                  </span>
                ) : isCompleteOrgDirectoryLoaded ? (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {t("kpiHealthyBadge")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("kpiAttentionHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                leaderlessCount > 0
                  ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              <AlertIcon viewBox="0 0 24 24" className="h-5 w-5" />
            </span>
          </div>

          {/* Card 4: Archived Projects */}
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiArchivedLabel")}
              </p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
                {archivedCount ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {archivedCount === undefined
                  ? t(
                      status !== "ARCHIVED" && archivedProjectsTotalQuery.isError
                        ? "kpiCountUnavailable"
                        : "kpiCountLoading",
                    )
                  : t("kpiArchivedHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <BoxIconLine viewBox="0 0 24 24" className="h-5 w-5" />
            </span>
          </div>
        </section>
      )}

      {/* Separated Status Tabs & Search/Sort Controls */}
      <div className="continuum-stagger-3 rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        {/* Top Row: Dedicated Status Tabs + Project Count & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-3.5 py-2.5 sm:px-4 dark:border-gray-800">
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
                      ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            {projects.isSuccess && !projects.isFetching && (
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                {t("totalProjects", {
                  count: projects.data.pagination.totalItems,
                })}
              </span>
            )}

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
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                  view === "grid"
                    ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <GridIcon
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                aria-label={t("listView")}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                  view === "list"
                    ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <ListIcon
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row: Clean Search + Visibility & Sort Controls */}
        <div className="flex flex-col gap-2.5 p-3 sm:p-4 @xl:flex-row @xl:items-center @xl:justify-between">
          <div className="relative min-w-0 flex-1 @xl:max-w-md">
            <label htmlFor="project-search" className="sr-only">
              {t("searchProjects")}
            </label>
            <SearchIcon
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              id="project-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 ps-9 pe-3.5 text-sm text-gray-800 shadow-theme-xs transition-all placeholder:text-gray-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:bg-gray-800/70 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:bg-gray-900"
            />
          </div>

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
                <FolderIcon viewBox="0 0 20 18" className="h-6 w-6" />
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
                  : "divide-y divide-gray-100 rounded-2xl border border-gray-200/90 bg-white px-5 py-2 shadow-theme-xs sm:px-6 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900"
              }
            >
              {filteredProjects.map((project, index) => (
                <li key={project.id} className="min-w-0">
                  <ProjectCard project={project} layout={view} index={index} />
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
          <PlusIcon
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          />
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
