"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import RoleLabel from "@/components/common/RoleLabel";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  ArrowRightIcon,
  FolderIcon,
  GroupIcon,
  LockIcon,
  MailIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { useOrganizationOverviewQuery } from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import { useProjectsQuery, type Project } from "@/lib/queries/projects/useProjects";
import {
  MemberAvatarWithHoverCard,
  ProjectDirectoryRow,
} from "@/components/projects/ProjectVisualIdentity";

function formatRelativeDays(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "1 day ago";
  const diffMs = Math.max(0, Date.now() - parsed);
  const diffDays = Math.max(1, Math.floor(diffMs / 86_400_000));
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}

function OverviewSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="space-y-6"
    >
      <span className="sr-only">{label}</span>
      <div className="h-44 motion-safe:animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 motion-safe:animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="h-72 motion-safe:animate-pulse rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-8 dark:border-gray-800 dark:bg-gray-900" />
        <div className="h-72 motion-safe:animate-pulse rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-4 dark:border-gray-800 dark:bg-gray-900" />
      </div>
    </div>
  );
}

function MemberWorkspaceOverview({
  organizationId,
  fullName,
}: {
  organizationId: string;
  fullName?: string;
}) {
  const t = useTranslations("organizationOverview");
  const projects = useProjectsQuery(organizationId, { page: 1, pageSize: 6 });
  const items = projects.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("title")}
        showTitle={false}
      />
      <section className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              {t("workspaceBadge")}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white">
              {fullName ? t("welcomeUser", { name: fullName }) : t("title")}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              {t("memberSubtitle")}
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-3.5 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <FolderIcon viewBox="0 0 20 18" className="size-4" aria-hidden="true" />
            <span>{t("openProjectsDirectory")}</span>
          </Link>
        </div>
      </section>

      {items.length > 0 && (
        <section
          aria-labelledby="member-projects-heading"
          className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="text-indigo-600 dark:text-indigo-400"
              >
                <FolderIcon viewBox="0 0 20 18" className="size-5" />
              </span>
              <h2
                id="member-projects-heading"
                className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {t("projectsSectionTitle")}
              </h2>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <span>{t("viewAll")}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((project, index) => (
              <ProjectDirectoryRow
                key={project.id}
                project={project}
                index={index}
                statusLabel={
                  project.status === "ACTIVE"
                    ? t("statusActive")
                    : t("statusArchived")
                }
                visibilityLabel={
                  project.visibility === "PUBLIC"
                    ? t("visibilityPublic")
                    : t("visibilityPrivate")
                }
                memberCountLabel={t("memberCountLabel", {
                  count: project.activeMemberCount ?? 0,
                })}
                actionHref={`/projects/${encodeURIComponent(project.id)}`}
                actionAriaLabel={project.name}
                fallbackMemberName={fullName}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ManagerOverviewWorkspace({
  actorId,
  organizationId,
}: {
  actorId: string;
  organizationId: string;
}) {
  const t = useTranslations("organizationOverview");
  const common = useTranslations("common");
  const format = useFormatter();
  const overview = useOrganizationOverviewQuery(actorId, organizationId, true);
  const projectsQuery = useProjectsQuery(organizationId, {
    page: 1,
    pageSize: 6,
  });
  const overviewAccessLost = isAccessOrResourceUnavailableError(overview.error);
  const projectsAccessLost = isAccessOrResourceUnavailableError(projectsQuery.error);
  const visibleOverview = overviewAccessLost ? undefined : overview.data;
  const visibleProjects = projectsAccessLost ? undefined : projectsQuery.data;

  if (overview.isPending && !visibleOverview) {
    return <OverviewSkeleton label={t("loading")} />;
  }

  if (overview.isError && !visibleOverview) {
    return (
      <div role="alert" className="space-y-4">
        <Alert
          variant="error"
          title={t("errorTitle")}
          message={t("errorDescription")}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void overview.refetch();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  const { organization, metrics, leaderlessProjects, managers } = visibleOverview!;
  const isSoleManager = managers.length <= 1;
  const hasLeaderlessProjects = metrics.leaderlessProjectsCount > 0;

  const projectRows: readonly Project[] = projectsAccessLost
    ? []
    : visibleProjects?.data ??
    leaderlessProjects.map((item) => ({
      id: item.id,
      organizationId,
      name: item.name,
      code: item.code,
      visibility: item.visibility,
      status: item.status,
      createdBy: "",
      createdAt: item.updatedAt,
      updatedAt: item.updatedAt,
      activeMemberCount: item.activeMemberCount,
      effectiveLeaderCount: item.effectiveLeaderCount,
      leaders: [],
      requiresLeaderRecovery: true,
    }));

  const primaryManagerName =
    managers[0]?.fullName || managers[0]?.email || "Organization Manager";

  return (
    <div className="@container min-w-0 space-y-5" aria-busy={overview.isFetching}>
      {!overviewAccessLost && overview.isFetching && <UpdatingStatus>{t("loading")}</UpdatingStatus>}
      {!overviewAccessLost && overview.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={t("retry")}
          onRetry={() => void overview.refetch()}
        >
          {t("errorDescription")}
        </BackgroundRefreshError>
      )}
      {/* 1. Hero Banner Section */}
      <header
        aria-labelledby="org-overview-heading"
        style={{
          backgroundImage: "url('/images/organization/overview-hero-banner.png')",
        }}
        className="relative overflow-hidden rounded-2xl border border-indigo-100/80 bg-white bg-cover bg-right bg-no-repeat px-6 py-7 shadow-theme-xs sm:px-8 sm:py-9 dark:border-gray-800 dark:bg-gray-900"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/90 via-white/55 to-transparent lg:from-white/65 lg:via-white/20 lg:to-transparent dark:from-gray-900/95 dark:via-gray-900/80 dark:to-gray-900/40"
        />
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 max-w-xl flex-1">
            {/* Breadcrumb inside Hero */}
            <nav
              aria-label={t("title")}
              className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              <Link
                href="/"
                className="transition hover:text-gray-800 dark:hover:text-gray-200"
              >
                {t("home")}
              </Link>
              <span aria-hidden="true">›</span>
              <span>{t("breadcrumbOrganization")}</span>
              <span aria-hidden="true">›</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {t("breadcrumbOverview")}
              </span>
            </nav>

            {/* Organization Title */}
            <h1
              id="org-overview-heading"
              className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
            >
              {organization.name}
            </h1>

            {/* Metadata Pills Row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-lg bg-slate-200/75 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-gray-800 dark:text-gray-300">
                @{organization.slug}
              </span>
              <span className="inline-flex items-center rounded-lg border border-gray-200/90 bg-white px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {organization.plan}
              </span>
              <span className="inline-flex items-center rounded-lg bg-brand-100/90 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                <RoleLabel roleCode="ADMIN" />
              </span>
            </div>

            {/* Accent Bar & Tagline */}
            <div
              aria-hidden="true"
              className="mt-4 h-1 w-8 rounded-full bg-slate-800 dark:bg-white/80"
            />
            <p className="mt-3 max-w-xl text-sm text-slate-600 dark:text-gray-300">
              {organization.description || t("heroDefaultTagline")}
            </p>
          </div>
        </div>
      </header>

      {/* Conditional High-Priority Recovery Alert Banner (When leaderlessProjectsCount > 0) */}
      {hasLeaderlessProjects && (
        <section
          role="alert"
          aria-labelledby="leaderless-projects-alert-title"
          className="rounded-2xl border border-warning-300 bg-warning-50/90 p-4 shadow-theme-xs sm:p-5 dark:border-warning-500/40 dark:bg-warning-500/10"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300"
              >
                <AlertIcon viewBox="0 0 24 24" className="size-4" />
              </span>
              <h2
                id="leaderless-projects-alert-title"
                className="text-sm font-semibold text-warning-900 sm:text-base dark:text-warning-200"
              >
                {t("leaderlessAlertTitle", {
                  count: metrics.leaderlessProjectsCount,
                })}
              </h2>
            </div>
            <Link
              href="/projects"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg bg-warning-600 px-3 text-xs font-semibold whitespace-nowrap text-white shadow-theme-xs transition hover:bg-warning-700 sm:self-center"
            >
              <span>{t("reviewAllProjects")}</span>
              <ArrowRightIcon
                viewBox="0 0 20 20"
                className="size-3.5 shrink-0 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>

          {leaderlessProjects.length > 0 && (
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {leaderlessProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-warning-200/90 bg-white p-3 shadow-theme-xs dark:border-warning-500/25 dark:bg-gray-900"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {project.name}
                      </span>
                      <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {project.code}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-warning-700 tabular-nums dark:text-warning-300">
                      {t("leaderlessCardMeta", {
                        members: project.activeMemberCount,
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/projects/${encodeURIComponent(project.id)}/members`}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold whitespace-nowrap text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    <span>{t("appointLeaderNow")}</span>
                    <ArrowRightIcon
                      viewBox="0 0 20 20"
                      className="size-3.5 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. 4-Column Horizontal KPI Strip */}
      <section
        aria-label={t("kpiSectionLabel")}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Active members */}
        <Link
          href="/organization/members"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-theme-xs transition hover:border-indigo-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500/40"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              <GroupIcon viewBox="0 0 24 24" className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {format.number(metrics.activeMembers)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiActiveMembers")}
              </p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50/80 text-indigo-600 transition group-hover:translate-x-0.5 group-hover:bg-indigo-100 dark:bg-gray-800 dark:text-indigo-300"
          >
            ›
          </span>
        </Link>

        {/* KPI 2: Pending invitations */}
        <Link
          href="/organization/members"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-theme-xs transition hover:border-amber-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-amber-500/40"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300"
            >
              <MailIcon viewBox="0 0 24 24" className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {format.number(metrics.pendingInvitations)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiPendingInvitations")}
              </p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50/80 text-indigo-600 transition group-hover:translate-x-0.5 group-hover:bg-indigo-100 dark:bg-gray-800 dark:text-indigo-300"
          >
            ›
          </span>
        </Link>

        {/* KPI 3: Active projects */}
        <Link
          href="/projects"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-theme-xs transition hover:border-purple-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-500/40"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300"
            >
              <FolderIcon viewBox="0 0 20 18" className="size-5" />
            </span>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white">
                  {format.number(metrics.activeProjects)}
                </span>
                <span className="text-sm font-semibold text-gray-400 tabular-nums dark:text-gray-500">
                  / {format.number(metrics.totalProjects)}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiActiveProjects")}
              </p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50/80 text-indigo-600 transition group-hover:translate-x-0.5 group-hover:bg-indigo-100 dark:bg-gray-800 dark:text-indigo-300"
          >
            ›
          </span>
        </Link>

        {/* KPI 4: Projects missing leader */}
        <Link
          href="/projects"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-theme-xs transition hover:border-emerald-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-500/40"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                hasLeaderlessProjects
                  ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3 19 6v5.5c0 4.8-3 8.2-7 9.5-4-1.3-7-4.7-7-9.5V6l7-3Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m9.5 12 1.8 1.8 3.5-3.6"
                />
              </svg>
            </span>
            <div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {format.number(metrics.leaderlessProjectsCount)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiLeaderlessProjects")}
              </p>
            </div>
          </div>
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50/80 text-indigo-600 transition group-hover:translate-x-0.5 group-hover:bg-indigo-100 dark:bg-gray-800 dark:text-indigo-300"
          >
            ›
          </span>
        </Link>
      </section>

      {/* 3. Main 2-Column Asymmetric Content Grid */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* Left 8 Columns: Projects Card + Recent Activity Card */}
        <div className="space-y-6 xl:col-span-8">
          {/* Card A: Projects */}
          <section
            aria-labelledby="org-projects-governance-heading"
            aria-busy={projectsQuery.isFetching}
            className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="text-indigo-600 dark:text-indigo-400"
                >
                  <FolderIcon viewBox="0 0 20 18" className="size-5" />
                </span>
                <h2
                  id="org-projects-governance-heading"
                  className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {t("projectsSectionTitle")}
                </h2>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <span>{t("viewAll")}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            {visibleProjects !== undefined &&
              !projectsAccessLost &&
              (projectsQuery.isFetching || projectsQuery.isRefetchError) && (
                <div className="mb-3">
                  {projectsQuery.isFetching && (
                    <UpdatingStatus>{common("updating")}</UpdatingStatus>
                  )}
                  {projectsQuery.isRefetchError && (
                    <BackgroundRefreshError
                      retryLabel={common("retry")}
                      onRetry={() => void projectsQuery.refetch()}
                    >
                      {common("updateFailed")}
                    </BackgroundRefreshError>
                  )}
                </div>
              )}
            {projectsQuery.isError && !visibleProjects && (
              <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
                <span>{t("projectListLoadFailed")}</span>
                <Button size="sm" variant="outline" onClick={() => void projectsQuery.refetch()}>
                  {t("retry")}
                </Button>
              </div>
            )}
            {projectsQuery.isPending && projectRows.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }, (_, idx) => (
                  <div
                    key={idx}
                    className="h-20 motion-safe:animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                  />
                ))}
              </div>
            ) : projectsQuery.isError && !visibleProjects ? null : projectRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center dark:border-gray-800 dark:bg-gray-800/30">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("noProjectsYetTitle")}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("noProjectsYetDescription")}
                </p>
                <Link
                  href="/projects"
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white transition hover:bg-brand-600"
                >
                  <span>{t("projectsDirectoryCta")}</span>
                  <ArrowRightIcon
                    viewBox="0 0 20 20"
                    className="size-3.5 shrink-0 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {projectRows.map((project, index) => {
                  const leaderCount = project.effectiveLeaderCount ?? 0;
                  const isLeaderless =
                    project.status === "ACTIVE" && leaderCount === 0;
                  const memberCount = project.activeMemberCount ?? 0;

                  return (
                    <ProjectDirectoryRow
                      key={project.id}
                      project={project}
                      index={index}
                      statusLabel={
                        project.status === "ACTIVE"
                          ? t("statusActive")
                          : t("statusArchived")
                      }
                      visibilityLabel={
                        project.visibility === "PUBLIC"
                          ? t("visibilityPublic")
                          : t("visibilityPrivate")
                      }
                      memberCountLabel={t("memberCountLabel", {
                        count: memberCount,
                      })}
                      actionHref={`/projects/${encodeURIComponent(project.id)}/members`}
                      actionAriaLabel={
                        isLeaderless
                          ? t("appointLeaderNow")
                          : t("manageLeadersAction")
                      }
                      fallbackMemberName={primaryManagerName}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Card B: Recent activity */}
          <section
            aria-labelledby="org-recent-activity-heading"
            className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="size-5 text-indigo-600 dark:text-indigo-400"
                >
                  <circle cx="10" cy="10" r="7.5" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6v4l2.5 1.5"
                  />
                </svg>
                <h2
                  id="org-recent-activity-heading"
                  className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {t("recentActivityTitle")}
                </h2>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <span>{t("viewAll")}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <li className="flex items-center justify-between gap-3 py-3 first:pt-1">
                <div className="flex min-w-0 items-center gap-3 text-gray-700 dark:text-gray-300">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  >
                    <GroupIcon viewBox="0 0 24 24" className="size-4" />
                  </span>
                  <span className="truncate">
                    {t("activityCreatedOrg", { actor: primaryManagerName })}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-gray-400 tabular-nums dark:text-gray-500">
                  {formatRelativeDays(organization.createdAt)}
                </span>
              </li>

              {projectRows.slice(0, 3).map((project) => (
                <li
                  key={`activity-${project.id}`}
                  className="flex items-center justify-between gap-3 py-3 last:pb-1"
                >
                  <div className="flex min-w-0 items-center gap-3 text-gray-700 dark:text-gray-300">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    >
                      <FolderIcon viewBox="0 0 20 18" className="size-3.5" />
                    </span>
                    <span className="truncate">
                      {t("activityCreatedProject")}{" "}
                      <strong className="font-semibold text-gray-900 dark:text-white">
                        {project.name}
                      </strong>
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400 tabular-nums dark:text-gray-500">
                    {formatRelativeDays(project.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right 4 Columns: Organization members + Recent invitations */}
        <div className="space-y-6 xl:col-span-4">
          {/* Card C: Organization members */}
          <section
            aria-labelledby="org-managers-roster-heading"
            className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="text-indigo-600 dark:text-indigo-400"
                >
                  <GroupIcon viewBox="0 0 24 24" className="size-5" />
                </span>
                <h2
                  id="org-managers-roster-heading"
                  className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {t("orgMembersSectionTitle")}
                </h2>
              </div>
              <Link
                href="/organization/members"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <span>{t("manageLink")}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {managers.map((manager, idx) => {
                const isSelf = manager.userId === actorId;
                return (
                  <div
                    key={manager.userId}
                    className="relative flex items-center"
                  >
                    <MemberAvatarWithHoverCard
                      userId={manager.userId}
                      fullName={manager.fullName}
                      email={manager.email}
                      roleCode="ADMIN"
                      youBadgeLabel={isSelf ? t("youBadge") : undefined}
                      size="lg"
                      index={idx}
                    />
                    {isSoleManager && (
                      <span className="sr-only">
                        <LockIcon
                          viewBox="0 0 20 20"
                          className="size-3"
                          aria-hidden="true"
                        />
                        {t("soleManagerBadge")}
                      </span>
                    )}
                  </div>
                );
              })}

              <Link
                href="/organization/members"
                aria-label={t("inviteMembersButton")}
                className="flex size-11 items-center justify-center rounded-full border border-dashed border-gray-300 text-lg font-medium text-gray-500 transition hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-500/50"
              >
                +
              </Link>
            </div>
          </section>

          {/* Card D: Recent invitations */}
          <section
            aria-labelledby="org-recent-invitations-heading"
            className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="text-indigo-600 dark:text-indigo-400"
                >
                  <MailIcon viewBox="0 0 24 24" className="size-5" />
                </span>
                <h2
                  id="org-recent-invitations-heading"
                  className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white"
                >
                  {t("recentInvitationsTitle")}
                </h2>
              </div>
              <Link
                href="/organization/members"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <span>{t("viewAll")}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-8 text-center dark:border-gray-800 dark:bg-gray-800/40">
              <span
                aria-hidden="true"
                className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white text-gray-500 shadow-2xs ring-1 ring-gray-200/80 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
              >
                <MailIcon viewBox="0 0 24 24" className="size-5" />
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {metrics.pendingInvitations === 0
                  ? t("noPendingInvitationsTitle")
                  : t("pendingInvitationsSummary", {
                      count: metrics.pendingInvitations,
                    })}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("noPendingInvitationsDesc")}
              </p>
              <Link
                href="/organization/members"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-50 px-4 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30"
              >
                <GroupIcon viewBox="0 0 24 24" className="size-4" />
                <span>{t("inviteMembersButton")}</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationOverviewDashboard() {
  const t = useTranslations("organizationOverview");
  const currentUser = useCurrentUserQuery();
  const currentUserAccessLost = isAccessOrResourceUnavailableError(currentUser.error);
  const visibleUser = currentUserAccessLost ? undefined : currentUser.data;

  if (currentUser.isPending && !visibleUser) {
    return <OverviewSkeleton label={t("loading")} />;
  }

  if (currentUser.isError && !visibleUser) {
    return (
      <div role="alert" className="space-y-4">
        <Alert
          variant="error"
          title={t("errorTitle")}
          message={t("errorDescription")}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void currentUser.refetch();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  const user = visibleUser!;
  const organizationId = user.organizationId;
  if (!organizationId || !isOrganizationResourceId(organizationId)) {
    return (
      <div
        role="status"
        className="rounded-xl border border-warning-200 bg-warning-50 p-6 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
      >
        {t("noOrganization")}
      </div>
    );
  }

  if (canReadOrganizationMemberships(user)) {
    return (
      <div className="space-y-4" aria-busy={currentUser.isFetching}>
        {!currentUserAccessLost && currentUser.isFetching && <UpdatingStatus>{t("loading")}</UpdatingStatus>}
        {!currentUserAccessLost && currentUser.isRefetchError && (
          <BackgroundRefreshError
            retryLabel={t("retry")}
            onRetry={() => void currentUser.refetch()}
          >
            {t("errorDescription")}
          </BackgroundRefreshError>
        )}
        <ManagerOverviewWorkspace
          key={`${user.id}:${organizationId}`}
          actorId={user.id}
          organizationId={organizationId}
        />
      </div>
    );
  }

  return (
    <MemberWorkspaceOverview
      key={`${user.id}:${organizationId}:member`}
      organizationId={organizationId}
      fullName={user.name}
    />
  );
}
