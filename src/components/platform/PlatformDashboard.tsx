"use client";

import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import {
  usePlatformAuditQuery,
  usePlatformHealthQuery,
  usePlatformOrganizationsQuery,
  type PlatformPermission,
} from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";

type PlatformDashboardProps = Readonly<{
  permissions: readonly PlatformPermission[];
}>;

export default function PlatformDashboard({ permissions }: PlatformDashboardProps) {
  const t = useTranslations("platformConsole");
  const canReadOrganizations = permissions.includes("platform.organizations.organization.read");
  const canReadHealth = permissions.includes("platform.health.read");
  const canReadAudit = permissions.includes("platform.audit.read");
  const organizations = usePlatformOrganizationsQuery(canReadOrganizations);
  const health = usePlatformHealthQuery(canReadHealth);
  const audit = usePlatformAuditQuery(canReadAudit);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("dashboard.summary") }>
        <SummaryCard label={t("dashboard.organizations")} value={
          !canReadOrganizations ? t("dashboard.unavailable") : organizations.isPending ? t("dashboard.loading") : organizations.isError ? t("dashboard.error") : String(organizations.data?.pagination.totalItems ?? 0)
        } detail={canReadOrganizations ? t("dashboard.totalOrganizations") : t("dashboard.permissionNeeded")} href="/platform/organizations" onRetry={organizations.isError ? () => void organizations.refetch() : undefined} />
        <SummaryCard label={t("dashboard.users")} value={t("dashboard.unavailable")} detail={t("dashboard.userMetricsUnavailable")} href="/platform/users" />
        <SummaryCard label={t("dashboard.projects")} value={t("dashboard.unavailable")} detail={t("dashboard.projectMetricsUnavailable")} href="/platform/projects" />
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.iamHealth")}</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{!canReadHealth ? t("dashboard.unavailable") : health.isPending ? t("dashboard.loading") : health.isError ? t("dashboard.error") : t("health.healthy")}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{t("dashboard.iamHealthDetail")}</p>
          {health.isError && canReadHealth && <button type="button" onClick={() => void health.refetch()} className="mt-2 text-sm font-medium text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button>}
          <Link href="/platform/services" className="mt-4 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("dashboard.openHealth")}</Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div><h3 className="font-semibold text-gray-900 dark:text-white">{t("dashboard.recentActivity")}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("dashboard.recentActivityNote")}</p></div>
          <Link href="/platform/audit" className="text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("dashboard.openAudit")}</Link>
        </div>
        {!canReadAudit ? <UnavailableRow message={t("dashboard.permissionNeeded")} /> : audit.isPending ? <UnavailableRow message={t("dashboard.loading")} /> : audit.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-6"><p className="text-sm text-error-600 dark:text-error-400">{t("dashboard.auditError")}</p><button type="button" onClick={() => void audit.refetch()} className="text-sm font-medium text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{t("retry")}</button></div> : audit.data?.length ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {audit.data.slice(0, 5).map((event, index) => <li key={`${event.action}-${event.targetResourceId}-${event.occurredAt}-${index}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{event.action}</p><p className="text-xs text-gray-500 dark:text-gray-400">{event.targetResource} · {event.targetResourceId}</p></div>
              <time className="text-xs text-gray-500 dark:text-gray-400" dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
            </li>)}
          </ul>
        ) : <UnavailableRow message={t("dashboard.noRecentActivity")} />}
      </section>
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{t("dashboard.noFabricatedMetrics")}</p>
    </div>
  );
}

function SummaryCard({ label, value, detail, href, onRetry }: { label: string; value: string; detail: string; href: "/platform/organizations" | "/platform/users" | "/platform/projects"; onRetry?: () => void }) {
  const t = useTranslations("platformConsole");
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-1 min-h-10 text-xs leading-5 text-gray-500 dark:text-gray-400">{detail}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
      <Link href={href} className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400">{useTranslations("platformConsole")("dashboard.open")}</Link>
    </article>
  );
}

function UnavailableRow({ message }: { message: string }) {
  return <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400" role="status">{message}</p>;
}
