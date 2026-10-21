"use client";
import { useLocale, useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import SimulationBadge from "../ui/SimulationBadge";
import styles from "../ui/operator.module.css";
// Simulation for the reference composition; the total remains the API value.
const categories = [
  { value: 89200, percent: 35, color: "var(--op-chart-primary)" },
  { value: 63700, percent: 25, color: "var(--op-chart-teal)" },
  { value: 38200, percent: 15, color: "var(--op-chart-violet)" },
  { value: 25500, percent: 10, color: "var(--op-chart-light)" },
  { value: 17800, percent: 7, color: "var(--op-chart-muted)" },
  {
    value: 12700,
    percent: 5,
    color: "color-mix(in srgb, var(--op-chart-yellow) 35%, white)",
  },
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
        <SimulationBadge />
      </div>
      <div className={styles.liveDistribution} aria-hidden="true">
        {categories.map((item, index) => (
          <span
            key={index}
            style={{ flexGrow: item.percent, background: item.color }}
          />
        ))}
        <span style={{ flexGrow: 3, background: "var(--op-panel)" }} />
      </div>
      <dl className={styles.referenceCategoryList}>
        {categories.map((item, index) => (
          <div key={index}>
            <dt>
              <i aria-hidden="true" style={{ background: item.color }} />
              {t("liveDashboard.demoGroup", { number: index + 1 })}
            </dt>
            <dd style={{ color: item.color }} data-category={index}>
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
