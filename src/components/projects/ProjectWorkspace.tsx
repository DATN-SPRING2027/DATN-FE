"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  BookOpen,
  Calendar,
  FileText,
  Folder,
  Globe,
  Lock,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import {
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
  type ProjectList,
  type ProjectLeaderSummary,
} from "@/lib/queries/projects/useProjects";
import ProjectState from "./ProjectState";
import ProjectCard from "./ProjectCard";
import {
  MemberAvatarWithHoverCard,
  renderExplicitProjectIcon,
} from "./ProjectVisualIdentity";

const KEY_CHIP_DOT_COLORS = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-sky-500",
  "bg-rose-500",
] as const;

function isProjectLeaderless(project: Project): boolean {
  return (
    Boolean(project.requiresLeaderRecovery) ||
    (project.status === "ACTIVE" && project.effectiveLeaderCount === 0)
  );
}

function renderRowProjectIcon(project: Project, index: number) {
  const explicit = renderExplicitProjectIcon(
    project.icon,
    project.category,
    "size-4",
  );
  if (explicit) return explicit;
  const variant = index % 4;
  if (variant === 1) return <FileText aria-hidden="true" className="size-4" />;
  if (variant === 2) return <Calendar aria-hidden="true" className="size-4" />;
  if (variant === 3) return <BookOpen aria-hidden="true" className="size-4" />;
  return <Folder aria-hidden="true" className="size-4" />;
}

function TableMemberStack({
  members,
  totalCount,
}: {
  members: readonly ProjectLeaderSummary[];
  totalCount: number;
}) {
  const visible = members.slice(0, 4);
  const remaining = Math.max(0, totalCount - visible.length);

  if (visible.length === 0 && totalCount === 0) {
    return (
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
        —
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {visible.length > 0 && (
        <div className="flex -space-x-2">
          {visible.map((member, idx) => (
            <MemberAvatarWithHoverCard
              key={member.userId}
              userId={member.userId}
              fullName={member.fullName || member.email}
              email={member.email}
              avatarUrl={member.avatarUrl}
              roleCode={member.roleCode}
              index={idx}
              size="sm"
            />
          ))}
        </div>
      )}
      {remaining > 0 && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-gray-200 bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-600 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          +{remaining}
        </span>
      )}
    </div>
  );
}

