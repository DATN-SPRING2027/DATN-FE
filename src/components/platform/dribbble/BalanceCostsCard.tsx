"use client";
import { useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import { referenceBars } from "./reference-series";
import SimulationBadge from "../ui/SimulationBadge";
import styles from "../ui/platformCharts.module.css";
export default function BalanceCostsCard({
  data,
}: {
  data: PlatformDashboardRecord["users"];
}) {
  const t = useTranslations("platformConsole");
  return (
    <section className={`${styles.panel} ${styles.smallCard}`}>
      <div className={styles.cardHeading}>
        <h2>{t("operatorDesign.accountDistribution")}</h2>
        <SimulationBadge />
      </div>
      <svg
        className={styles.barChart}
        viewBox="0 0 440 210"
        role="img"
        aria-label={`${t("operatorDesign.accountDistribution")} · ${t("liveDashboard.simulated")}`}
      >
        {[0, 10, 20, 30, 40].map((v) => (
          <g key={v}>
            <line
              x1="32"
              x2="434"
              y1={176 - v * 4}
              y2={176 - v * 4}
              className={styles.gridLine}
            />
            <text
              x="23"
              y={180 - v * 4}
              textAnchor="end"
              className={styles.axis}
            >
              {v}
            </text>
          </g>
        ))}
        {referenceBars.map((v, i) => (
          <g key={i}>
            <rect
              x={36 + i * 18.1}
              y={176 - v * 4}
              width="11"
              height={v * 4}
              fill={
                i === 3 || i === 8 || i === 15 || i === 20
                  ? "var(--op-chart-yellow)"
                  : i === 2 || i === 10
                    ? "var(--op-chart-teal)"
                    : i % 3 === 0
                      ? "#0060b5"
                      : "var(--op-chart-primary)"
              }
            />
            {i < 20 && (
              <text
                x={41 + i * 18.1}
                y="199"
                textAnchor="middle"
                className={styles.axis}
              >
                {i + 1}
              </text>
            )}
          </g>
        ))}
      </svg>
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
