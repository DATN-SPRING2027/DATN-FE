"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { CalenderIcon, ChevronDownIcon, ChevronLeftIcon } from "@/icons";

export interface HandoverDatePickerProps {
  id: string;
  value: string; // Canonical "YYYY-MM-DD" UTC date string
  onChange: (nextDate: string) => void;
  placeholder?: string;
  dialogLabel?: string;
  todayLabel?: string;
  prevMonthLabel?: string;
  nextMonthLabel?: string;
  utcNoteLabel?: string;
  relativeBadgeText?: string | null;
  relativeBadgeTone?: "brand" | "warning" | "neutral";
  presets?: readonly number[];
  formatPresetLabel?: (days: number) => string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}

interface ParsedUtcDate {
  year: number;
  month: number; // 0..11
  day: number; // 1..31
}

interface CalendarCell {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  ariaLabel: string;
}

interface PopoverPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export function utcDateOffsetIso(daysFromToday: number): string {
  const now = new Date();
  const ms = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysFromToday,
  );
  return new Date(ms).toISOString().slice(0, 10);
}

function parseIsoDate(value: string): ParsedUtcDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month, day));
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function toIsoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, deltaDays: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return utcDateOffsetIso(0);
  return toIsoDate(parsed.year, parsed.month, parsed.day + deltaDays);
}

const DEFAULT_PRESETS = [7, 14, 30, 60] as const;

