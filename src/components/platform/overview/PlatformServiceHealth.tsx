"use client";
import { useTranslations } from "next-intl";
import { PlatformServerIcon } from "@/icons";
import {
  usePlatformServicesQuery,
  type PlatformDashboardRecord,
} from "@/lib/queries/platform/usePlatformOperations";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import styles from "../ui/platformCharts.module.css";
import { isReadAccessLost, QueryRefreshStatus } from "../PlatformOperationsUi";
export default function PlatformServiceHealth({
  health,
  permissions,
}: {
  health: PlatformDashboardRecord["serviceHealth"];
  permissions: readonly PlatformPermission[];
}) {
  const t = useTranslations("platformConsole");
  const allowed = permissions.includes("platform.services.service.read");
  const query = usePlatformServicesQuery(allowed);
  const canKeepQueryData = !isReadAccessLost(query.error);
  const visible = allowed && canKeepQueryData && query.data?.length;
  return (
    <section className={styles.services} aria-labelledby="operator-health">
      <h2 id="operator-health">{t("dashboard.serviceHealth")}</h2>
      <p className="sr-only">{t("dashboard.serviceHealthNote")}</p>
      {allowed && canKeepQueryData && query.data !== undefined && (query.isFetching || query.isRefetchError) && (
        <div className="my-2">
          <QueryRefreshStatus
            hasData
            isFetching={query.isFetching}
            isRefetchError={query.isRefetchError}
            onRetry={() => void query.refetch()}
          />
        </div>
      )}
      {allowed && query.isError && (!query.data || !canKeepQueryData) && (
        <div role="alert" className="my-2 text-xs">
          <p>{t("jira.servicesError")}</p>
          <button
            type="button"
            className="mt-1 min-h-8 cursor-pointer underline"
            onClick={() => void query.refetch()}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {visible ? (
        <div className={styles.serviceList}>
          {query.data!.slice(0, 3).map((service) => (
            <div className={styles.serviceRow} key={service.id}>
              <PlatformServerIcon aria-hidden="true" />
              <span>{service.name}</span>
              <span
                className={styles.serviceBadge}
                data-ready={service.status === "READY"}
              >
                {t(
                  service.status === "READY"
                    ? "jira.ready"
                    : service.status === "DEGRADED"
                      ? "jira.degraded"
                      : service.status === "UNAVAILABLE"
                        ? "jira.unavailable"
                        : "jira.unknown",
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="sr-only">{health.status}</p>
          <dl>
            {(["total", "ready", "degraded", "unavailable"] as const).map(
              (key) => (
                <div className={styles.healthRow} key={key}>
                  <dt>{t(`dashboard.healthCounts.${key}`)}</dt>
                  <dd>
                    {health[key] === null
                      ? t("dashboard.unavailable")
                      : health[key]}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </>
      )}
    </section>
  );
}
