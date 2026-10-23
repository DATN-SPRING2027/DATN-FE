"use client";
import { useId, useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import PlatformPagination from "../PlatformPagination";
import { referenceSeries } from "./reference-series";
import styles from "../ui/platformCharts.module.css";
const colors = [
  "var(--op-chart-primary)",
  "var(--op-chart-teal)",
  "var(--op-chart-violet)",
];
const lastDay = referenceSeries[0].length - 1;
const x = (i: number) => 38 + (i / lastDay) * 670;
const y = (v: number) => 283 - (v / 100) * 270;
export default function ReferenceTrend({ title }: { title: string }) {
  const t = useTranslations("platformConsole");
  const dataId = useId();
  const [hover, setHover] = useState(6),
    [visible, setVisible] = useState([true, true, true]),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const names = [
    t("referenceCharts.active"),
    t("referenceCharts.pending"),
    t("referenceCharts.suspended"),
  ];
  const date = (day: number) =>
    new Date(Date.UTC(2025, 3, day + 1)).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  function point(event: PointerEvent<SVGSVGElement>) {
    const svg = event.currentTarget,
      bounds = svg.getBoundingClientRect(),
      matrix = svg.getScreenCTM?.();
    let viewX: number;
    if (matrix && typeof DOMPoint !== "undefined") {
      viewX = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      ).x;
    } else {
      const scale = Math.min(bounds.width / 724, bounds.height / 330);
      if (!scale) return;
      const inset = (bounds.width - 724 * scale) / 2;
      viewX = (event.clientX - bounds.left - inset) / scale;
    }
    setHover(
      Math.max(
        0,
        Math.min(lastDay, Math.round(((viewX - 38) / 670) * lastDay)),
      ),
    );
    const box = plot.current?.getBoundingClientRect();
    if (box)
      setPosition({
        left:
          (plot.current?.scrollLeft ?? 0) +
          Math.max(
            0,
            Math.min(
              Math.max(0, box.width - 170),
              event.clientX - box.left + 12,
            ),
          ),
        top: Math.max(
          0,
          Math.min(box.height - 110, event.clientY - box.top - 70),
        ),
      });
  }
  return (
    <>
      <div className={styles.cardHeading}>
        <h2>{title}</h2>
      </div>
      <div className={styles.plot} ref={plot}>
        <svg
          viewBox="0 0 724 330"
          role="img"
          aria-label={`${title} · ${t("liveDashboard.simulated")}`}
          tabIndex={0}
          onPointerMove={point}
          onPointerDown={point}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setPosition(null);
              setHover((i) =>
                Math.max(
                  0,
                  Math.min(lastDay, i + (event.key === "ArrowLeft" ? -1 : 1)),
                ),
              );
            }
          }}
        >
          {[0, 20, 40, 60, 80, 100].map((value) => (
            <g key={value}>
              <line
                x1="38"
                x2="708"
                y1={y(value)}
                y2={y(value)}
                className={styles.gridLine}
              />
              <text
                x="25"
                y={y(value) + 4}
                textAnchor="end"
                className={styles.axis}
              >
                {value}
              </text>
            </g>
          ))}
          <line x1="38" x2="38" y1="20" y2="285" className={styles.gridLine} />
          {[0, 2, 4, 6, 8, 10, 12, 14].map((i) => (
            <g key={i}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1="285"
                y2="292"
                className={styles.gridLine}
              />
              <text
                x={x(i)}
                y="310"
                textAnchor="middle"
                className={styles.axis}
              >
                {i + 1} {t("jira.chartMonth")}
              </text>
            </g>
          ))}
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="20"
            y2="285"
            className={styles.gridLine}
          />
          {referenceSeries.map(
            (values, index) =>
              visible[index] && (
                <g key={index}>
                  <path
                    d={values
                      .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
                      .join(" ")}
                    fill="none"
                    stroke={colors[index]}
                    strokeWidth="1.8"
                  />
                  {values.map((value, i) => (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(value)}
                      r={i === hover ? 4.7 : 3.5}
                      fill={colors[index]}
                    />
                  ))}
                </g>
              ),
          )}
        </svg>
        <div
          className={styles.tooltip}
          role="tooltip"
          aria-hidden="true"
          style={position ?? undefined}
        >
          <p>{date(hover)}</p>
          {names.map(
            (name, index) =>
              visible[index] && (
                <div key={name}>
                  <span>
                    <i style={{ background: colors[index] }} />
                    {name}
                  </span>
                  <strong>{referenceSeries[index][hover]}</strong>
                </div>
              ),
          )}
        </div>
      </div>
      <div className={styles.legend}>
        {names.map((name, index) => (
          <label key={name}>
            <input
              type="checkbox"
              checked={visible[index]}
              onChange={() =>
                setVisible((values) =>
                  values.map((value, i) => (i === index ? !value : value)),
                )
              }
            />
            <i aria-hidden="true" style={{ background: colors[index] }} />
            {name}
          </label>
        ))}
      </div>
      <details id={dataId} className={styles.chartData}>
        <summary>{t("liveDashboard.chartData")}</summary>
        <table>
          <caption className="sr-only">{t("liveDashboard.simulated")}</caption>
          <thead>
            <tr>
              <th>{t("liveDashboard.day")}</th>
              {names.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(
              {
                length: Math.min(pageSize, lastDay + 1 - (page - 1) * pageSize),
              },
              (_, i) => i + (page - 1) * pageSize,
            ).map((day) => (
              <tr key={day}>
                <td>{date(day)}</td>
                {referenceSeries.map((series, i) => (
                  <td key={i}>{series[day]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <PlatformPagination
          alwaysShow
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          page={page}
          totalPages={Math.ceil((lastDay + 1) / pageSize)}
          totalItems={lastDay + 1}
          ariaLabel={t("liveDashboard.chartData")}
          onPageChange={setPage}
        />
      </details>
    </>
  );
}