function OrganizationProjects({ organizationId }: { organizationId: string }) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Project["status"]>();
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | Project["visibility"]
  >("all");
  const [onlyLeaderless, setOnlyLeaderless] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [sort, setSort] = useState<"updated" | "name" | "code">("updated");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const [cachedList, setCachedList] = useState<ProjectList | null>(null);
  if (
    projects.isSuccess &&
    !projects.isFetching &&
    projects.data &&
    cachedList !== projects.data
  ) {
    setCachedList(projects.data);
  }

  const activeList =
    projects.isSuccess && !projects.isFetching
      ? projects.data
      : !projects.isError
        ? cachedList
        : null;
  const isRefreshingList = projects.isFetching && activeList !== null;

  const loadedProjects = activeList?.data ?? [];
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

  const allVisibleSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every((item) => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProjects.map((item) => item.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const totalPages = Math.max(1, activeList?.pagination.totalPages ?? 1);

  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      {/* Leaderless Projects Warning Banner */}
      {activeList && !projects.isError && leaderlessCount > 0 && (
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

      {/* Unified "Project List" Outer Card (Matching Reference Layout with TailAdmin Tokens) */}
      <div className="continuum-stagger-3 rounded-2xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        {/* Card Header Row 1: "Project List" Heading + Segmented Status Tabs + Total Count + View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3.5 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white/90">
              {t("projectListTitle")}
            </h2>

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
          </div>

          <div className="flex items-center gap-2.5">
            {isRefreshingList && (
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50/70 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent dark:border-brand-300 dark:border-t-transparent"
                />
                <span>{t("loading")}</span>
              </span>
            )}
            {activeList && (
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                {t("totalProjects", {
                  count: activeList.pagination.totalItems,
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
            </div>
          </div>
        </div>

        {/* Card Header Row 2: Quick Search Input (⌘K) + Visibility & Sort Controls */}
        <div className="mt-3.5 flex flex-col gap-2.5 @xl:flex-row @xl:items-center @xl:justify-between">
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
              className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 ps-9 pe-12 text-xs sm:text-sm text-gray-800 shadow-theme-xs transition-all placeholder:text-gray-400 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:bg-gray-800/80 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-500 dark:focus:bg-gray-900"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center"
            >
              <kbd className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-gray-400 shadow-2xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
                ⌘K
              </kbd>
            </span>
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
              className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-theme-xs outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
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
              className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-theme-xs outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
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

        {/* Loading & Error states */}
        {(projects.isPending || projects.isFetching) && !activeList && (
          <div className="mt-4">
            <ProjectState />
          </div>
        )}
        {projects.isError && (
          <div className="mt-4">
            <ProjectState
              error={projects.error}
              retry={() => {
                void projects.refetch();
              }}
            />
          </div>
        )}

        {/* Loaded Table or Grid (kept mounted with soft opacity during filter/page revalidation to prevent screen flicker) */}
        {activeList && !projects.isError && (
          <div
            aria-busy={isRefreshingList || undefined}
            className={`mt-4 space-y-4 transition-opacity duration-150 ${
              isRefreshingList ? "pointer-events-none opacity-60" : "opacity-100"
            }`}
          >
            {activeList.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/40 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-800/30">
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
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/40 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800/30">
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
            ) : view === "grid" ? (
              <ul className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
                {filteredProjects.map((project, index) => (
                  <li key={project.id} className="min-w-0">
                    <ProjectCard
                      project={project}
                      layout="grid"
                      index={index}
                    />
                  </li>
                ))}

                {/* Dashed "Create new project" Card (Matching Reference Grid Design with TailAdmin Brand Accent) */}
                <li className="min-w-0">
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200/90 bg-gray-50/40 p-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/20 dark:border-gray-800 dark:bg-gray-800/30 dark:hover:border-brand-500/40">
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                    >
                      <PlusIcon viewBox="0 0 20 20" className="size-5" />
                    </span>
                    <h3 className="mt-3.5 text-base font-bold tracking-tight text-gray-900 dark:text-white/90">
                      {t("createCardTitle")}
                    </h3>
                    <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {t("createCardDescription")}
                    </p>
                    <button
                      type="button"
                      aria-label={t("createCardTitle")}
                      onClick={() => router.push("/projects/new")}
                      className="mt-5 inline-flex h-10 w-full max-w-[210px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-xs sm:text-sm font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      <PlusIcon
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                      <span>{t("create")}</span>
                    </button>
                  </div>
                </li>
              </ul>
            ) : (
              /* Inner Bordered Table (Matching Reference Design with TailAdmin Visual Tokens) */
              <div className="overflow-hidden rounded-xl border border-gray-200/90 dark:border-gray-800">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-gray-200/80 bg-gray-50/80 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400">
                        <th scope="col" className="w-11 py-3 ps-4 pe-2">
                          <input
                            type="checkbox"
                            aria-label={t("selectAllProjects")}
                            checked={allVisibleSelected}
                            onChange={toggleSelectAll}
                            className="size-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
                          />
                        </th>
                        <th scope="col" className="px-3 py-3">
                          {t("tableProjectName")}
                        </th>
                        <th scope="col" className="px-3 py-3">
                          {t("tableWorkspaceKey")}
                        </th>
                        <th scope="col" className="px-3 py-3">
                          {t("tableUpdatedDate")}
                        </th>
                        <th scope="col" className="px-3 py-3">
                          {t("tableAssignedTeam")}
                        </th>
                        <th scope="col" className="px-3 py-3">
                          {t("tableGovernance")}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          {t("tableStatus")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredProjects.map((project, index) => {
                        const isActive = project.status === "ACTIVE";
                        const isPrivate = project.visibility === "PRIVATE";
                        const isLeaderless = isProjectLeaderless(project);
                        const detailHref = `/projects/${encodeURIComponent(project.id)}`;
                        const formattedUpdated = format.dateTime(
                          new Date(project.updatedAt),
                          {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          },
                        );
                        const memberPreviews =
                          project.memberPreviews ?? project.leaders ?? [];
                        const memberCount =
                          project.activeMemberCount ?? memberPreviews.length;
                        const chipDotColor =
                          KEY_CHIP_DOT_COLORS[
                            index % KEY_CHIP_DOT_COLORS.length
                          ];

                        return (
                          <tr
                            key={project.id}
                            role="article"
                            className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                          >
                            {/* Col 1: Checkbox */}
                            <td className="py-3.5 ps-4 pe-2 align-middle">
                              <input
                                type="checkbox"
                                aria-label={`Select ${project.name}`}
                                checked={selectedIds.includes(project.id)}
                                onChange={() => toggleSelectOne(project.id)}
                                className="size-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
                              />
                            </td>

                            {/* Col 2: Project Name + Description */}
                            <td className="px-3 py-3.5 align-middle">
                              <div className="flex min-w-0 items-center gap-3">
                                {project.coverImageUrl?.trim() ? (
                                  <span
                                    aria-hidden="true"
                                    className="relative flex size-9 shrink-0 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={project.coverImageUrl.trim()}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  </span>
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  >
                                    {renderRowProjectIcon(project, index)}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <Link
                                    href={detailHref}
                                    className="block truncate text-sm font-semibold text-gray-900 transition-colors hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
                                  >
                                    {project.name}
                                  </Link>
                                  <p className="mt-0.5 max-w-[240px] truncate text-xs text-gray-500 dark:text-gray-400">
                                    {project.description || t("noDescription")}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Col 3: Workspace Key Chip (Styled like Reference 'Source Files' chip) */}
                            <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                              <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-gray-50/80 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                <span
                                  aria-hidden="true"
                                  className={`size-2 rounded-full ${chipDotColor}`}
                                />
                                <span className="font-mono font-semibold text-gray-800 dark:text-white">
                                  {project.code}
                                </span>
                                {project.category?.trim() && (
                                  <span className="text-gray-400 dark:text-gray-500">
                                    · {project.category.trim()}
                                  </span>
                                )}
                              </span>
                            </td>

                            {/* Col 4: Updated Date (Styled like Reference 'Due Date') */}
                            <td className="px-3 py-3.5 align-middle text-xs font-medium text-gray-600 whitespace-nowrap tabular-nums dark:text-gray-300">
                              <time dateTime={project.updatedAt}>
                                {t("updatedShort", { date: formattedUpdated })}
                              </time>
                            </td>

                            {/* Col 5: Assigned Team (Stacked Avatars with Portal Hover Card) */}
                            <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                              <TableMemberStack
                                members={memberPreviews}
                                totalCount={memberCount}
                              />
                            </td>

                            {/* Col 6: Access & Governance Bar (Styled like Reference 'Progress' bar) */}
                            <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div
                                  aria-hidden="true"
                                  className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                                >
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      !isActive
                                        ? "w-full bg-gray-400 dark:bg-gray-600"
                                        : isLeaderless
                                          ? "w-2/5 bg-warning-500"
                                          : "w-full bg-brand-500"
                                    }`}
                                  />
                                </div>
                                {isPrivate ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                    <Lock
                                      aria-hidden="true"
                                      className="size-3.5 shrink-0 text-gray-400 dark:text-gray-500"
                                    />
                                    <span>{t("PRIVATE")}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                                    <Globe
                                      aria-hidden="true"
                                      className="size-3.5 shrink-0"
                                    />
                                    <span>{t("PUBLIC")}</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Col 7: Status Pill (Styled like Reference 'Status' badge) */}
                            <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                              {!isActive ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-gray-500"
                                  />
                                  {t("archived")}
                                </span>
                              ) : isLeaderless ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300">
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-warning-500"
                                  />
                                  <span>{t("kpiAttentionBadge")}</span>
                                  <span className="sr-only">{t("active")}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400">
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-success-500"
                                  />
                                  {t("active")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Card Footer Pagination */}
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-3.5 @md:flex-row @md:items-center @md:justify-between dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 tabular-nums dark:text-gray-400">
                {t("pageOf", {
                  page: activeList.pagination.page,
                  total: totalPages,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isRefreshingList}
                  onClick={() => setPage(page - 1)}
                >
                  {t("previous")}
                </Button>
                <span
                  aria-current="page"
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-white shadow-theme-xs tabular-nums"
                >
                  {activeList.pagination.page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    page >= activeList.pagination.totalPages || isRefreshingList
                  }
                  onClick={() => setPage(page + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  const t = useTranslations("projects");
  const user = useCurrentUserQuery();
  const [showLearnMore, setShowLearnMore] = useState(false);

  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      {/* Top Hero Banner */}
      <header
        style={{
          backgroundImage: "url('/images/projects/projects-hero-banner.png')",
        }}
        className="relative overflow-hidden rounded-2xl border border-indigo-100/80 bg-[#f4f6fc] bg-cover bg-right bg-no-repeat px-6 py-7 shadow-theme-xs sm:px-8 sm:py-8 dark:border-gray-800 dark:bg-gray-900"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f4f6fc]/95 via-[#f4f6fc]/75 to-transparent sm:via-[#f4f6fc]/45 dark:from-gray-900/95 dark:via-gray-900/85 dark:to-gray-900/40"
        />
        <div className="relative z-10 max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-600 sm:text-base dark:text-gray-300">
            {t("workspaceHint")}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/projects/new"
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-xs sm:text-sm font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <PlusIcon
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <span>{t("create")}</span>
            </Link>
            <button
              type="button"
              aria-expanded={showLearnMore}
              onClick={() => setShowLearnMore((prev) => !prev)}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-200/90 bg-white/95 px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t("learnMore")}
            </button>
          </div>
        </div>
      </header>

      {showLearnMore && (
        <section className="rounded-2xl border border-brand-200/80 bg-brand-50/50 p-4 text-xs text-slate-700 shadow-2xs sm:p-5 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t("createBlueprintScopeLabel")}
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-gray-300">
                  {t("privateHint")}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t("work")} &amp; {t("workNotes")}
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-gray-300">
                  {t("workModuleDesc")}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t("projectContext")}
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-gray-300">
                  {t("leaderlessProjectsBannerDescription")}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

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
