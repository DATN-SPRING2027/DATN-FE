"use client";

import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformDashboardQuery } from "@/lib/queries/platform/usePlatformOperations";
import { useTranslations } from "next-intl";
import { BoltIcon, FolderIcon, GroupIcon, UserIcon } from "@/icons/index";
import StatCard from "./ui/StatCard";
import { TableSkeleton } from "./ui/LoadingSkeleton";

type PlatformDashboardProps = Readonly<{
  permissions: readonly PlatformPermission[];
}>;

export default function PlatformDashboard({
  permissions,
}: PlatformDashboardProps) {
  const t = useTranslations("platformConsole");
  const canReadDashboard = permissions.includes(
    "platform.dashboard.summary.read",
  );
  const dashboard = usePlatformDashboardQuery(canReadDashboard);

  const orgValue = !canReadDashboard
    ? t("dashboard.unavailable")
    : dashboard.isPending
      ? t("dashboard.loading")
      : dashboard.isError
        ? t("dashboard.error")
        : String(dashboard.data?.organizations.total ?? 0);

  const healthValue = !canReadDashboard
    ? t("dashboard.unavailable")
    : dashboard.isPending
      ? t("dashboard.loading")
      : dashboard.isError
        ? t("dashboard.error")
        : (dashboard.data?.serviceHealth.status ?? "UNKNOWN");

  return (
    <div className="space-y-6">
      {/* 4 Compact Metric KPI Cards */}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t("dashboard.summary")}
      >
        {/* Organizations KPI */}
        <StatCard
          label={t("dashboard.organizations")}
          value={orgValue}
          detail={
            canReadDashboard
              ? t("dashboard.totalOrganizations")
              : t("dashboard.permissionNeeded")
          }
          icon={
            <GroupIcon className="size-5 text-brand-600 dark:text-brand-400" />
          }
          href="/platform/organizations"
          actionText={t("dashboard.open")}
          onRetry={
            dashboard.isError ? () => void dashboard.refetch() : undefined
          }
          retryText={t("retry")}
        />

        <StatCard
          label={t("dashboard.users")}
          value={
            dashboard.data && canReadDashboard
              ? String(dashboard.data.users.total)
              : dashboard.isPending
                ? t("dashboard.loading")
                : t("dashboard.unavailable")
          }
          detail={
            dashboard.data
              ? `${dashboard.data.users.active} active · ${dashboard.data.users.suspended} suspended`
              : t("dashboard.userMetricsUnavailable")
          }
          icon={
            <UserIcon className="size-5 text-brand-600 dark:text-brand-400" />
          }
          href="/platform/users"
          actionText={t("dashboard.open")}
        />

        <StatCard
          label={t("dashboard.projects")}
          value={
            dashboard.data && canReadDashboard
              ? String(dashboard.data.projects.total)
              : dashboard.isPending
                ? t("dashboard.loading")
                : t("dashboard.unavailable")
          }
          detail={
            dashboard.data
              ? `${dashboard.data.projects.active} active · ${dashboard.data.projects.archived} archived`
              : t("dashboard.projectMetricsUnavailable")
          }
          icon={
            <FolderIcon className="size-5 text-brand-600 dark:text-brand-400" />
          }
          href="/platform/projects"
          actionText={t("dashboard.open")}
        />

        {/* Platform IAM Health KPI */}
        <StatCard
          label={t("dashboard.iamHealth")}
          value={healthValue}
          detail={t("dashboard.iamHealthDetail")}
          icon={
            <BoltIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
          }
          href="/platform/services"
          actionText={t("dashboard.openHealth")}
          statusBadge={
            canReadDashboard && dashboard.isSuccess ? (
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
            ) : undefined
          }
          onRetry={
            dashboard.isError && canReadDashboard
              ? () => void dashboard.refetch()
              : undefined
          }
          retryText={t("retry")}
        />
      </section>

      {/* Second Row: Operational Activity & Health Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Operational Activity (Wide Table 2/3) */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {t("dashboard.recentActivity")}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t("dashboard.recentActivityNote")}
              </p>
            </div>
            <Link
              href="/platform/audit"
              className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
            >
              {t("dashboard.openAudit")} →
            </Link>
          </div>

          {!canReadDashboard ? (
            <UnavailableRow message={t("dashboard.permissionNeeded")} />
          ) : dashboard.isPending ? (
            <TableSkeleton rows={4} columns={3} />
          ) : dashboard.isError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-6"
            >
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {t("dashboard.auditError")}
              </p>
              <button
                type="button"
                onClick={() => void dashboard.refetch()}
                className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                {t("retry")}
              </button>
            </div>
          ) : dashboard.data?.recentOperationalActivity.items.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3 text-start">{t("table.event")}</th>
                    <th className="px-5 py-3 text-start">
                      {t("table.target")}
                    </th>
                    <th className="px-5 py-3 text-end">{t("table.time")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dashboard.data.recentOperationalActivity.items
                    .slice(0, 5)
                    .map((event) => (
                      <tr
                        key={`${event.action}-${event.resourceType}-${event.occurredAt}`}
                        className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-mono inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                            {event.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-800 dark:text-gray-200">
                            {event.resourceType}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-end text-gray-400">
                          <time dateTime={event.occurredAt}>
                            {new Date(event.occurredAt).toLocaleString()}
                          </time>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <UnavailableRow message={t("dashboard.noRecentActivity")} />
          )}
        </div>

        {/* Platform System Health Card (1/3) */}
        <div className="flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {t("dashboard.iamHealth")}
              </h3>
              {canReadDashboard && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={dashboard.isFetching}
                  onClick={() => void dashboard.refetch()}
                  className="h-7 px-2 text-xs"
                >
                  {dashboard.isFetching ? t("refreshing") : t("refresh")}
                </Button>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <BoltIcon className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    {healthValue}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    {t("dashboard.iamHealthDetail")}
                  </p>
                </div>
              </div>

              {dashboard.isError && canReadDashboard && (
                <button
                  type="button"
                  onClick={() => void dashboard.refetch()}
                  className="mt-2 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  {t("retry")}
                </button>
              )}

              <div className="dark:bg-gray-850/60 mt-4 space-y-2 rounded-xl bg-gray-50/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Target Service
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    continuum_iam
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Health Endpoint
                  </span>
                  <span className="font-mono text-[11px] text-gray-600 dark:text-gray-300">
                    PLAT-HEALTH-01
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Readiness Scope
                  </span>
                  <span className="text-[11px] text-gray-500">
                    IAM Process Liveness
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Link
              href="/platform/services"
              className="inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
            >
              {t("dashboard.openHealth")} →
            </Link>
          </div>
        </div>
      </div>

      {/* Truth in advertising note */}
      <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
        {t("dashboard.noFabricatedMetrics")}
      </p>
    </div>
  );
}

function UnavailableRow({ message }: { message: string }) {
  return (
    <div
      className="px-5 py-8 text-center text-xs text-gray-500 dark:text-gray-400"
      role="status"
    >
      {message}
    </div>
  );
}
