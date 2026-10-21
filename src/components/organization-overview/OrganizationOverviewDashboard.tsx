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
  EyeIcon,
  FolderIcon,
  GroupIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  SettingsIcon,
  TimeIcon,
  UserIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { canReadOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { useOrganizationOverviewQuery } from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "MG";
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
      <div className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          />
        ))}
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
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">
              {t("workspaceBadge")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white/90">
              {fullName ? t("welcomeUser", { name: fullName }) : t("title")}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              {t("memberSubtitle")}
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <FolderIcon className="size-4" aria-hidden="true" />
            <span>{t("openProjectsDirectory")}</span>
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3 dark:border-gray-800">
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiVisibleProjects")}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums dark:text-white/90">
              {projects.isPending ? "—" : format.number(totalProjects)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiActiveProjects")}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-success-600 tabular-nums dark:text-success-400">
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

  return (
    <div className="@container min-w-0 space-y-6">
      <PageBreadcrumb
        pageTitle={t("title")}
        homeLabel={t("home")}
        breadcrumbLabel={t("title")}
        items={[{ label: organization.name }]}
        showTitle={false}
      />

      {/* Organization Governance Hero Header */}
      <section
        aria-labelledby="org-overview-heading"
        className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                <RoleLabel roleCode="ADMIN" />
                <span>•</span>
                <span>{t("governanceWorkspace")}</span>
              </span>
              <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                @{organization.slug}
              </span>
              <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-400">
                {organization.plan}
              </span>
            </div>
            <h1
              id="org-overview-heading"
              className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white/90"
            >
              {organization.name}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {organization.description || t("defaultDescription")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <Link
              href="/organization/members"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:text-sm"
            >
              <GroupIcon className="size-4" aria-hidden="true" />
              <span>{t("manageMembersCta")}</span>
            </Link>
            <Link
              href="/projects"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FolderIcon className="size-4" aria-hidden="true" />
              <span>{t("projectsDirectoryCta")}</span>
            </Link>
            <Link
              href="/organization/settings"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <SettingsIcon className="size-4" aria-hidden="true" />
              <span>{t("organizationSettingsCta")}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Leaderless Projects Recovery Alert Banner */}
      {metrics.leaderlessProjectsCount > 0 ? (
        <section
          role="alert"
          aria-labelledby="leaderless-projects-alert-title"
          className="rounded-2xl border border-warning-300 bg-warning-50/90 p-5 shadow-theme-xs dark:border-warning-500/40 dark:bg-warning-500/10"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300"
              >
                <AlertIcon className="size-5" />
              </span>
              <div className="space-y-1">
                <h2
                  id="leaderless-projects-alert-title"
                  className="text-base font-semibold text-warning-900 dark:text-warning-200"
                >
                  {t("leaderlessAlertTitle", {
                    count: metrics.leaderlessProjectsCount,
                  })}
                </h2>
                <p className="text-sm text-warning-800 dark:text-warning-300/90">
                  {t("leaderlessAlertDescription")}
                </p>
              </div>
            </div>
            <Link
              href="/projects"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl bg-warning-600 px-3.5 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-warning-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-600"
            >
              <span>{t("reviewAllProjects")}</span>
              <ArrowRightIcon className="size-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          {leaderlessProjects.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {leaderlessProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-warning-200/90 bg-white p-3.5 shadow-theme-xs dark:border-warning-500/25 dark:bg-gray-900"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                        {project.name}
                      </span>
                      <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {project.code}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-warning-700 tabular-nums dark:text-warning-300">
                      {t("leaderlessCardMeta", {
                        members: project.activeMemberCount,
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/projects/${encodeURIComponent(project.id)}/members`}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
                  >
                    <span>{t("appointLeaderNow")}</span>
                    <ArrowRightIcon
                      className="size-3.5 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-success-200 bg-success-50/70 px-5 py-3.5 text-sm text-success-800 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-300"
        >
          <div className="flex items-center gap-3">
            <CheckCircleIcon
              className="size-5 shrink-0 text-success-600 dark:text-success-400"
              aria-hidden="true"
            />
            <span className="font-medium">{t("allProjectsHaveLeaders")}</span>
          </div>
          <span className="text-xs font-semibold tabular-nums">
            {t("zeroLeaderlessBadge")}
          </span>
        </div>
      )}

      {/* 6-Card Real KPI Grid */}
      <section
        aria-label={t("kpiSectionLabel")}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiActiveMembers")}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
              {format.number(metrics.activeMembers)}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("kpiActiveMembersHint")}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
          >
            <GroupIcon className="size-5" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiPendingInvitations")}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-brand-600 tabular-nums dark:text-brand-400">
              {format.number(metrics.pendingInvitations)}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("kpiPendingInvitationsHint")}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <MailIcon className="size-5" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiSuspendedMembers")}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-warning-600 tabular-nums dark:text-warning-400">
              {format.number(metrics.suspendedMembers)}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("kpiSuspendedMembersHint")}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400"
          >
            <LockIcon className="size-5" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiActiveProjects")}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 tabular-nums dark:text-white/90">
              {format.number(metrics.activeProjects)}
              <span className="ms-1.5 text-sm font-normal text-gray-400">
                / {format.number(metrics.totalProjects)}
              </span>
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("kpiActiveProjectsHint")}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-400"
          >
            <FolderIcon className="size-5" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiArchivedProjects")}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-700 tabular-nums dark:text-gray-300">
              {format.number(metrics.archivedProjects)}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("kpiArchivedProjectsHint")}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <TimeIcon className="size-5" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("kpiLeaderlessProjects")}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${
                metrics.leaderlessProjectsCount > 0
                  ? "text-error-600 dark:text-error-400"
                  : "text-success-600 dark:text-success-400"
              }`}
            >
              {format.number(metrics.leaderlessProjectsCount)}
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("kpiLeaderlessProjectsHint")}
            </p>
          </div>
          <span
            aria-hidden="true"
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
              metrics.leaderlessProjectsCount > 0
                ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
                : "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
            }`}
          >
            <AlertIcon className="size-5" />
          </span>
        </div>
      </section>

      {/* Two-Column Governance Roster & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Active Organization Managers & Last-Manager Protection */}
        <section
          aria-labelledby="org-managers-roster-heading"
          className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 xl:col-span-7 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2
                id="org-managers-roster-heading"
                className="text-base font-semibold text-gray-900 dark:text-white/90"
              >
                {t("managersRosterTitle")}
              </h2>
              <p className="mt-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                {t("managersRosterSubtitle")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 tabular-nums dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
              <UserIcon className="size-3.5" aria-hidden="true" />
              <span>
                {t("activeManagersCount", { count: managers.length })}
              </span>
            </span>
          </div>

          {isSoleManager && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50/70 px-4 py-3 text-xs leading-5 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              <LockIcon
                className="mt-0.5 size-4 shrink-0 text-warning-600 dark:text-warning-400"
                aria-hidden="true"
              />
              <p>{t("lastManagerProtectionNotice")}</p>
            </div>
          )}

          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {managers.map((manager) => {
              const isSelf = manager.userId === actorId;
              return (
                <li
                  key={manager.userId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
                    >
                      {getInitials(manager.fullName, manager.email)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
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

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100 ring-inset dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
                      <RoleLabel roleCode="ADMIN" />
                    </span>
                    {isSoleManager && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        <LockIcon className="size-3" aria-hidden="true" />
                        <span>{t("soleManagerBadge")}</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Right: Quick Governance Navigation & Scope Boundary */}
        <section
          aria-labelledby="org-governance-actions-heading"
          className="space-y-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs sm:p-6 xl:col-span-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div>
            <h2
              id="org-governance-actions-heading"
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("quickGovernanceTitle")}
            </h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              {t("quickGovernanceSubtitle")}
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/organization/members"
              className="group flex items-start justify-between gap-3 rounded-xl border border-gray-200/90 p-3.5 transition hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <GroupIcon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white/90 dark:group-hover:text-brand-400">
                    {t("actionMembersTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("actionMembersDescription")}
                  </p>
                </div>
              </div>
              <ArrowRightIcon
                className="mt-1 size-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/projects"
              className="group flex items-start justify-between gap-3 rounded-xl border border-gray-200/90 p-3.5 transition hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-300">
                  <EyeIcon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white/90 dark:group-hover:text-brand-400">
                    {t("actionProjectsTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("actionProjectsDescription")}
                  </p>
                </div>
              </div>
              <ArrowRightIcon
                className="mt-1 size-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/organization/settings"
              className="group flex items-start justify-between gap-3 rounded-xl border border-gray-200/90 p-3.5 transition hover:border-brand-300 hover:bg-brand-50/30 dark:border-gray-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <SettingsIcon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white/90 dark:group-hover:text-brand-400">
                    {t("actionSettingsTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("actionSettingsDescription")}
                  </p>
                </div>
              </div>
              <ArrowRightIcon
                className="mt-1 size-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 rtl:rotate-180"
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-brand-200/80 bg-brand-50/50 px-3.5 py-3 text-xs leading-5 text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300">
            <InfoIcon
              className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400"
              aria-hidden="true"
            />
            <p>{t("governanceBoundaryNote")}</p>
          </div>
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
        className="rounded-2xl border border-warning-200 bg-warning-50 p-6 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
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
