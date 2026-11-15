"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import jira from "../ui/platformCharts.module.css";
import { UserCircleIcon } from "@/icons";
const VI_AUDIT_ACTIONS: Record<string, string> = {
  "platform.project.metadata.changed": "Đã cập nhật thông tin",
  "platform.project.member.added": "Đã thêm thành viên vào",
  "platform.project.member.removed": "Đã gỡ thành viên khỏi",
  "platform.project.member.role_changed": "Đã đổi vai trò thành viên trong",
  "platform.organization.created": "Đã tạo mới",
  "platform.organization.updated": "Đã cập nhật",
  "platform.organization.suspended": "Đã tạm ngưng",
  "platform.organization.reactivated": "Đã kích hoạt lại",
  "platform.membership.suspended": "Đã tạm ngưng",
  "platform.membership.reactivated": "Đã khôi phục",
  "platform.user.suspended": "Đã khóa",
  "platform.user.reactivated": "Đã mở khóa",
};

const VI_AUDIT_RESOURCES: Record<string, string> = {
  PROJECT: "Dự án",
  ORGANIZATION: "Tổ chức",
  USER: "Người dùng",
  ORGANIZATION_MEMBERSHIP: "Tư cách thành viên",
  PROJECT_MEMBERSHIP: "Thành viên dự án",
};

function formatAuditActionVi(action: string): string {
  const direct = VI_AUDIT_ACTIONS[action.trim()];
  if (direct) return direct;
  return action
    .replace(/^platform\./, "")
    .replace(/[._]/g, " ")
    .trim();
}

export default function OperatorActivity({
  activity,
  canOpen,
}: {
  activity: PlatformDashboardRecord["recentOperationalActivity"];
  canOpen: boolean;
}) {
  const t = useTranslations("platformConsole");
  const common = useTranslations("common");
  const isVi = common("localeCode") === "vi";
  const dateLocale = isVi ? "vi-VN" : "en-US";
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
                {isVi ? formatAuditActionVi(item.action) : item.action}{" "}
                <strong>
                  {isVi
                    ? (VI_AUDIT_RESOURCES[item.resourceType.trim()] ??
                      item.resourceType)
                    : item.resourceType}
                </strong>
              </p>
              <time dateTime={item.occurredAt}>
                {new Date(item.occurredAt).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                {new Date(item.occurredAt).toLocaleTimeString(dateLocale, {
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
