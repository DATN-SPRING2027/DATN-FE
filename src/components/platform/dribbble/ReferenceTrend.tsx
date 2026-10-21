"use client";
import { useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import PlatformPagination from "../PlatformPagination";
import { useLocale, useTranslations } from "next-intl";
import { referenceSeries } from "./reference-series";
import styles from "../ui/operator.module.css";
export default function ReferenceTrend({ title }: { title: string }) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  const gradient = useId();
  const [hover, setHover] = useState(26);
  const [page, setPage] = useState(1);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(10);
  const totalDays = referenceSeries[0].length;
  const [visible, setVisible] = useState([true, true, true]);
  const colors = [
    "var(--op-chart-primary)",
    "var(--op-chart-teal)",
    "var(--op-chart-violet)",
  ];
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
  const selectPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    const matrix = svg.getScreenCTM?.();
    let viewX: number;
    if (matrix && typeof DOMPoint !== "undefined") {
      viewX = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      ).x;
    } else {
      const scale = Math.min(bounds.width / 800, bounds.height / 300);
      if (!scale) return;
      viewX =
        (event.clientX - bounds.left - (bounds.width - 800 * scale) / 2) /
        scale;
    }
    setHover(
      Math.max(
        0,
        Math.min(
          totalDays - 1,
          Math.round(((viewX - 38) / 714) * (totalDays - 1)),
        ),
      ),
    );
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas) return;
    const width =
      tooltipRef.current?.offsetWidth || Math.min(200, canvas.width - 16);
    const height = tooltipRef.current?.offsetHeight || 145;
    const cursorX = event.clientX - canvas.left;
    const cursorY = event.clientY - canvas.top;
    const left =
      cursorX + width + 16 <= canvas.width
        ? cursorX + 12
        : cursorX - width - 12;
    setTooltipPosition({
      left: Math.max(8, Math.min(canvas.width - width - 8, left)),
      top: Math.max(8, Math.min(canvas.height - height - 8, cursorY - 30)),
    });
  };
  return (
    <div className={styles.referenceTrend}>
      <p className="sr-only">{t("liveDashboard.simulated")}</p>
      <div className={styles.trendCanvas} ref={canvasRef}>
        <svg
          viewBox="0 0 800 300"
          role="img"
          aria-label={`${title} · ${t("liveDashboard.simulated")}`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setTooltipPosition(null);
              setHover((i) =>
                Math.max(
                  0,
                  Math.min(30, i + (event.key === "ArrowLeft" ? -1 : 1)),
                ),
              );
            }
          }}
          onPointerMove={selectPoint}
          onPointerDown={selectPoint}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--op-chart-primary)"
                stopOpacity=".12"
              />
              <stop
                offset="100%"
                stopColor="var(--op-chart-primary)"
                stopOpacity="0"
              />
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
          {visible[2] && (
            <path
              d={paths[2]}
              fill="none"
              stroke="var(--op-chart-yellow-edge)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
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
                  stroke={index === 2 ? "var(--op-chart-yellow-edge)" : "white"}
                  strokeWidth="2"
                />
              ),
          )}
          {[
            [0, "20"],
            [12, "Aug"],
            [21, "10"],
            [30, "19"],
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
          ref={tooltipRef}
          role="tooltip"
          style={
            tooltipPosition
              ? { left: tooltipPosition.left, top: tooltipPosition.top }
              : {
                  left: `${(x(hover) / 800) * 100}%`,
                  transform:
                    hover > 18
                      ? "translateX(calc(-100% - 12px))"
                      : "translateX(12px)",
                }
          }
          aria-hidden="true"
        >
          <p>{date}</p>
          {names.map(
            (name, index) =>
              visible[index] && (
                <div key={name} data-series={index}>
                  <span>
                    <i style={{ background: colors[index] }} />
                    {name}
                  </span>
                  <strong style={{ color: colors[index] }}>
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
            <caption className="sr-only">
              {t("liveDashboard.simulated")}
            </caption>
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
                  length: Math.min(pageSize, totalDays - (page - 1) * pageSize),
                },
                (_, index) => (page - 1) * pageSize + index,
              ).map((day) => (
                <tr key={day}>
                  <td>
                    {new Date(Date.UTC(2026, 6, 20 + day)).toLocaleDateString(
                      locale,
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      },
                    )}
                  </td>
                  {referenceSeries.map((values, i) => (
                    <td key={i}>{values[day].toLocaleString(locale)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PlatformPagination
          alwaysShow
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          page={page}
          totalPages={Math.ceil(totalDays / pageSize)}
          totalItems={totalDays}
          ariaLabel={t("liveDashboard.chartData")}
          onPageChange={setPage}
        />
      </details>
    </div>
  );
}
