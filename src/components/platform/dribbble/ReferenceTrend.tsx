"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { referenceSeries } from "./reference-series";
import styles from "../ui/operator.module.css";
export default function ReferenceTrend({ title }: { title: string }) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  const gradient = useId();
  const [hover, setHover] = useState(26);
  const [visible, setVisible] = useState([true, true, true]);
  const colors = ["var(--op-green)", "var(--op-dark)", "var(--op-coral)"];
  const names = [
    t("referenceCharts.active"),
    t("referenceCharts.pending"),
    t("referenceCharts.suspended"),
  ];
  const x = (i: number) => 38 + (i / 30) * 714;
  const y = (v: number) => 260 - ((v - 7000) / 4800) * 226;
  const paths = referenceSeries.map((values) =>
    values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" "),
  );
  const date = new Date(Date.UTC(2026, 6, 20 + hover)).toLocaleDateString(
    locale,
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
  return (
    <div className={styles.referenceTrend}>
      <p className={styles.simulationNotice}>{t("liveDashboard.simulated")}</p>
      <div className={styles.trendCanvas}>
        <svg
          viewBox="0 0 800 300"
          role="img"
          aria-label={`${title} · ${t("liveDashboard.simulated")}`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setHover((i) =>
                Math.max(
                  0,
                  Math.min(30, i + (event.key === "ArrowLeft" ? -1 : 1)),
                ),
              );
            }
          }}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setHover(
              Math.max(
                0,
                Math.min(
                  30,
                  Math.round(
                    (((event.clientX - bounds.left) / bounds.width) * 800 -
                      38) /
                      714,
                  ),
                ),
              ),
            );
          }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--op-green)" stopOpacity=".12" />
              <stop offset="100%" stopColor="var(--op-green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[7000, 8000, 9000, 10000, 11000].map((value) => (
            <g key={value}>
              <line
                x1="38"
                x2="752"
                y1={y(value)}
                y2={y(value)}
                className={styles.chartGrid}
              />
              <text
                x="29"
                y={y(value) + 4}
                textAnchor="end"
                className={styles.chartAxis}
              >
                {value / 1000}K
              </text>
              <text x="765" y={y(value) + 4} className={styles.chartAxis}>
                {(value - 7000) / 1000}K
              </text>
            </g>
          ))}
          {Array.from({ length: 31 }, (_, i) => (
            <line
              key={i}
              x1={x(i)}
              x2={x(i)}
              y1="25"
              y2="260"
              className={styles.chartVerticalGrid}
            />
          ))}
          {visible[0] && (
            <path
              d={`${paths[0]} L752,260 L38,260 Z`}
              fill={`url(#${gradient})`}
            />
          )}
          {paths.map(
            (path, index) =>
              visible[index] && (
                <path
                  key={index}
                  d={path}
                  fill="none"
                  stroke={colors[index]}
                  strokeWidth="1.8"
                  vectorEffect="non-scaling-stroke"
                />
              ),
          )}
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="25"
            y2="260"
            stroke="var(--op-muted)"
            strokeDasharray="2 4"
          />
          {referenceSeries.map(
            (values, index) =>
              visible[index] && (
                <circle
                  key={index}
                  cx={x(hover)}
                  cy={y(values[hover])}
                  r="3.5"
                  fill={colors[index]}
                  stroke="white"
                  strokeWidth="2"
                />
              ),
          )}
          {[
            [0, "20"],
            [11, "Aug"],
            [21, "10"],
            [30, "20"],
          ].map(([i, label]) => (
            <text
              key={i}
              x={x(Number(i))}
              y="287"
              textAnchor="middle"
              className={styles.chartAxis}
            >
              {label}
            </text>
          ))}
        </svg>
        <div
          className={styles.referenceTooltip}
          style={{
            insetInlineStart: `${Math.min(63, Math.max(7, (hover / 30) * 67 - 15))}%`,
          }}
          aria-hidden="true"
        >
          <p>{date}</p>
          {names.map(
            (name, index) =>
              visible[index] && (
                <div key={name}>
                  <span>
                    <i style={{ background: colors[index] }} />
                    {name}
                  </span>
                  <strong>
                    {referenceSeries[index][hover].toLocaleString(locale)}
                  </strong>
                </div>
              ),
          )}
        </div>
      </div>
      <div className={styles.referenceLegend}>
        {names.map((name, index) => (
          <label key={name}>
            <input
              type="checkbox"
              checked={visible[index]}
              style={{ accentColor: colors[index] }}
              onChange={() =>
                setVisible((values) =>
                  values.map((value, i) => (i === index ? !value : value)),
                )
              }
            />
            {name}
          </label>
        ))}
      </div>
      <details className={styles.demoDataTable}>
        <summary>{t("liveDashboard.chartData")}</summary>
        <div className="overflow-x-auto">
          <table>
            <caption>{t("liveDashboard.simulated")}</caption>
            <thead>
              <tr>
                <th>{t("liveDashboard.day")}</th>
                {names.map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referenceSeries[0].map((_, day) => (
                <tr key={day}>
                  <td>{day + 1}</td>
                  {referenceSeries.map((values, i) => (
                    <td key={i}>{values[day].toLocaleString(locale)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
