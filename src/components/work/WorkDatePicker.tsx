"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { tr } from "@/i18n/tr";
import { MonoIcon } from "./WorkMonoIcons";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function toIsoDateString(year: number, monthIndex: number, day: number): string {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDateParts(value?: string | null): {
  year: number;
  monthIndex: number;
  day: number;
} | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, monthIndex, day };
}

function getTodayIso(): string {
  const now = new Date();
  return toIsoDateString(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDaysToTodayIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDateString(date.getFullYear(), date.getMonth(), date.getDate());
}

type CalendarCell = Readonly<{
  iso: string;
  day: number;
  inCurrentMonth: boolean;
}>;

function buildCalendarGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    const prevDate = new Date(year, monthIndex - 1, day);
    cells.push({
      iso: toIsoDateString(
        prevDate.getFullYear(),
        prevDate.getMonth(),
        prevDate.getDate(),
      ),
      day,
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      iso: toIsoDateString(year, monthIndex, day),
      day,
      inCurrentMonth: true,
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= remaining; day += 1) {
    const nextDate = new Date(year, monthIndex + 1, day);
    cells.push({
      iso: toIsoDateString(
        nextDate.getFullYear(),
        nextDate.getMonth(),
        nextDate.getDate(),
      ),
      day,
      inCurrentMonth: false,
    });
  }

  return cells;
}

export function WorkDatePickerCell({
  value,
  itemKey,
  placeholder,
  disabled = false,
  align = "start",
  onChange,
}: {
  value: string | null | undefined;
  itemKey: string;
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "end";
  onChange?: (nextDate: string | null) => void;
}) {
  const t = useTranslations("work");
  const localeCode = tr(useTranslations("common"), "localeCode", "en");
  const isVi = localeCode === "vi";
  const resolvedPlaceholder = placeholder ?? tr(t, "datePicker.none", "None");
  const monthNames = useMemo(() => {
    if (!isVi) return MONTH_NAMES;
    const fmt = new Intl.DateTimeFormat("vi-VN", { month: "long" });
    return Array.from({ length: 12 }, (_, idx) => fmt.format(new Date(2026, idx, 1)));
  }, [isVi]);
  const weekdayLabels = isVi ? (["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const) : WEEKDAY_LABELS;
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const parsed = parseIsoDateParts(value);
  const todayIso = getTodayIso();
  const todayParts = parseIsoDateParts(todayIso)!;

  const [viewYear, setViewYear] = useState<number>(
    parsed?.year ?? todayParts.year,
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsed?.monthIndex ?? todayParts.monthIndex,
  );
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const openPicker = () => {
    if (disabled || !onChange) return;
    const currentParsed = parseIsoDateParts(value);
    if (currentParsed) {
      setViewYear(currentParsed.year);
      setViewMonth(currentParsed.monthIndex);
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    function updatePosition(event?: Event) {
      if (
        event?.type === "scroll" &&
        event.target instanceof Node &&
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      const triggerEl = triggerRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const menuEl = popoverRef.current;
      const menuWidth = menuEl?.offsetWidth || 272;
      const menuHeight = menuEl?.offsetHeight || 310;
      const viewportW =
        typeof window !== "undefined" ? window.innerWidth : 1280;
      const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 800;

      const shouldFlipUp =
        rect.bottom + menuHeight + 12 > viewportH &&
        rect.top - menuHeight - 8 > 8;
      const top = shouldFlipUp
        ? Math.max(8, rect.top - menuHeight - 4)
        : Math.max(8, rect.bottom + 4);

      const rawLeft = align === "end" ? rect.right - menuWidth : rect.left;
      const left = Math.max(
        8,
        Math.min(rawLeft, Math.max(8, viewportW - menuWidth - 8)),
      );

      setCoords((prev) =>
        prev.top === top && prev.left === left ? prev : { top, left },
      );
    }

    updatePosition();
    const rafId =
      typeof window !== "undefined"
        ? window.requestAnimationFrame(() => updatePosition())
        : null;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (rafId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [align, isOpen]);

  const calendarCells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const yearOptions = useMemo(() => {
    const baseYear = todayParts.year;
    const years: number[] = [];
    for (let y = baseYear - 5; y <= baseYear + 8; y += 1) {
      years.push(y);
    }
    if (!years.includes(viewYear)) {
      years.push(viewYear);
      years.sort((a, b) => a - b);
    }
    return years;
  }, [todayParts.year, viewYear]);

  function stepMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function selectDate(nextIso: string | null) {
    onChange?.(nextIso);
    setIsOpen(false);
  }

  const normalizedValue = value ? value.slice(0, 10) : null;
  const isOverdue = Boolean(normalizedValue && normalizedValue < todayIso);

  const popoverNode = isOpen ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Select due date for ${itemKey}`}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-[80] w-68 rounded-md border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Month & Year Selector Header */}
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ‹
        </button>

        <div className="flex flex-1 items-center justify-center gap-1">
          <select
            aria-label={`Month for ${itemKey}`}
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="h-7 cursor-pointer rounded border border-gray-200 bg-white px-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {monthNames.map((name, idx) => (
              <option key={name} value={idx}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label={`Year for ${itemKey}`}
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="h-7 cursor-pointer rounded border border-gray-200 bg-white px-1.5 text-xs font-semibold tabular-nums text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ›
        </button>
      </div>

      {/* Weekday Header */}
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {weekdayLabels.map((dayLabel) => (
          <span key={dayLabel} className="py-1">
            {dayLabel}
          </span>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarCells.map((cell) => {
          const isSelected = normalizedValue === cell.iso;
          const isToday = todayIso === cell.iso;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => selectDate(cell.iso)}
              aria-label={`Set due date ${cell.iso}`}
              aria-pressed={isSelected}
              className={`flex h-7 w-full cursor-pointer items-center justify-center rounded text-xs tabular-nums transition ${
                isSelected
                  ? "bg-brand-600 font-semibold text-white shadow-theme-xs"
                  : isToday
                    ? "border border-brand-500 font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
                    : cell.inCurrentMonth
                      ? "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      : "text-gray-400 hover:bg-gray-50 dark:text-gray-600 dark:hover:bg-gray-800/60"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Quick Presets & Clear Footer */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 border-t border-gray-100 pt-2 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => selectDate(todayIso)}
            className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {tr(t, "datePicker.today", "Today")}
          </button>
          <button
            type="button"
            onClick={() => selectDate(addDaysToTodayIso(1))}
            className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {tr(t, "datePicker.tomorrow", "Tomorrow")}
          </button>
          <button
            type="button"
            onClick={() => selectDate(addDaysToTodayIso(7))}
            className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            +7d
          </button>
        </div>

        {normalizedValue && (
          <button
            type="button"
            onClick={() => selectDate(null)}
            className="cursor-pointer rounded px-2 py-1 text-[11px] font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/15"
          >
            {tr(t, "datePicker.clear", "Clear")}
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || !onChange}
        onClick={openPicker}
        title={`Click to change due date for ${itemKey}`}
        aria-label={`Due date for ${itemKey}`}
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-xs tabular-nums transition ${
          disabled || !onChange
            ? "cursor-default"
            : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        } ${
          isOpen
            ? "bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15"
            : ""
        } ${
          normalizedValue
            ? isOverdue
              ? "font-medium text-error-600 dark:text-error-400"
              : "text-gray-700 dark:text-gray-200"
            : "text-gray-400 dark:text-gray-500"
        }`}
      >
        <MonoIcon name="calendar" className="h-3.5 w-3.5 shrink-0 opacity-75" />
        <span>{normalizedValue ?? resolvedPlaceholder}</span>
      </button>

      {isOpen &&
        (typeof document !== "undefined"
          ? createPortal(popoverNode, document.body)
          : popoverNode)}
    </div>
  );
}
