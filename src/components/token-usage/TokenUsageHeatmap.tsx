"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/utils";
import {
  formatCompactTokens,
  formatFullTokens,
  type AggregatedTokenUsage,
  type HeatmapCell,
  type HeatmapMode,
} from "./token-usage-data";

interface TokenUsageHeatmapProps {
  readonly heatmap: AggregatedTokenUsage["heatmap"];
  readonly labels: {
    readonly title: string;
    readonly activeSummary: string;
    readonly daily: string;
    readonly weekly: string;
    readonly cumulative: string;
    readonly light: string;
    readonly heavy: string;
    readonly tokensUnit: string;
    readonly callsUnit: string;
    readonly lifetimeTokens: string;
    readonly peakDailyTokens: string;
    readonly longestStreak: string;
    readonly currentStreak: string;
    readonly daysUnit: string;
  };
}

const LEVEL_CLASSES: Readonly<Record<0 | 1 | 2 | 3 | 4, string>> = {
  0: "bg-gray-100 dark:bg-white/[0.06]",
  1: "bg-[#6366f1]/25 dark:bg-[#818cf8]/25",
  2: "bg-[#6366f1]/50 dark:bg-[#818cf8]/50",
  3: "bg-[#6366f1]/75 dark:bg-[#818cf8]/75",
  4: "bg-[#6366f1] dark:bg-[#818cf8]",
};

export default function TokenUsageHeatmap({
  heatmap,
  labels,
}: TokenUsageHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>("daily");
  const [hovered, setHovered] = useState<{
    cell: HeatmapCell;
    colIdx: number;
    rowIdx: number;
  } | null>(null);

  const cellTokens = (cell: HeatmapCell) =>
    mode === "daily"
      ? cell.dailyTokens
      : mode === "weekly"
        ? cell.weeklyTokens
        : cell.cumulativeTokens;

  const cellLevel = (cell: HeatmapCell): 0 | 1 | 2 | 3 | 4 =>
    mode === "daily"
      ? cell.dailyLevel
      : mode === "weekly"
        ? cell.weeklyLevel
        : cell.cumulativeLevel;

  return (
    <div className="cu-usage-card-enter relative rounded-2xl border border-gray-200/90 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {/* Header Row: Activity on left, Active summary + Daily | Weekly | Cumulative on right */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">
          {labels.title}
        </h3>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {labels.activeSummary}
          </span>

          <div className="inline-flex items-center gap-3 text-xs">
            {(
              [
                { id: "daily", label: labels.daily },
                { id: "weekly", label: labels.weekly },
                { id: "cumulative", label: labels.cumulative },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  mode === tab.id
                    ? "font-semibold text-gray-900 dark:text-white"
                    : "font-normal text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 53-Week × 7-Day Grid */}
      <div
        className="relative select-none"
        onMouseLeave={() => setHovered(null)}
      >
        {/* Month Labels */}
        <div className="mb-1.5 grid grid-cols-[repeat(53,minmax(0,1fr))] gap-[3px] text-[10px] font-normal text-gray-400 dark:text-gray-500">
          {heatmap.months.map((m) => (
            <span
              key={`${m.label}-${m.col}`}
              style={{ gridColumnStart: m.col + 1 }}
              className="whitespace-nowrap"
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-[repeat(53,minmax(0,1fr))] gap-[3px]">
          {heatmap.weeks.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
              {week.map((cell, dIdx) => {
                const lvl = cellLevel(cell);
                return (
                  <span
                    key={cell.key}
                    style={{ "--w": wIdx } as CSSProperties}
                    onMouseEnter={() => {
                      if (!cell.isFuture) {
                        setHovered({ cell, colIdx: wIdx, rowIdx: dIdx });
                      }
                    }}
                    className={cn(
                      "cu-usage-heat-cell aspect-square w-full rounded-[3px]",
                      LEVEL_CLASSES[lvl],
                      cell.isFuture && "pointer-events-none opacity-25",
                      cell.isToday &&
                        "ring-1 ring-gray-900/40 dark:ring-white/50",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Hover Tooltip */}
        {hovered && (
          <div
            style={{
              left: `${Math.min(88, Math.max(12, ((hovered.colIdx + 0.5) / 53) * 100))}%`,
            }}
            className="pointer-events-none absolute -top-2 z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200/90 bg-white/95 px-3 py-2 text-xs shadow-theme-lg backdrop-blur-md whitespace-nowrap dark:border-gray-800 dark:bg-gray-900/95"
          >
            <div className="font-medium text-gray-900 dark:text-white">
              {hovered.cell.label}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatFullTokens(cellTokens(hovered.cell))}{" "}
                {labels.tokensUnit}
              </span>
              {mode === "daily" && hovered.cell.dailyCalls > 0 && (
                <span>
                  · {hovered.cell.dailyCalls} {labels.callsUnit}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend: Light ▢▢▢▢ Heavy */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <span>{labels.light}</span>
        {([1, 2, 3, 4] as const).map((lvl) => (
          <span
            key={lvl}
            className={cn("size-2.5 rounded-[3px]", LEVEL_CLASSES[lvl])}
          />
        ))}
        <span>{labels.heavy}</span>
      </div>

      {/* Lifetime Stats Pill Strip (Matches Codex Reference Screenshot 2) */}
      <div className="mt-4 grid grid-cols-2 divide-y divide-gray-200/80 rounded-2xl border border-gray-200/80 py-3 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-gray-800 dark:border-gray-800">
        <div className="flex flex-col items-center justify-center px-3 py-1 text-center">
          <span className="text-sm font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
            {formatCompactTokens(heatmap.lifetimeTokens)}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {labels.lifetimeTokens}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center px-3 py-1 text-center">
          <span className="text-sm font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
            {formatCompactTokens(heatmap.peakDailyTokens)}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {labels.peakDailyTokens}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center px-3 py-1 text-center">
          <span className="text-sm font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
            {heatmap.longestStreak} {labels.daysUnit}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {labels.longestStreak}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center px-3 py-1 text-center">
          <span className="text-sm font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
            {heatmap.currentStreak} {labels.daysUnit}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {labels.currentStreak}
          </span>
        </div>
      </div>
    </div>
  );
}
