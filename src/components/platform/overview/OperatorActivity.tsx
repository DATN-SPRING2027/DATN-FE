"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import jira from "../ui/platformCharts.module.css";
import { UserCircleIcon } from "@/icons";
export default function OperatorActivity({
  activity,
  canOpen,
}: {
  activity: PlatformDashboardRecord["recentOperationalActivity"];
  canOpen: boolean;
}) {
  const t = useTranslations("platformConsole");
  return (
    <section
      className={`${jira.panel} ${jira.activity}`}
      aria-labelledby="operator-activity"
    >
      <h2 id="operator-activity" className={jira.cardHeading}>
        {t("dashboard.recentActivity")}
      </h2>
      {activity.availability !== "AVAILABLE" ? (
        <p role="status" className="py-4 text-sm">
          {t("dashboard.auditError")}
        </p>
      ) : activity.items.length ? (
        <ul className={jira.activityList}>
          {activity.items.map((item, index) => (
            <li key={`${item.occurredAt}-${index}`}>
              <UserCircleIcon aria-hidden="true" />
              <p>
                {item.action} <strong>{item.resourceType}</strong>
              </p>
              <time dateTime={item.occurredAt}>
                {new Date(item.occurredAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                {new Date(item.occurredAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="py-4 text-sm">
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
