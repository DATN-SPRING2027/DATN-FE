"use client";

import { useState, type CSSProperties } from "react";
import type { AiTokenUsageTaskKind } from "@/lib/queries/token-usage/useTokenUsage";
import { cn } from "@/utils";
import {
  formatCompactTokens,
  formatFullTokens,
  type AggregatedTokenUsage,
  type FocusFilter,
} from "./token-usage-data";
import { useGlide } from "./useTokenUsageSpring";

export type ChartGroupMode = "owner" | "task";

interface TokenUsageChartProps {
  readonly data: AggregatedTokenUsage;
  readonly chartMode: ChartGroupMode;
  readonly onChartModeChange: (mode: ChartGroupMode) => void;
  readonly ownerGroupLabel: string;
  readonly taskGroupLabel: string;
  readonly titleLabel: string;
  readonly unitLabel: string;
  readonly emptyLabel: string;
  readonly tokensUnitLabel: string;
  readonly callsUnitLabel: string;
  readonly taskNames: Readonly<Record<AiTokenUsageTaskKind, string>>;
  readonly focus: FocusFilter;
  readonly onSelectFocus: (next: FocusFilter) => void;
}

export default function TokenUsageChart({
  data,
  chartMode,
  onChartModeChange,
  ownerGroupLabel,
  taskGroupLabel,
  titleLabel,
  unitLabel,
  emptyLabel,
  tokensUnitLabel,
  callsUnitLabel,
  taskNames,
  focus,
  onSelectFocus,
}: TokenUsageChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const { containerRef: modeContainerRef, thumbRef: modeThumbRef } =
    useGlide<HTMLDivElement>(chartMode);

  const hoveredBucket =
    hoverIdx !== null ? (data.buckets[hoverIdx] ?? null) : null;
  const hoverPct =
    hoverIdx !== null && data.buckets.length > 0
      ? ((hoverIdx + 0.5) / data.buckets.length) * 100
      : 50;

  return (
    <div className="cu-usage-card-enter relative rounded-2xl border border-gray-200/90 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {/* Header Row: Title + Unit subtitle + Gliding Group Switch */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">
            {titleLabel}
          </h3>
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
            {unitLabel}
          </span>
        </div>

        <div
          ref={modeContainerRef}
          className="relative inline-flex items-center rounded-full bg-gray-100 p-0.5 dark:bg-white/[0.06]"
        >
          <span
            ref={modeThumbRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-white shadow-theme-xs dark:bg-gray-800"
          />
          <button
            type="button"
            data-pill="owner"
            onClick={() => onChartModeChange("owner")}
            className={cn(
              "relative z-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              chartMode === "owner"
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            {ownerGroupLabel}
          </button>
          <button
            type="button"
            data-pill="task"
            onClick={() => onChartModeChange("task")}
            className={cn(
              "relative z-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              chartMode === "task"
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            {taskGroupLabel}
          </button>
        </div>
      </div>

      {/* Plot Canvas */}
      <div
        className="relative grid grid-cols-[44px_1fr] gap-2.5 select-none"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y-Axis Labels */}
        <div className="flex h-[176px] flex-col justify-between pb-6 text-end text-[11px] font-normal tabular-nums text-gray-400 dark:text-gray-500">
          <span>{formatCompactTokens(data.axisTop)}</span>
          <span>{formatCompactTokens(data.axisTop / 2)}</span>
          <span>0</span>
        </div>

        {/* Plot Area */}
        <div className="relative h-[176px]">
          {/* Horizontal Dashed Gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            <div className="border-t border-dashed border-gray-200/80 dark:border-white/[0.07]" />
            <div className="border-t border-dashed border-gray-200/80 dark:border-white/[0.07]" />
            <div className="border-t border-gray-200 dark:border-white/[0.1]" />
          </div>

          {/* Empty Overlay */}
          {data.totals.tokens === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 z-2 flex items-center justify-center">
              <span className="rounded-full border border-gray-200/80 bg-white/90 px-3.5 py-1 text-xs font-medium text-gray-400 backdrop-blur-xs dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-500">
                {emptyLabel}
              </span>
            </div>
          )}

          {/* Stacked Bar Columns */}
          <div
            data-hover={hoverIdx !== null ? "true" : undefined}
            className="cu-usage-bars relative z-1 flex h-full items-stretch gap-1 px-1"
          >
            {data.buckets.map((bucket, idx) => {
              const rawSegments =
                chartMode === "owner" ? bucket.byOwner : bucket.byTask;
              const segments = rawSegments.map((seg) => ({
                ...seg,
                displayName:
                  chartMode === "task"
                    ? (taskNames[seg.id as AiTokenUsageTaskKind] ?? seg.name)
                    : seg.name,
              }));
              const isActive = hoverIdx === idx;
              const heightPct =
                bucket.tokens > 0 ? Math.max(3.5, bucket.pct) : 0;

              return (
                <div
                  key={bucket.index}
                  data-active={isActive ? "true" : undefined}
                  onMouseEnter={() => setHoverIdx(idx)}
                  className="cu-usage-col group relative flex min-w-0 flex-1 flex-col items-center cursor-pointer"
                >
                  <div className="relative flex w-full flex-1 items-end justify-center pb-[1px]">
                    {bucket.tokens > 0 ? (
                      <div
                        style={
                          {
                            height: `${heightPct}%`,
                            "--i": idx,
                          } as CSSProperties
                        }
                        className="cu-usage-stack flex w-full max-w-[30px] flex-col-reverse gap-[1.5px] overflow-hidden rounded-[6px]"
                      >
                        {segments.map((seg) => (
                          <i
                            key={seg.id}
                            style={{
                              flexGrow: Math.max(0.04, seg.share),
                              backgroundColor: seg.color,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "mb-[-1.5px] size-1 rounded-full transition-transform",
                          isActive
                            ? "scale-150 bg-gray-400 dark:bg-gray-500"
                            : "bg-gray-300/80 dark:bg-white/15",
                        )}
                      />
                    )}
                  </div>

                  {/* X-Axis Tick Label */}
                  <span
                    className={cn(
                      "flex h-6 items-center justify-center text-[11px] whitespace-nowrap tabular-nums transition-opacity",
                      bucket.showTick || isActive
                        ? "opacity-100"
                        : "opacity-0",
                      bucket.isLast || isActive
                        ? "font-medium text-gray-800 dark:text-gray-200"
                        : "font-normal text-gray-400 dark:text-gray-500",
                    )}
                  >
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hover Tooltip */}
          {hoveredBucket && (
            <div
              style={{
                left: `${Math.min(86, Math.max(14, hoverPct))}%`,
              }}
              className="pointer-events-none absolute top-1 z-20 min-w-[176px] -translate-x-1/2 rounded-xl border border-gray-200/90 bg-white/95 p-3 shadow-theme-lg backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95"
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <span>{hoveredBucket.fullLabel}</span>
                {hoveredBucket.calls > 0 && (
                  <span className="tabular-nums">
                    {hoveredBucket.calls.toLocaleString()} {callsUnitLabel}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 text-base font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
                <span>{formatFullTokens(hoveredBucket.tokens)}</span>
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  {tokensUnitLabel}
                </span>
              </div>

              {(chartMode === "owner"
                ? hoveredBucket.byOwner
                : hoveredBucket.byTask
              ).length > 0 && (
                <div className="mt-2 flex flex-col gap-1 border-t border-gray-100 pt-2 dark:border-gray-800">
                  {(chartMode === "owner"
                    ? hoveredBucket.byOwner
                    : hoveredBucket.byTask
                  )
                    .slice(0, 4)
                    .map((seg) => {
                      const label =
                        chartMode === "task"
                          ? (taskNames[seg.id as AiTokenUsageTaskKind] ??
                            seg.name)
                          : seg.name;
                      return (
                        <div
                          key={seg.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            style={{ backgroundColor: seg.color }}
                            className="size-2 shrink-0 rounded-full"
                          />
                          <span className="max-w-[120px] flex-1 truncate text-gray-600 dark:text-gray-300">
                            {label}
                          </span>
                          <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                            {formatCompactTokens(seg.tokens)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Legend Pills */}
      {(chartMode === "owner" ? data.legendOwners : data.legendTasks).length >
        0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chartMode === "owner"
            ? data.legendOwners.map((item) => {
                const isSelected =
                  focus?.kind === "owner" && focus.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onSelectFocus(
                        isSelected ? null : { kind: "owner", id: item.id },
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-normal transition-colors",
                      isSelected
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : "bg-gray-100/90 text-gray-700 hover:bg-gray-200/75 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.1]",
                    )}
                  >
                    <span
                      style={{ backgroundColor: item.color }}
                      className="size-2 shrink-0 rounded-full"
                    />
                    <span className="max-w-[160px] truncate">{item.name}</span>
                  </button>
                );
              })
            : data.legendTasks.map((item) => {
                const isSelected =
                  focus?.kind === "task" && focus.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onSelectFocus(
                        isSelected ? null : { kind: "task", id: item.id },
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-normal transition-colors",
                      isSelected
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : "bg-gray-100/90 text-gray-700 hover:bg-gray-200/75 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.1]",
                    )}
                  >
                    <span
                      style={{ backgroundColor: item.color }}
                      className="size-2 shrink-0 rounded-full"
                    />
                    <span>{taskNames[item.id]}</span>
                  </button>
                );
              })}
        </div>
      )}
    </div>
  );
}
