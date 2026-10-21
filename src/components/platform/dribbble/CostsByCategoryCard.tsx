"use client";
import { useLocale, useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import styles from "../ui/operator.module.css";
// Simulation for the reference composition; the total remains the API value.
const categories = [
  { value: 89200, percent: 35, color: "var(--op-green)" },
  { value: 63700, percent: 25, color: "#4bd329" },
  { value: 38200, percent: 15, color: "var(--op-lime)" },
  { value: 25500, percent: 10, color: "#f1e982" },
  { value: 17800, percent: 7, color: "#eddda1" },
  { value: 12700, percent: 5, color: "#dedfdd" },
];
export default function CostsByCategoryCard({
  data,
}: {
  data: PlatformDashboardRecord["projects"];
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  return (
    <section className={styles.dribbbleCard}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          {t("operatorDesign.projectDistribution")}
        </h2>
      </div>
      <p className={styles.simulationNotice}>{t("liveDashboard.simulated")}</p>
      <div className={styles.liveDistribution} aria-hidden="true">
        {categories.map((item, index) => (
          <span
            key={index}
            style={{ flexGrow: item.percent, background: item.color }}
          />
        ))}
        <span style={{ flexGrow: 3, background: "#f1f2f0" }} />
      </div>
      <dl className={styles.referenceCategoryList}>
        {categories.map((item, index) => (
          <div key={index}>
            <dt>
              <i aria-hidden="true" style={{ background: item.color }} />
              {t("liveDashboard.demoGroup", { number: index + 1 })}
            </dt>
            <dd>
              {(item.value / 1000).toLocaleString(locale)}K{" "}
              <span>{item.percent}%</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.simulationNotice}>
        {t("liveDashboard.realTotal")}: {data.total.toLocaleString(locale)}
      </p>
    </section>
  );
}
