"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import RoleLabel from "@/components/common/RoleLabel";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  FolderIcon,
  GroupIcon,
  LockIcon,
  MailIcon,
  SettingsIcon,
  UserIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { useOrganizationOverviewQuery } from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import { useProjectsQuery, type Project } from "@/lib/queries/projects/useProjects";

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "MG";
}

function getOrgInitials(name: string, slug: string): string {
  const source = name.trim() || slug.trim();
  const words = source.split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "OR";
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
      <div className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white p-5 xl:col-span-8 dark:border-gray-800 dark:bg-gray-900" />
        <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white p-5 xl:col-span-4 dark:border-gray-800 dark:bg-gray-900" />
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
  const format = useFormatter();
  const projects = useProjectsQuery(organizationId, { page: 1, pageSize: 6 });
  const items = projects.data?.data ?? [];
  const totalProjects = projects.data?.pagination.totalItems ?? 0;

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("title")}
        showTitle={false}
      />
      <section className="rounded-xl border border-gray-200/90 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
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

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3 dark:border-gray-800">
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiVisibleProjects")}
            </p>
            <p className="mt-1.5 text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">
              {projects.isPending ? "—" : format.number(totalProjects)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiActiveProjects")}
            </p>
            <p className="mt-1.5 text-2xl font-semibold text-success-600 tabular-nums dark:text-success-400">
              {projects.isPending
                ? "—"
                : format.number(
                    items.filter((project) => project.status === "ACTIVE")
                      .length,
                  )}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("roleColumn")}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <RoleLabel roleCode="MEMBER" />
              </span>
            </div>
          </div>
        </div>
      </section>
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
  const format = useFormatter();
  const overview = useOrganizationOverviewQuery(actorId, organizationId, true);
  const projectsQuery = useProjectsQuery(organizationId, {
    page: 1,
    pageSize: 6,
  });

  if (overview.isPending) {
    return <OverviewSkeleton label={t("loading")} />;
  }

  if (overview.isError || !overview.data) {
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

  const { organization, metrics, leaderlessProjects, managers } = overview.data;
  const isSoleManager = managers.length <= 1;
  const hasLeaderlessProjects = metrics.leaderlessProjectsCount > 0;
  const hasSuspendedMembers = metrics.suspendedMembers > 0;

  const projectRows: readonly Project[] =
    projectsQuery.data?.data ??
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

  return (
    <div className="@container min-w-0 space-y-6">
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("title")}
        items={[{ label: organization.name }]}
        showTitle={false}
      />

      {/* L1 Unboxed Enterprise Page Header */}
      <header
        aria-labelledby="org-overview-heading"
        className="flex flex-col justify-between gap-4 border-b border-gray-200/80 pb-5 lg:flex-row lg:items-center dark:border-gray-800"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold tracking-tight text-brand-600 ring-1 ring-brand-500/20 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25"
          >
            {getOrgInitials(organization.name, organization.slug)}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1
              id="org-overview-heading"
              className="truncate text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-white"
            >
              {organization.name}
            </h1>
            <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100/80 px-2 py-0.5 font-mono text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              @{organization.slug}
            </span>
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-gray-700 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {organization.plan}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-600/15 ring-inset dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
              <RoleLabel roleCode="ADMIN" />
            </span>
          </div>
        </div>

        {/* Disciplined Action Bar: 1 Primary CTA + 1 Secondary Outline CTA */}
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-start sm:flex-nowrap lg:self-center">
          <Link
            href="/organization/settings"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-semibold whitespace-nowrap text-gray-700 shadow-theme-xs transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <SettingsIcon
              viewBox="0 0 24 24"
              className="size-4 shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <span>{t("organizationSettingsCta")}</span>
          </Link>
          <Link
            href="/organization/members"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-500 px-3.5 text-xs font-semibold whitespace-nowrap text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <GroupIcon
              viewBox="0 0 24 24"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{t("manageMembersCta")}</span>
          </Link>
        </div>
      </header>

      {/* Conditional High-Priority Recovery Alert Banner (Only rendered when leaderlessProjectsCount > 0) */}
      {hasLeaderlessProjects && (
        <section
          role="alert"
          aria-labelledby="leaderless-projects-alert-title"
          className="rounded-xl border border-warning-300 bg-warning-50/90 p-4 shadow-theme-xs sm:p-5 dark:border-warning-500/40 dark:bg-warning-500/10"
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
              className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-lg bg-warning-600 px-3 text-xs font-semibold whitespace-nowrap text-white shadow-theme-xs transition hover:bg-warning-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-600 sm:self-center"
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
                  className="flex items-center justify-between gap-3 rounded-lg border border-warning-200/90 bg-white p-3 shadow-theme-xs dark:border-warning-500/25 dark:bg-gray-900"
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
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold whitespace-nowrap text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
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

      {/* 4-Column Executive KPI Strip (Strict Semantic Colors + Tabular Nums) */}
      <section
        aria-label={t("kpiSectionLabel")}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Active Members + Suspended Sub-metric */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiActiveMembers")}
              </span>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              >
                <GroupIcon viewBox="0 0 24 24" className="size-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {format.number(metrics.activeMembers)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
            <span
              className={`inline-flex items-center gap-1 font-medium whitespace-nowrap tabular-nums ${
                hasSuspendedMembers
                  ? "rounded-md bg-warning-50 px-2 py-0.5 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <LockIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0"
                aria-hidden="true"
              />
              <span>
                {t("suspendedCountLabel", {
                  count: format.number(metrics.suspendedMembers),
                })}
              </span>
            </span>
            <Link
              href="/organization/members"
              className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <span>{t("manageLink")}</span>
              <ArrowRightIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        {/* KPI 2: Pending Invitations */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiPendingInvitations")}
              </span>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              >
                <MailIcon viewBox="0 0 24 24" className="size-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {format.number(metrics.pendingInvitations)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
            <span className="whitespace-nowrap text-gray-500 tabular-nums dark:text-gray-400">
              {t("activeManagersCount", { count: managers.length })}
            </span>
            <Link
              href="/organization/members"
              className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <span>{t("manageLink")}</span>
              <ArrowRightIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        {/* KPI 3: Active Projects + Archived Sub-metric */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiActiveProjects")}
              </span>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              >
                <FolderIcon viewBox="0 0 20 18" className="size-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {format.number(metrics.activeProjects)}
              </span>
              <span className="text-sm font-medium text-gray-400 tabular-nums dark:text-gray-500">
                / {format.number(metrics.totalProjects)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
            <span className="whitespace-nowrap text-gray-500 tabular-nums dark:text-gray-400">
              {t("archivedCountLabel", {
                count: format.number(metrics.archivedProjects),
              })}
            </span>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <span>{t("viewDirectoryLink")}</span>
              <ArrowRightIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>

        {/* KPI 4: Projects Missing Leader (Semantic Health Indicator) */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpiLeaderlessProjects")}
              </span>
              <span
                aria-hidden="true"
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  hasLeaderlessProjects
                    ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
                    : "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
                }`}
              >
                {hasLeaderlessProjects ? (
                  <AlertIcon viewBox="0 0 24 24" className="size-4" />
                ) : (
                  <CheckCircleIcon viewBox="0 0 24 24" className="size-4" />
                )}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className={`text-3xl font-semibold tracking-tight tabular-nums ${
                  hasLeaderlessProjects
                    ? "text-error-600 dark:text-error-400"
                    : "text-success-600 dark:text-success-400"
                }`}
              >
                {format.number(metrics.leaderlessProjectsCount)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
            <span
              className={`font-medium ${
                hasLeaderlessProjects
                  ? "text-error-700 dark:text-error-300"
                  : "text-success-700 dark:text-success-300"
              }`}
            >
              {hasLeaderlessProjects
                ? t("leaderCoverageAttention", {
                    count: metrics.leaderlessProjectsCount,
                  })
                : t("leaderCoverageHealthy")}
            </span>
          </div>
        </div>
      </section>

      {/* Primary 12-Column Workspace: Left (8 cols) Project Governance Snapshot | Right (4 cols) Organization Managers */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* Left 8 Cols: Project Governance Snapshot Table */}
        <section
          aria-labelledby="org-projects-governance-heading"
          className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs xl:col-span-8 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2
              id="org-projects-governance-heading"
              className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t("projectsGovernanceTitle")}
            </h2>
            <Link
              href="/projects"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold whitespace-nowrap text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FolderIcon
                viewBox="0 0 20 18"
                className="size-3.5 shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <span>{t("projectsDirectoryCta")}</span>
              <ArrowRightIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0 text-gray-400 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>

          {projectsQuery.isPending && projectRows.length === 0 ? (
            <div className="space-y-3 p-5 sm:p-6">
              {Array.from({ length: 3 }, (_, idx) => (
                <div
                  key={idx}
                  className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : projectRows.length === 0 ? (
            <div className="m-5 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center sm:m-6 dark:border-gray-800 dark:bg-gray-800/30">
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                    <th
                      scope="col"
                      className="py-2.5 ps-4 pe-2.5 text-start 2xl:ps-5 2xl:pe-3"
                    >
                      {t("colProject")}
                    </th>
                    <th
                      scope="col"
                      className="px-2.5 py-2.5 text-end tabular-nums 2xl:px-3"
                    >
                      {t("colMembers")}
                    </th>
                    <th
                      scope="col"
                      className="px-2.5 py-2.5 text-start 2xl:px-3"
                    >
                      {t("colLeaders")}
                    </th>
                    <th
                      scope="col"
                      className="w-[1%] py-2.5 ps-2.5 pe-4 text-end whitespace-nowrap 2xl:ps-3 2xl:pe-5"
                    >
                      {t("colAction")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
                  {projectRows.map((project) => {
                    const leaderCount = project.effectiveLeaderCount ?? 0;
                    const isLeaderless =
                      project.status === "ACTIVE" && leaderCount === 0;
                    const leadersList = project.leaders ?? [];

                    return (
                      <tr
                        key={project.id}
                        className="transition hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                      >
                        <td className="py-3 ps-4 pe-2.5 2xl:ps-5 2xl:pe-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 font-mono text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              {project.code.slice(0, 3)}
                            </span>
                            <div className="min-w-0">
                              <Link
                                href={`/projects/${encodeURIComponent(project.id)}`}
                                className="block max-w-40 truncate font-semibold text-gray-900 hover:text-brand-600 xl:max-w-56 dark:text-white dark:hover:text-brand-400"
                              >
                                {project.name}
                              </Link>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
                                <span className="font-mono text-[11px] font-medium text-gray-600 tabular-nums dark:text-gray-300">
                                  {project.code}
                                </span>
                                <span aria-hidden="true">•</span>
                                <span
                                  className={`inline-flex items-center gap-1 font-medium ${
                                    project.status === "ACTIVE"
                                      ? "text-success-700 dark:text-success-400"
                                      : "text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`size-1.5 rounded-full ${
                                      project.status === "ACTIVE"
                                        ? "bg-success-500"
                                        : "bg-gray-400"
                                    }`}
                                  />
                                  {project.status === "ACTIVE"
                                    ? t("statusActive")
                                    : t("statusArchived")}
                                </span>
                                <span aria-hidden="true">•</span>
                                <span>
                                  {project.visibility === "PUBLIC"
                                    ? t("visibilityPublic")
                                    : t("visibilityPrivate")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-3 text-end font-medium text-gray-900 tabular-nums whitespace-nowrap 2xl:px-3 dark:text-white">
                          {format.number(project.activeMemberCount ?? 0)}
                        </td>
                        <td className="px-2.5 py-3 2xl:px-3">
                          {isLeaderless ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-warning-700 ring-1 ring-warning-600/20 ring-inset tabular-nums dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30">
                              <AlertIcon
                                viewBox="0 0 24 24"
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{t("zeroLeaderlessBadge")}</span>
                            </span>
                          ) : leadersList.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="max-w-28 truncate text-xs font-medium text-gray-800 2xl:max-w-36 dark:text-gray-200">
                                {leadersList
                                  .map((l) => l.fullName || l.email)
                                  .join(", ")}
                              </span>
                              <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-400">
                                {format.number(leaderCount)}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-success-700 tabular-nums dark:bg-success-500/15 dark:text-success-300">
                              {t("leadersAssignedCount", {
                                count: leaderCount,
                              })}
                            </span>
                          )}
                        </td>
                        <td className="py-3 ps-2.5 pe-4 text-end whitespace-nowrap 2xl:ps-3 2xl:pe-5">
                          <Link
                            href={`/projects/${encodeURIComponent(project.id)}/members`}
                            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition ${
                              isLeaderless
                                ? "bg-warning-600 text-white hover:bg-warning-700"
                                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            <span>
                              {isLeaderless
                                ? t("appointLeaderNow")
                                : t("manageLeadersAction")}
                            </span>
                            <ArrowRightIcon
                              viewBox="0 0 20 20"
                              className="size-3 shrink-0 rtl:rotate-180"
                              aria-hidden="true"
                            />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right 4 Cols: Active Organization Managers */}
        <section
          aria-labelledby="org-managers-roster-heading"
          className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs xl:col-span-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2
              id="org-managers-roster-heading"
              className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t("managersRosterTitle")}
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-brand-700 ring-1 ring-brand-600/15 ring-inset tabular-nums dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25">
              <UserIcon
                viewBox="0 0 20 20"
                className="size-3 shrink-0"
                aria-hidden="true"
              />
              <span>{format.number(managers.length)}</span>
            </span>
          </div>

          <ul className="divide-y divide-gray-100 px-5 dark:divide-gray-800">
            {managers.map((manager) => {
              const isSelf = manager.userId === actorId;
              return (
                <li
                  key={manager.userId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
                    >
                      {getInitials(manager.fullName, manager.email)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {manager.fullName || manager.email}
                        </span>
                        {isSelf && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                            {t("youBadge")}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {manager.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100 ring-inset dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
                      <RoleLabel roleCode="ADMIN" />
                    </span>
                    {isSoleManager && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        <LockIcon
                          viewBox="0 0 20 20"
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{t("soleManagerBadge")}</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function OrganizationOverviewDashboard() {
  const t = useTranslations("organizationOverview");
  const currentUser = useCurrentUserQuery();

  if (currentUser.isPending) {
    return <OverviewSkeleton label={t("loading")} />;
  }

  if (currentUser.isError || !currentUser.data) {
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

  const user = currentUser.data;
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
      <ManagerOverviewWorkspace
        key={`${user.id}:${organizationId}`}
        actorId={user.id}
        organizationId={organizationId}
      />
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