export default function HandoverDatePicker({
  id,
  value,
  onChange,
  placeholder = "Choose target completion date…",
  dialogLabel = "Choose target completion date",
  todayLabel = "Today",
  prevMonthLabel = "Previous month",
  nextMonthLabel = "Next month",
  utcNoteLabel = "Evaluated at 00:00 UTC",
  relativeBadgeText = null,
  relativeBadgeTone = "brand",
  presets = DEFAULT_PRESETS,
  formatPresetLabel = (d) => `+${d}d`,
  invalid = false,
  disabled = false,
  describedBy,
}: HandoverDatePickerProps) {
  const locale = useLocale();
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const todayIso = useMemo(() => utcDateOffsetIso(0), []);
  const parsedValue = useMemo(() => parseIsoDate(value), [value]);

  const initialAnchor = useMemo(() => {
    if (parsedValue) return { year: parsedValue.year, month: parsedValue.month };
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  }, [parsedValue]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialAnchor.year);
  const [viewMonth, setViewMonth] = useState(initialAnchor.month);
  const [focusedIso, setFocusedIso] = useState<string>(value || todayIso);
  const [position, setPosition] = useState<PopoverPosition>({
    top: 0,
    left: 0,
    width: 320,
  });

  const displayDateText = useMemo(() => {
    if (!parsedValue) return "";
    const dt = new Date(
      Date.UTC(parsedValue.year, parsedValue.month, parsedValue.day),
    );
    try {
      return new Intl.DateTimeFormat(locale || "en-US", {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(dt);
    } catch {
      return value;
    }
  }, [locale, parsedValue, value]);

  const monthHeadingText = useMemo(() => {
    const dt = new Date(Date.UTC(viewYear, viewMonth, 1));
    try {
      return new Intl.DateTimeFormat(locale || "en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(dt);
    } catch {
      return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    }
  }, [locale, viewMonth, viewYear]);

  const weekdayLabels = useMemo(() => {
    // 2024-01-01 was a Monday in UTC
    const fmt = new Intl.DateTimeFormat(locale || "en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    return Array.from({ length: 7 }, (_, i) => {
      const label = fmt.format(new Date(Date.UTC(2024, 0, 1 + i)));
      return label.length > 3 ? label.slice(0, 2) : label;
    });
  }, [locale]);

  const calendarCells = useMemo<readonly CalendarCell[]>(() => {
    const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
    const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
    const ariaFormatter = new Intl.DateTimeFormat(locale || "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

    return Array.from({ length: 42 }, (_, index) => {
      const dayOffset = index - startOffset + 1;
      const cellDate = new Date(Date.UTC(viewYear, viewMonth, dayOffset));
      const isoDate = cellDate.toISOString().slice(0, 10);
      return {
        isoDate,
        dayNumber: cellDate.getUTCDate(),
        inCurrentMonth: cellDate.getUTCMonth() === viewMonth,
        isToday: isoDate === todayIso,
        isSelected: isoDate === value,
        ariaLabel: ariaFormatter.format(cellDate),
      };
    });
  }, [locale, todayIso, value, viewMonth, viewYear]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 1280;
    const viewportHeight = window.innerHeight || 800;
    const margin = 12;
    const desiredWidth = Math.min(332, viewportWidth - margin * 2);
    const clampedLeft = Math.max(
      margin,
      Math.min(rect.left, viewportWidth - desiredWidth - margin),
    );

    const measuredHeight = popoverRef.current?.offsetHeight || 364;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const placeAbove = spaceBelow < measuredHeight && spaceAbove > spaceBelow;

    setPosition(
      placeAbove
        ? {
            top: undefined,
            bottom: Math.max(margin, viewportHeight - rect.top + 6),
            left: clampedLeft,
            width: desiredWidth,
          }
        : {
            top: Math.min(
              viewportHeight - measuredHeight - margin,
              Math.max(margin, rect.bottom + 6),
            ),
            bottom: undefined,
            left: clampedLeft,
            width: desiredWidth,
          },
    );
  }, []);

  const openPopover = useCallback(() => {
    if (disabled) return;
    const targetIso = parsedValue ? value : todayIso;
    const targetParsed = parseIsoDate(targetIso);
    if (targetParsed) {
      setViewYear(targetParsed.year);
      setViewMonth(targetParsed.month);
    }
    setFocusedIso(targetIso);
    setIsOpen(true);
  }, [disabled, parsedValue, todayIso, value]);

  const closePopover = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition, viewMonth, viewYear]);

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      const btn = dayRefs.current.get(focusedIso);
      btn?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [focusedIso, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleCaptureKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePopover(true);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      closePopover(false);
    };

    const handleViewport = () => updatePosition();

    document.addEventListener("keydown", handleCaptureKeyDown, true);
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport, true);

    return () => {
      document.removeEventListener("keydown", handleCaptureKeyDown, true);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewport);
      window.removeEventListener("scroll", handleViewport, true);
    };
  }, [closePopover, isOpen, updatePosition]);

  const shiftMonth = (deltaMonths: number) => {
    const shifted = new Date(Date.UTC(viewYear, viewMonth + deltaMonths, 1));
    const nextYear = shifted.getUTCFullYear();
    const nextMonth = shifted.getUTCMonth();
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const commitDate = (isoDate: string) => {
    onChange(isoDate);
    const parsed = parseIsoDate(isoDate);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
    closePopover(true);
  };

  const moveFocusByDays = (delta: number) => {
    const nextIso = addUtcDays(focusedIso, delta);
    const parsed = parseIsoDate(nextIso);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
    setFocusedIso(nextIso);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (
      !isOpen &&
      (event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " ")
    ) {
      event.preventDefault();
      openPopover();
    }
  };

  const handlePopoverKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocusByDays(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocusByDays(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusByDays(-7);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocusByDays(7);
      return;
    }
    if (event.key === "Tab") {
      const trigger = triggerRef.current;
      const dialog = trigger?.closest('[role="dialog"]');
      if (trigger && dialog) {
        event.preventDefault();
        event.stopPropagation();
        const fields = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter(
          (node) => !node.closest('[hidden], [aria-hidden="true"], [inert]'),
        );
        const index = fields.indexOf(trigger);
        const next =
          fields[
            (index + (event.shiftKey ? -1 : 1) + fields.length) % fields.length
          ];
        (next ?? trigger).focus();
        closePopover(false);
      }
    }
  };

  const borderClass = invalid
    ? "border-error-400 focus:border-error-500 focus:ring-3 focus:ring-error-500/15 dark:border-error-500/70"
    : isOpen
      ? "border-brand-500 ring-3 ring-brand-500/15 dark:border-brand-400"
      : "border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:hover:border-gray-600";

  const badgeToneClass =
    relativeBadgeTone === "warning"
      ? "bg-warning-50 text-warning-700 ring-warning-200/80 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30"
      : relativeBadgeTone === "brand"
        ? "bg-brand-50 text-brand-700 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
        : "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700";

  const popoverNode =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label={dialogLabel}
            data-handover-listbox-portal="true"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handlePopoverKeyDown}
            style={{
              position: "fixed",
              ...(position.bottom !== undefined
                ? { bottom: `${position.bottom}px` }
                : { top: `${position.top ?? 0}px` }),
              left: `${position.left}px`,
              width: `${position.width}px`,
              zIndex: 100005,
            }}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl ring-1 ring-gray-950/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
          >
            {/* Quick Presets Header */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/60">
              <button
                type="button"
                onClick={() => commitDate(todayIso)}
                className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none ${
                  value === todayIso
                    ? "bg-brand-500 text-white shadow-theme-xs"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700"
                }`}
              >
                {todayLabel}
              </button>

              <div className="flex flex-wrap items-center gap-1">
                {presets.map((days) => {
                  const presetIso = utcDateOffsetIso(days);
                  const active = value === presetIso;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => commitDate(presetIso)}
                      className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none ${
                        active
                          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/40"
                          : "text-gray-600 hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
                      }`}
                    >
                      {formatPresetLabel(days)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Month Switcher */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button
                type="button"
                aria-label={prevMonthLabel}
                onClick={() => shiftMonth(-1)}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <ChevronLeftIcon
                  className="size-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </button>

              <span className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
                {monthHeadingText}
              </span>

              <button
                type="button"
                aria-label={nextMonthLabel}
                onClick={() => shiftMonth(1)}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <ChevronLeftIcon
                  className="size-4 rotate-180 rtl:rotate-0"
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Weekday Header */}
            <div
              aria-hidden="true"
              className="grid grid-cols-7 gap-1 px-3 pb-1 text-center"
            >
              {weekdayLabels.map((wd, i) => (
                <span
                  key={`${wd}-${i}`}
                  className="py-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500"
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* 6x7 Day Grid */}
            <div role="grid" className="grid grid-cols-7 gap-1 px-3 pb-2.5">
              {calendarCells.map((cell) => {
                const isFocused = cell.isoDate === focusedIso;
                return (
                  <button
                    key={cell.isoDate}
                    ref={(el) => {
                      if (el) {
                        dayRefs.current.set(cell.isoDate, el);
                      } else {
                        dayRefs.current.delete(cell.isoDate);
                      }
                    }}
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={cell.ariaLabel}
                    aria-pressed={cell.isSelected}
                    onClick={() => commitDate(cell.isoDate)}
                    className={`relative inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-lg text-xs tabular-nums transition-all focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${
                      cell.isSelected
                        ? "bg-brand-500 font-semibold text-white shadow-theme-xs hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
                        : cell.isToday
                          ? "bg-brand-50/75 font-semibold text-brand-700 ring-1 ring-brand-300/80 hover:bg-brand-100/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/40"
                          : cell.inCurrentMonth
                            ? "font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                            : "text-gray-400/75 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-600 dark:hover:bg-gray-800/50 dark:hover:text-gray-400"
                    }`}
                  >
                    <span>{cell.dayNumber}</span>
                    {cell.isToday && !cell.isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 size-1 rounded-full bg-brand-500 dark:bg-brand-400"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer UTC Meta */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
              <span>{utcNoteLabel}</span>
              {parsedValue && (
                <span className="font-mono font-medium text-gray-700 tabular-nums dark:text-gray-300">
                  {value}
                </span>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        data-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (isOpen) {
            closePopover(false);
          } else {
            openPopover();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`mt-1.5 flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-white px-2.5 py-2 text-start shadow-theme-xs transition-all focus:outline-none sm:gap-2.5 sm:px-3 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800/90 ${borderClass}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200/70 sm:size-7 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25"
          >
            <CalenderIcon className="size-3.5 sm:size-4" />
          </span>

          {displayDateText ? (
            <span className="truncate text-sm font-medium text-gray-900 tabular-nums dark:text-white">
              {displayDateText}
            </span>
          ) : (
            <span className="truncate text-sm text-gray-400 dark:text-gray-500">
              {placeholder}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {relativeBadgeText && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ring-1 sm:px-2 sm:text-xs ${badgeToneClass}`}
            >
              {relativeBadgeText}
            </span>
          )}
          <ChevronDownIcon
            aria-hidden="true"
            className={`size-4 shrink-0 text-gray-400 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-brand-600 dark:text-brand-400" : ""
            }`}
          />
        </span>
      </button>

      {popoverNode}
    </>
  );
}
