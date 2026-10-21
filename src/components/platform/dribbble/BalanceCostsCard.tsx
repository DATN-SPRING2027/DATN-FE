"use client";
import { useTranslations } from "next-intl";
import type { PlatformDashboardRecord } from "@/lib/queries/platform/usePlatformOperations";
import { referenceBars } from "./reference-series";
import SimulationBadge from "../ui/SimulationBadge";
import styles from "../ui/operator.module.css";
export default function BalanceCostsCard({
  data,
}: {
  data: PlatformDashboardRecord["users"];
}) {
  const t = useTranslations("platformConsole");
  return (
    <section className={styles.dribbbleCard}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          {t("operatorDesign.accountDistribution")}
        </h2>
        <SimulationBadge />
      </div>
      <div
        className={styles.referenceBalance}
        role="img"
        aria-label={`${t("operatorDesign.accountDistribution")} · ${t("liveDashboard.simulated")}`}
      >
        {referenceBars.map((value, index) => (
          <div key={index}>
            <span
              style={{
                height: `${value}%`,
                background:
                  index % 7 === 0
                    ? "var(--op-chart-yellow)"
                    : index < 6 || index === 12 || index === 22
                      ? "var(--op-chart-teal)"
                      : "var(--op-chart-primary)",
              }}
            />
            <i style={{ bottom: `${Math.min(99, value + 16)}%` }} />
          </div>
        ))}
      </div>
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
