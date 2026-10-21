"use client";
import { useLocale, useTranslations } from "next-intl";
import MiniReference from "./MiniReference";
import styles from "../ui/operator.module.css";
export default function DeliveriesCard({
  metrics,
}: {
  metrics: readonly {
    id: "organizations" | "users" | "projects" | "memberships";
    value: number;
  }[];
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  return (
    <section
      className={`${styles.dribbbleCard} ${styles.summary}`}
      aria-label={t("dashboard.summary")}
    >
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          {t("operatorDesign.systemOverview")}
        </h2>
      </div>
      <dl className={styles.metrics}>
        {metrics.map((metric, index) => (
          <div className={styles.metric} key={metric.id}>
            <dt>{t(`dashboard.${metric.id}`)}</dt>
            <dd>{metric.value.toLocaleString(locale)}</dd>
            <MiniReference variant={index} />
          </div>
        ))}
      </dl>
      <p className="sr-only">{t("liveDashboard.simulated")}</p>
    </section>
  );
}
