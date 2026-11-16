"use client";
import { useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import ReferenceTrend from "./ReferenceTrend";
import styles from "../ui/platformCharts.module.css";
const VI_SNAPSHOT_LABELS: Record<string, string> = {
  total: "Tổng số",
  active: "Đang hoạt động",
  pending: "Chờ chấp nhận lời mời",
  pendingInvite: "Chờ chấp nhận lời mời",
  suspended: "Đã tạm ngưng",
  removed: "Đã gỡ",
};

const EN_SNAPSHOT_LABELS: Record<string, string> = {
  total: "Total",
  active: "Active",
  pending: "Pending invitation",
  pendingInvite: "Pending invitation",
  suspended: "Suspended",
  removed: "Removed",
};

export default function RevenueCostsCard({
  data,
}: {
  data: PlatformDashboardRecord["memberships"];
}) {
  const t = useTranslations("platformConsole");
  const common = useTranslations("common");
  const isVi = common("localeCode") === "vi";
  return (
    <section className={`${styles.panel} ${styles.trendCard}`}>
      <ReferenceTrend title={t("operatorDesign.membershipDistribution")} />
      <dl className="sr-only" aria-label={t("liveDashboard.snapshot")}>
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <dt>
              {isVi
                ? (VI_SNAPSHOT_LABELS[key] ?? key)
                : (EN_SNAPSHOT_LABELS[key] ?? key)}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
