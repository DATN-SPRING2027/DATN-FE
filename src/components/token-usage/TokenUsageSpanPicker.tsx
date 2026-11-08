"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/icons";
import { cn } from "@/utils";
import {
  dayKey,
  startOfDay,
  type DateSpan,
} from "./token-usage-data";

interface TokenUsageSpanPickerProps {
  readonly span: DateSpan | null;
  readonly activeDayKeys: ReadonlySet<string>;
  readonly locale: string;
  readonly labels: {
    readonly thisMonth: string;
    readonly lastMonth: string;
    readonly thisYear: string;
    readonly selectStartDate: string;
    readonly selectEndDate: string;
    readonly daysUnit: string;
    readonly prevMonth: string;
    readonly nextMonth: string;
  };
  readonly onChange: (nextSpan: DateSpan) => void;
  readonly onClose: () => void;
}

const DAY_MS = 86_400_000;

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export default function TokenUsageSpanPicker({
  span,
  activeDayKeys,
  locale,
  labels,
  onChange,
  onClose,
}: TokenUsageSpanPickerProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => dayKey(today), [today]);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const anchor = span?.to ?? today;
    return new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  });
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (target.closest("[data-custom-span-trigger='true']")) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const monthFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }),
    [locale],
  );
  const shortDayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
      }),
    [locale],
  );
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // Sunday (2026-01-04) to Saturday
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2026, 0, 4 + i)),
    );
  }, [locale]);

  const effectiveRange = useMemo(() => {
    if (draftStart) {
      const end = hoverDate ?? draftStart;
      return draftStart <= end
        ? { from: draftStart, to: end }
        : { from: end, to: draftStart };
    }
    if (span) {
      return span.from <= span.to
        ? { from: startOfDay(span.from), to: startOfDay(span.to) }
        : { from: startOfDay(span.to), to: startOfDay(span.from) };
    }
    return null;
  }, [draftStart, hoverDate, span]);

  const rightMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    [viewMonth],
  );
  const canGoNext =
    rightMonth < new Date(today.getFullYear(), today.getMonth(), 1);

  const handlePickDate = (date: Date) => {
    if (date > today) return;
    if (!draftStart) {
      setDraftStart(date);
      setHoverDate(date);
      return;
    }
    const nextSpan: DateSpan =
      draftStart <= date
        ? { from: draftStart, to: date }
        : { from: date, to: draftStart };
    setDraftStart(null);
    setHoverDate(null);
    onChange(nextSpan);
    onClose();
  };

  const quickPresets = useMemo(() => {
    const thisMonthFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthFrom = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );
    const lastMonthTo = new Date(today.getFullYear(), today.getMonth(), 0);
    const thisYearFrom = new Date(today.getFullYear(), 0, 1);
    return [
      {
        id: "thisMonth",
        label: labels.thisMonth,
        from: thisMonthFrom,
        to: today,
      },
      {
        id: "lastMonth",
        label: labels.lastMonth,
        from: lastMonthFrom,
        to: lastMonthTo,
      },
      {
        id: "thisYear",
        label: labels.thisYear,
        from: thisYearFrom,
        to: today,
      },
    ];
  }, [labels.lastMonth, labels.thisMonth, labels.thisYear, today]);

  const selectedDayCount = effectiveRange
    ? Math.round(
        (effectiveRange.to.getTime() - effectiveRange.from.getTime()) / DAY_MS,
      ) + 1
    : 0;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={labels.selectStartDate}
      className="cu-usage-popover-enter absolute start-0 top-[calc(100%+8px)] z-50 w-[min(560px,calc(100vw-3rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Top Row: Quick Presets + Month Switcher */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {quickPresets.map((preset) => {
            const isMatched =
              !draftStart &&
              effectiveRange &&
              dayKey(effectiveRange.from) === dayKey(preset.from) &&
              dayKey(effectiveRange.to) === dayKey(preset.to);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setDraftStart(null);
                  onChange({ from: preset.from, to: preset.to });
                  onClose();
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  isMatched
                    ? "bg-brand-500 text-white shadow-theme-xs dark:bg-brand-500"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.1] dark:hover:text-white",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={labels.prevMonth}
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
              )
            }
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label={labels.nextMonth}
            disabled={!canGoNext}
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
              )
            }
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-35 dark:border-gray-800 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Dual Month Grids */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onMouseLeave={() => setHoverDate(null)}
      >
        {[0, 1].map((offset) => {
          const mDate = new Date(
            viewMonth.getFullYear(),
            viewMonth.getMonth() + offset,
            1,
          );
          const cells = buildMonthGrid(mDate.getFullYear(), mDate.getMonth());
          return (
            <div key={offset} className="min-w-0">
              <div className="mb-2 text-center text-xs font-semibold tracking-tight text-gray-800 capitalize dark:text-gray-200">
                {monthFmt.format(mDate)}
              </div>
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500">
                {weekdayLabels.map((w, i) => (
                  <span key={i} className="py-0.5">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((cell, idx) => {
                  if (!cell) {
                    return <span key={`empty-${idx}`} className="h-8" />;
                  }
                  const k = dayKey(cell);
                  const isFuture = cell > today;
                  const isToday = k === todayKey;
                  const hasData = activeDayKeys.has(k);
                  const tMs = cell.getTime();
                  const isStart =
                    effectiveRange !== null &&
                    tMs === effectiveRange.from.getTime();
                  const isEnd =
                    effectiveRange !== null &&
                    tMs === effectiveRange.to.getTime();
                  const isInRange =
                    effectiveRange !== null &&
                    tMs >= effectiveRange.from.getTime() &&
                    tMs <= effectiveRange.to.getTime();

                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={isFuture}
                      onClick={() => handlePickDate(cell)}
                      onMouseEnter={() => {
                        if (draftStart && !isFuture) setHoverDate(cell);
                      }}
                      className={cn(
                        "relative flex h-8 items-center justify-center text-xs font-medium tabular-nums transition-colors",
                        isFuture &&
                          "cursor-not-allowed text-gray-300 dark:text-gray-700",
                        !isFuture &&
                          !isInRange &&
                          "rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]",
                        isInRange &&
                          !isStart &&
                          !isEnd &&
                          "bg-brand-500/12 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
                        isStart &&
                          isEnd &&
                          "rounded-lg bg-brand-500 font-semibold text-white shadow-theme-xs",
                        isStart &&
                          !isEnd &&
                          "rounded-s-lg bg-brand-500 font-semibold text-white",
                        isEnd &&
                          !isStart &&
                          "rounded-e-lg bg-brand-500 font-semibold text-white",
                        isToday &&
                          !isStart &&
                          !isEnd &&
                          "font-bold text-brand-600 dark:text-brand-400",
                      )}
                    >
                      <span>{cell.getDate()}</span>
                      {hasData && (
                        <span
                          className={cn(
                            "absolute bottom-1 size-1 rounded-full",
                            isStart || isEnd
                              ? "bg-white/90"
                              : "bg-brand-500/75 dark:bg-brand-400/80",
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer status */}
      <div className="mt-3.5 flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <span>
          {draftStart
            ? `${shortDayFmt.format(draftStart)} → ${
                hoverDate && hoverDate.getTime() !== draftStart.getTime()
                  ? shortDayFmt.format(hoverDate)
                  : labels.selectEndDate
              }`
            : effectiveRange
              ? `${shortDayFmt.format(effectiveRange.from)} – ${shortDayFmt.format(effectiveRange.to)}`
              : labels.selectStartDate}
        </span>
        {selectedDayCount > 0 && (
          <span className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
            {selectedDayCount} {labels.daysUnit}
          </span>
        )}
      </div>
    </div>
  );
}
