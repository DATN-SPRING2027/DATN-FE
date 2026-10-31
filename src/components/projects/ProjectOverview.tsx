"use client";

import { useEffect, useState, type ReactNode } from "react";
import ProjectMembers from "./members/ProjectMembers";
import ProjectSettings from "./ProjectSettings";
import { Link } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { Project } from "@/lib/queries/projects/useProjects";
import { useProjectMembersQuery, useProjectMemberAddAccess } from "@/lib/queries/projects/useProjectMembers";
import { useProjectManagementAccess } from "@/lib/queries/projects/useProjectSettings";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { CalenderIcon, DocsIcon, HandShakeIcon } from "@/icons";

export type ProjectTab = "overview" | "members" | "settings" | "teams";

const VALID_TABS: readonly ProjectTab[] = [
  "overview",
  "members",
  "settings",
  "teams",
];

export function resolveTabFromPathname(
  pathname: string,
  projectId: string,
): ProjectTab | null {
  const clean = pathname.replace(/\/+$/, "");
  for (const prefix of [
    `/projects/${encodeURIComponent(projectId)}/`,
    `/projects/${projectId}/`,
  ]) {
    const idx = clean.indexOf(prefix);
    if (idx !== -1) {
      const rest = clean.slice(idx + prefix.length);
      if ((VALID_TABS as readonly string[]).includes(rest)) {
        return rest as ProjectTab;
      }
    }
  }
  return null;
}

export function syncProjectTabUrl(projectId: string, nextTab: ProjectTab) {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  const encodedMarker = `/projects/${encodeURIComponent(projectId)}`;
  const rawMarker = `/projects/${projectId}`;
  const marker = pathname.includes(encodedMarker)
    ? encodedMarker
    : pathname.includes(rawMarker)
      ? rawMarker
      : null;
  if (!marker) return;
  const idx = pathname.indexOf(marker);
  const basePath = pathname.slice(0, idx + marker.length);
  const targetPath = `${basePath}/${nextTab}${window.location.search}${window.location.hash}`;
  const currentFull = `${pathname}${window.location.search}${window.location.hash}`;
  if (currentFull !== targetPath) {
    window.history.replaceState(window.history.state, "", targetPath);
  }
  window.dispatchEvent(
    new CustomEvent("continuum:project-tab-sync", {
      detail: { projectId, tab: nextTab },
    }),
  );
}

