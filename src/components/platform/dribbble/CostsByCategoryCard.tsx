"use client";
import { useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import SimulationBadge from "../ui/SimulationBadge";
import styles from "../ui/platformCharts.module.css";
const groups = [
  { percent: 35, count: 17, color: "var(--op-chart-primary)" },
  { percent: 25, count: 12, color: "var(--op-chart-teal)" },
  { percent: 15, count: 7, color: "var(--op-chart-violet)" },
  { percent: 10, count: 5, color: "var(--op-chart-light)" },
  { percent: 10, count: 5, color: "var(--op-chart-muted)" },
  { percent: 5, count: 2, color: "var(--op-chart-deep)" },
];
export default function CostsByCategoryCard({
  data,
}: {
  data: PlatformDashboardRecord["projects"];
}) {
  const t = useTranslations("platformConsole");
  return (
    <section className={`${styles.panel} ${styles.smallCard}`}>
      <div className={styles.cardHeading}>
        <h2>{t("operatorDesign.projectDistribution")}</h2>
        <SimulationBadge />
      </div>
      <div className={styles.distribution} aria-hidden="true">
        {groups.map((group, i) => (
          <span
            key={i}
            style={{ flexGrow: group.percent, background: group.color }}
          />
        ))}
      </div>
      <dl className={styles.categoryList}>
        {groups.map((group, i) => (
          <div key={i}>
            <dt>
              <i aria-hidden="true" style={{ background: group.color }} />
              {t("liveDashboard.demoGroup", { number: i + 1 })}
            </dt>
            <dd>{group.percent}%</dd>
            <dd>{group.count}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.realTotal}>
        {t("liveDashboard.realTotal")}:{" "}
        <strong>{data.total.toLocaleString("en-US")}</strong>
      </p>
    </section>
  );
}
