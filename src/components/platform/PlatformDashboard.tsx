"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformDashboardQuery } from "@/lib/queries/platform/usePlatformOperations";
import { TableSkeleton } from "./ui/LoadingSkeleton";
import PlatformServiceHealth from "./overview/PlatformServiceHealth";
import OperatorActivity from "./overview/OperatorActivity";
import RevenueCostsCard from "./dribbble/RevenueCostsCard";
import BalanceCostsCard from "./dribbble/BalanceCostsCard";
import CostsByCategoryCard from "./dribbble/CostsByCategoryCard";
import jira from "./ui/jira.module.css";
import charts from "./ui/platformCharts.module.css";
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

  return (
    <div aria-busy={query.isFetching}>
      <h1 className="sr-only">{t("pages.dashboard.title")}</h1>
      <div className={jira.dashboardGrid}>
        <div className={charts.primaryRow}>
          <RevenueCostsCard data={data.memberships} />
          <OperatorActivity
            activity={data.recentOperationalActivity}
            canOpen={false}
          />
        </div>
        <div className={charts.bottomRow}>
          <BalanceCostsCard data={data.users} />
          <CostsByCategoryCard data={data.projects} />
          <PlatformServiceHealth
            health={data.serviceHealth}
            permissions={permissions}
          />
        </div>
      </div>
    </div>
  );
}