export default function ProjectOverview({
  project,
  showTeams = false,
  teamPanel,
  initialTab = "overview",
  activeTab,
  onTabChange,
  canDeleteProject,
  onProjectDeleted,
}: {
  project: Project;
  showTeams?: boolean;
  teamPanel?: ReactNode;
  initialTab?: ProjectTab;
  activeTab?: ProjectTab;
  onTabChange?: (tab: ProjectTab) => void;
  canDeleteProject?: boolean;
  onProjectDeleted?: () => void;
}) {
  const t = useTranslations("projects");
  const format = useFormatter();
  const memberLabels = useTranslations("projectMembers");
  const management = useProjectManagementAccess(project.organizationId, project.id, project.status === "ACTIVE");
  // This existing endpoint uses the same project.members.add guard as the command.
  const memberAddAccess = useProjectMemberAddAccess(project.organizationId, project.id, project.status === "ACTIVE");
  const canAddMembers = project.status === "ACTIVE" && memberAddAccess.isSuccess;
  const hasProjectMemberCount =
    typeof project.activeMemberCount === "number";
  const memberSummary = useProjectMembersQuery(
    project.organizationId,
    project.id,
    { page: 1, pageSize: 1, status: "ACTIVE" },
    { enabled: !hasProjectMemberCount, staleTime: 15_000 },
  );
  const activeMemberTotal =
    project.activeMemberCount ??
    (memberSummary.isPending || memberSummary.isError
      ? undefined
      : memberSummary.data?.pagination.totalItems);
  const activeMemberValue =
    activeMemberTotal === undefined
      ? !hasProjectMemberCount && memberSummary.isPending
        ? memberLabels("loading")
        : t("memberDataUnavailable")
      : format.number(activeMemberTotal);
  const [internalTab, setInternalTab] = useState<ProjectTab>(
    initialTab === "teams" && !showTeams ? "overview" : initialTab,
  );
  const currentTab = activeTab ?? internalTab;
  const tab: ProjectTab =
    currentTab === "teams" && !showTeams ? "overview" : currentTab;
  const setTab = (next: ProjectTab) => {
    setInternalTab(next);
    onTabChange?.(next);
    syncProjectTabUrl(project.id, next);
  };
  useEffect(() => {
    syncProjectTabUrl(project.id, tab);
  }, [project.id, tab]);
  useEffect(() => {
    const handlePopState = () => {
      const fromUrl = resolveTabFromPathname(
        window.location.pathname,
        project.id,
      );
      if (fromUrl) {
        setInternalTab(fromUrl);
        onTabChange?.(fromUrl);
      }
    };
    const handleCustomTabChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ projectId?: string; tab?: ProjectTab }>
      ).detail;
      if (
        detail?.projectId === project.id &&
        detail.tab &&
        (VALID_TABS as readonly string[]).includes(detail.tab)
      ) {
        setInternalTab(detail.tab);
        onTabChange?.(detail.tab);
        syncProjectTabUrl(project.id, detail.tab);
      }
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener(
      "continuum:project-tab-change",
      handleCustomTabChange,
    );
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(
        "continuum:project-tab-change",
        handleCustomTabChange,
      );
    };
  }, [project.id, onTabChange]);
  const [showAddModal, setShowAddModal] = useState(false);
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });

  const isPrivate = project.visibility === "PRIVATE";
  const isActive = project.status === "ACTIVE";

  if (tab === "settings" && !management.canAccessSettings) {
    return (
      <ProjectSettings
        project={project}
        canDeleteProject={canDeleteProject}
        onDeleted={onProjectDeleted}
      />
    );
  }

  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label={t("breadcrumb")}
        className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      >
        <ol className="flex min-w-0 items-center gap-1.5">
          <li>
            <Link
              href="/projects"
              className="font-medium text-gray-500 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
            >
              {t("title")}
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">
            /
          </li>
          <li className="truncate font-semibold text-gray-800 dark:text-white/90">
            {project.name}
          </li>
        </ol>
      </nav>

      {/* Project header card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <header className="flex flex-col justify-between gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold tracking-tight text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
            >
              {project.code.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h1 className="max-w-full min-w-0 text-xl font-bold tracking-tight [overflow-wrap:anywhere] text-gray-900 sm:text-2xl dark:text-white/90">
                  {project.name}
                </h1>
                <span className="inline-flex shrink-0 items-center rounded-md border border-gray-200/80 bg-gray-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {project.code}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400"
                      : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-success-500" : "bg-gray-400"
                    }`}
                  />
                  {t(isActive ? "active" : "archived")}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                    isPrivate
                      ? "border-warning-200 bg-warning-50/70 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300"
                      : "border-blue-light-200 bg-blue-light-50/70 text-blue-light-700 dark:border-blue-light-500/20 dark:bg-blue-light-500/10 dark:text-blue-light-300"
                  }`}
                >
                  {isPrivate ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-3 w-3 shrink-0"
                    >
                      <rect
                        x="3.25"
                        y="7.25"
                        width="9.5"
                        height="6.5"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M5.25 7.25V5.25a2.75 2.75 0 1 1 5.5 0v2"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-3 w-3 shrink-0"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="5.75"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M2.5 8h11M8 2.25c1.6 1.55 2.4 3.47 2.4 5.75S9.6 12.2 8 13.75c-1.6-1.55-2.4-3.47-2.4-5.75S6.4 3.8 8 2.25Z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                  )}
                  {t(isPrivate ? "privateWorkspaceBadge" : "publicWorkspaceBadge")}
                </span>
              </div>
              <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {project.description || t("overviewHint")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {canAddMembers && <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-xl bg-white! px-3.5! py-2! text-xs font-semibold whitespace-nowrap shadow-theme-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-gray-800!"
              ariaLabel={memberLabels("openAdd")}
              startIcon={
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5 shrink-0"
                >
                  <path
                    d="M8 3.25v9.5M3.25 8h9.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              }
              onClick={() => {
                setTab("members");
                setShowAddModal(true);
              }}
            >
              {memberLabels("add")}
            </Button>}
          </div>
        </header>

      </div>

      <section
        aria-label={t("overview")}
        hidden={tab !== "overview"}
        className="space-y-5 sm:space-y-6"
      >
        {/* 4-Card B2B Metric Strip */}
        <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 @3xl:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("code")}
              </dt>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                >
                  <path
                    d="M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3M9 3.5l-2 9"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <dd className="mt-2 font-mono text-base font-semibold tracking-tight [overflow-wrap:anywhere] text-gray-900 dark:text-white/90">
              {project.code}
            </dd>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("codeMetricHint")}
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("visibility")}
              </dt>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  isPrivate
                    ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300"
                    : "bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-300"
                }`}
              >
                {isPrivate ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                  >
                    <rect
                      x="3.25"
                      y="7.25"
                      width="9.5"
                      height="6.5"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M5.25 7.25V5.25a2.75 2.75 0 1 1 5.5 0v2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="5.75"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M2.5 8h11M8 2.25c1.6 1.55 2.4 3.47 2.4 5.75S9.6 12.2 8 13.75c-1.6-1.55-2.4-3.47-2.4-5.75S6.4 3.8 8 2.25Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                )}
              </span>
            </div>
            <dd className="mt-2 text-base font-semibold [overflow-wrap:anywhere] text-gray-900 dark:text-white/90">
              {t(project.visibility)}
            </dd>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t(isPrivate ? "privateOverviewHint" : "publicOverviewHint")}
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("activeMembers")}
              </dt>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                >
                  <circle
                    cx="6.25"
                    cy="5.5"
                    r="2.25"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M2.5 12.75c0-1.9 1.68-3.25 3.75-3.25S10 10.85 10 12.75"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.75 4.25a2 2 0 0 1 0 3.75M13.5 12.75c0-1.45-1.05-2.65-2.5-3.05"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
            <dd
              aria-live="polite"
              className={`mt-2 text-base font-semibold [overflow-wrap:anywhere] text-gray-900 dark:text-white/90 ${
                activeMemberTotal !== undefined ? "tabular-nums" : ""
              }`}
            >
              {activeMemberValue}
            </dd>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t(isActive ? "statusActiveHint" : "statusArchivedHint")}
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("updatedAt")}
              </dt>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="5.75"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M8 5v3.25l2.25 1.25"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
            <dd className="mt-2 text-sm font-semibold tabular-nums [overflow-wrap:anywhere] text-gray-900 sm:text-base dark:text-white/90">
              <time dateTime={project.updatedAt}>{date(project.updatedAt)}</time>
            </dd>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("updatedMetricHint")}
            </p>
          </div>
        </dl>

        {/* Description + Workspace Modules */}
        <div className="min-w-0 space-y-5">
            <ComponentCard title={t("description")} className="min-w-0">
              <p className="text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {project.description || t("noDescription")}
              </p>
            </ComponentCard>

            <ComponentCard
              title={t("workspaceModulesTitle")}
              desc={t("workspaceModulesHint")}
              className="min-w-0"
            >
              <div className="grid grid-cols-1 gap-3.5 @md:grid-cols-2 @3xl:grid-cols-3">
                <Link
                  href={`/projects/${encodeURIComponent(project.id)}/work`}
                  aria-label={t("openWorkModule")}
                  className="group flex flex-col justify-between rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 transition-all hover:border-brand-300 hover:bg-white hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-brand-500/40 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <rect
                            x="2.25"
                            y="2.75"
                            width="11.5"
                            height="10.5"
                            rx="1.75"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M5.25 6.5h5.5M5.25 9.5h3.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="text-xs font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">
                        →
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                      {t("work")}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {t("workModuleDesc")}
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/projects/${encodeURIComponent(project.id)}/work-notes`}
                  aria-label={t("openWorkNotesModule")}
                  className="group flex flex-col justify-between rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 transition-all hover:border-brand-300 hover:bg-white hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-brand-500/40 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-300">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <path
                            d="M4 2.5h5.5L12.5 5.5v8a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M9 2.5v3h3M5.5 8.5h5M5.5 11h3.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="text-xs font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">
                        →
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                      {t("workNotes")}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {t("workNotesModuleDesc")}
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/projects/${encodeURIComponent(project.id)}/documents`}
                  aria-label={t("openProjectDocumentsModule")}
                  className="group flex flex-col justify-between rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 transition-all hover:border-brand-300 hover:bg-white hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-brand-500/40 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><DocsIcon aria-hidden="true" className="h-4 w-4" /></span>
                      <span className="text-xs font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">→</span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">{t("projectDocumentsTitle")}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t("projectDocumentsModuleDesc")}</p>
                  </div>
                </Link>

                <Link
                  href={`/projects/${encodeURIComponent(project.id)}/work-reports`}
                  aria-label={t("openWorkReportsModule")}
                  className="group flex flex-col justify-between rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 transition-all hover:border-brand-300 hover:bg-white hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-brand-500/40 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300"><CalenderIcon aria-hidden="true" className="h-4 w-4" /></span>
                      <span className="text-xs font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">→</span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">{t("workReportsTitle")}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t("workReportsModuleDesc")}</p>
                  </div>
                </Link>

                <Link
                  href={`/projects/${encodeURIComponent(project.id)}/handover`}
                  aria-label={t("openHandoverModule")}
                  className="group flex flex-col justify-between rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 transition-all hover:border-brand-300 hover:bg-white hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-brand-500/40 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><HandShakeIcon aria-hidden="true" className="h-4 w-4" /></span>
                      <span className="text-xs font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">→</span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">{t("handoverTitle")}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t("handoverModuleDesc")}</p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setTab("members")}
                  aria-label={t("openMembersModule")}
                  className="group flex cursor-pointer flex-col justify-between rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 text-start transition-all hover:border-brand-300 hover:bg-white hover:shadow-theme-xs dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-brand-500/40 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <circle
                            cx="6.25"
                            cy="5.5"
                            r="2.25"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M2.5 12.75c0-1.9 1.68-3.25 3.75-3.25S10 10.85 10 12.75"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                          <path
                            d="M10.75 4.25a2 2 0 0 1 0 3.75M13.5 12.75c0-1.45-1.05-2.65-2.5-3.05"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span className="text-xs font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">
                        →
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                      {memberLabels("title")}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {t("membersModuleDesc")}
                    </p>
                  </div>
                </button>
              </div>
            </ComponentCard>
        </div>
      </section>

      {tab === "members" && (
        <section aria-label={memberLabels("title")}>
          <ProjectMembers
            projectId={project.id}
            showAddButton={false}
            addModalOpen={showAddModal}
            onOpenAdd={() => setShowAddModal(true)}
            onCloseAdd={() => setShowAddModal(false)}
          />
        </section>
      )}
      {tab === "settings" && (
        <section
          aria-label={t("settings")}
          tabIndex={0}
          className="space-y-5"
        >
          <ProjectSettings
            project={project}
            canDeleteProject={canDeleteProject}
            onDeleted={onProjectDeleted}
          />
        </section>
      )}
      {showTeams && tab === "teams" && (
        <section
          aria-label={t("teams")}
          tabIndex={0}
          className="min-w-0"
        >
          {teamPanel}
        </section>
      )}
    </div>
  );
}
