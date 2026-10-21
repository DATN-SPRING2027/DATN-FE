"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ApexOptions } from "apexcharts";
import { operatorDemoDates, operatorDemoSeries } from "./operator-demo";
import styles from "../ui/operator.module.css";
const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className={styles.chartLoading} aria-busy="true" />,
});
export default function OperatorReferenceChart({
  title,
  compact = false,
  bars = false,
}: {
  title?: string;
  compact?: boolean;
  bars?: boolean;
}) {
  const t = useTranslations("platformConsole");
  const mode = bars ? "bar" : "area";
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  const series = [
    {
      name: title ?? t("referenceCharts.total"),
      data: operatorDemoSeries[0].data.map((y, index) => ({
        x: operatorDemoDates[index],
        y,
      })),
    },
  ];
  const options: ApexOptions = {
    chart: {
      type: mode,
      fontFamily: "OperatorInter, sans-serif",
      background: "transparent",
      toolbar: { show: false },
      animations: { enabled: false },
      sparkline: { enabled: compact },
      zoom: { enabled: false },
    },
    colors: [dark ? "#8098f9" : "#465fff"],
    theme: { mode: dark ? "dark" : "light" },
    stroke: {
      curve: "straight",
      width: compact ? 1.5 : 2,
      dashArray: 0,
    },
    fill: {
      type: mode === "area" ? "gradient" : "solid",
      gradient: {
        shadeIntensity: 0,
        opacityFrom: 0.16,
        opacityTo: 0.01,
        stops: [0, 100],
      },
      opacity: 1,
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      show: !compact,
      borderColor: dark ? "#344054" : "#e4e7ec",
      strokeDashArray: 3,
      padding: { left: 6, right: 6 },
    },
    xaxis: {
      type: "datetime",
      labels: {
        datetimeUTC: true,
        format: "dd MMM",
        style: { colors: "#667085", fontSize: "11px" },
      },
      axisBorder: { show: true, color: dark ? "#344054" : "#e4e7ec" },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#667085", fontSize: "11px" },
        formatter: (value) => Math.round(value).toString(),
      },
    },
    plotOptions: {
      bar: { columnWidth: compact ? "55%" : "45%", borderRadius: 1 },
    },
    tooltip: {
      enabled: !compact,
      shared: true,
      intersect: false,
      x: { format: "dd MMM yyyy" },
      y: { formatter: (value) => Math.round(value).toLocaleString() },
    },
    noData: { text: t("referenceCharts.selectSeries") },
  };
  return (
    <div className={compact ? styles.sparkline : styles.referenceChart}>
      {!compact && (
        <div className={styles.chartHeader}>
          <h2 className={styles.heading}>{title}</h2>
        </div>
      )}
      <div role="img" aria-label={t("referenceCharts.notice")}>
        <Chart
          options={options}
          series={series}
          type={mode}
          height={compact ? 45 : 250}
        />
      </div>
      <span className="sr-only">{t("referenceCharts.notice")}</span>
    </div>
  );
}
