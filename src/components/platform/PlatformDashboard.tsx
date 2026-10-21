"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformDashboardQuery } from "@/lib/queries/platform/usePlatformOperations";
import { TableSkeleton } from "./ui/LoadingSkeleton";
import StatusBadge from "./ui/StatusBadge";
import OperatorActivity from "./overview/OperatorActivity";
import DeliveriesCard from "./dribbble/DeliveriesCard";
import RevenueCostsCard from "./dribbble/RevenueCostsCard";
import BalanceCostsCard from "./dribbble/BalanceCostsCard";
import CostsByCategoryCard from "./dribbble/CostsByCategoryCard";
import InvoicesCard from "./dribbble/InvoicesCard";
import styles from "./ui/operator.module.css";

export default function PlatformDashboard({
  permissions,
}: {
  permissions: readonly PlatformPermission[];
}) {
  const t = useTranslations("platformConsole");
  const allowed = permissions.includes("platform.dashboard.summary.read");
  const query = usePlatformDashboardQuery(allowed);

  if (!allowed)
    return (
      <p role="status" className={styles.section}>
        {t("dashboard.permissionNeeded")}
      </p>
    );

  if (query.isError)
    return (
      <div role="alert" className={styles.section}>
        <p className="mb-4 text-error-600 dark:text-error-400">
          {t("dashboard.error")}
        </p>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );

  if (query.isPending || !query.data)
    return (
      <section
        aria-label={t("dashboard.loading")}
        aria-busy="true"
        className={styles.section}
      >
        <TableSkeleton rows={5} columns={4} />
      </section>
    );

  const data = query.data;
  const health = data.serviceHealth;
  const metrics = [
    {
      id: "organizations",
      value: data.organizations.total,
    },
    {
      id: "users",
      value: data.users.total,
    },
    {
      id: "projects",
      value: data.projects.total,
    },
    {
      id: "memberships",
      value: data.memberships.total,
    },
  ] as const;

  return (
    <div aria-busy={query.isFetching}>
      {/* Main Dribbble 2-Column Dashboard */}
      <div className={styles.dribbbleDashboard}>
        {/* LEFT COLUMN */}
        <div className="min-w-0 space-y-5">
          {/* Deliveries & Real KPI Metrics */}
          <DeliveriesCard metrics={metrics} />

          {/* Revenue & Costs Interactive Chart */}
          <RevenueCostsCard data={data.memberships} />

          {/* Bottom Dual Subgrid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <BalanceCostsCard data={data.users} />
            <CostsByCategoryCard data={data.projects} />
          </div>

          {/* Service Health Card */}
          <section
            className={`${styles.dribbbleCard} ${styles.services}`}
            aria-labelledby="operator-health"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="operator-health"
                className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
              >
                {t("dashboard.serviceHealth")}
              </h2>
              <StatusBadge
                status={health.status === "READY" ? "HEALTHY" : health.status}
                label={health.status}
              />
            </div>
            <dl className={styles.metrics}>
              {(["total", "ready", "degraded", "unavailable"] as const).map(
                (key) => (
                  <div
                    className={`${styles.metric} ${styles[key === "total" ? "totalTone" : key === "ready" ? "primaryTone" : key === "degraded" ? "secondaryTone" : "mutedTone"]}`}
                    key={key}
                  >
                    <dt>{t(`dashboard.healthCounts.${key}`)}</dt>
                    <dd>
                      {health[key] === null ? (
                        <span className="text-sm font-normal tracking-normal text-gray-500 dark:text-gray-400">
                          {t("dashboard.unavailable")}
                        </span>
                      ) : (
                        health[key]
                      )}
                    </dd>
                  </div>
                ),
              )}
            </dl>
            <div
              className={`${styles.statBars} ${styles.serviceBars}`}
              aria-hidden="true"
            >
              {(["total", "ready", "degraded", "unavailable"] as const).map(
                (key, index) => (
                  <span
                    key={key}
                    className={
                      [
                        styles.totalTrack,
                        styles.primaryTrack,
                        styles.secondaryTrack,
                        styles.mutedTrack,
                      ][index]
                    }
                  >
                    <i
                      style={{
                        width: `${health.total && health[key] !== null ? Math.min(100, (health[key]! / health.total) * 100) : 0}%`,
                      }}
                    />
                  </span>
                ),
              )}
            </div>
            <p className="sr-only">{t("dashboard.serviceHealthNote")}</p>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="min-w-0 space-y-5">
          <InvoicesCard
            allowed={permissions.includes(
              "platform.organizations.organization.read",
            )}
            canManage={permissions.includes(
              "platform.organizations.organization.manage",
            )}
          />
          <div className="space-y-5">
            <OperatorActivity
              activity={data.recentOperationalActivity}
              canOpen={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
