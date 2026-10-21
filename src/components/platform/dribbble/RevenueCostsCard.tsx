"use client";
import { useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import ReferenceTrend from "./ReferenceTrend";
import styles from "../ui/operator.module.css";
export default function RevenueCostsCard({
  data,
}: {
  data: PlatformDashboardRecord["memberships"];
}) {
  const t = useTranslations("platformConsole");
  return (
    <section className={`${styles.dribbbleCard} ${styles.trend}`}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          {t("operatorDesign.membershipDistribution")}
        </h2>
      </div>
      <ReferenceTrend title={t("operatorDesign.membershipDistribution")} />
      <dl className="sr-only" aria-label={t("liveDashboard.snapshot")}>
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
