"use client";
import { useLocale, useTranslations } from "next-intl";
import styles from "../ui/operator.module.css";
export type SnapshotItem = { label: string; value: number };
// A categorical snapshot is deliberate: the overview API has no historical series.
export default function SnapshotChart({
  title,
  items,
  height = 220,
}: {
  title: string;
  items: readonly SnapshotItem[];
  height?: number;
}) {
  const locale = useLocale();
  const t = useTranslations("platformConsole");
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div>
      <div
        role="img"
        aria-label={title}
        className={styles.snapshotPlot}
        style={{ height }}
      >
        {items.map((item, index) => (
          <div key={item.label} className={styles.snapshotColumn}>
            <span className={styles.snapshotValue}>
              {item.value.toLocaleString(locale)}
            </span>
            <div className={styles.snapshotBarSpace}>
              <span
                style={{
                  height: `${(item.value / max) * 100}%`,
                  background: [
                    "var(--op-chart-primary)",
                    "var(--op-chart-deep)",
                    "var(--op-chart-light)",
                    "var(--op-chart-muted)",
                  ][index % 4],
                }}
              />
            </div>
            <span className={styles.snapshotLabel}>{item.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.snapshotNote}>{t("liveDashboard.snapshot")}</p>
      <dl className="sr-only">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value.toLocaleString(locale)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
