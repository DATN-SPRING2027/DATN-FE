"use client";
import { useId } from "react";
import { referenceSeries } from "./reference-series";
import styles from "../ui/operator.module.css";
export default function MiniReference({ variant }: { variant: number }) {
  const gradient = useId();
  const points = referenceSeries[0]
    .map((v, i) => `${(i / 30) * 180},${36 - ((v - 9000) / 3000) * 30}`)
    .join(" ");
  if (variant % 3 === 1)
    return (
      <div className={styles.referenceGauge} aria-hidden="true">
        <span>▼</span>
        <div />
      </div>
    );
  if (variant % 3 === 2)
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 180 40"
        className={styles.miniReference}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--op-chart-primary)"
              stopOpacity=".16"
            />
            <stop
              offset="100%"
              stopColor="var(--op-chart-primary)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polygon points={`0,40 ${points} 180,40`} fill={`url(#${gradient})`} />
        <polyline
          points={points}
          fill="none"
          stroke="var(--op-chart-primary)"
          strokeWidth="1.3"
        />
        <circle cx="180" cy="11" r="2" fill="var(--op-chart-primary)" />
      </svg>
    );
  return (
    <div className={styles.miniEqualizer} aria-hidden="true">
      {referenceSeries[0].map((v, i) => (
        <span
          key={i}
          style={{
            height: `${65 + (v % 250) / 10}%`,
            background:
              i === 10 || i === 11 ? "var(--op-chart-soft)" : undefined,
          }}
        />
      ))}
    </div>
  );
}
