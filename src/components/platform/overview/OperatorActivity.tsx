"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import styles from "../ui/operator.module.css";
export default function OperatorActivity({
  activity,
  canOpen,
}: {
  activity: PlatformDashboardRecord["recentOperationalActivity"];
  canOpen: boolean;
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  return (
    <section
      className={`${styles.section} ${styles.activity}`}
      aria-labelledby="operator-activity"
    >
      <h2 id="operator-activity" className={styles.heading}>
        {t("dashboard.recentActivity")}
      </h2>
      {activity.availability !== "AVAILABLE" ? (
        <p role="status" className={styles.empty}>
          {t("dashboard.auditError")}
        </p>
      ) : activity.items.length ? (
        <div className="overflow-x-auto">
          <table className={styles.table}>
            <thead>
              <tr>
                {["action", "resource", "occurredAt"].map((key) => (
                  <th key={key} scope="col">
                    {t(`dashboard.activityColumns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.items.map((item, index) => (
                <tr key={`${item.occurredAt}-${index}`}>
                  <td>{item.action}</td>
                  <td>{item.resourceType}</td>
                  <td>
                    <time dateTime={item.occurredAt}>
                      {new Date(item.occurredAt).toLocaleString(locale)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="status" className={styles.empty}>
          {t("dashboard.noRecentActivity")}
        </p>
      )}
      {canOpen && (
        <Link
          href="/platform/audit"
          className="mt-4 inline-flex min-h-10 items-center text-xs text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
        >
          {t("dashboard.openAudit")} →
        </Link>
      )}
    </section>
  );
}
