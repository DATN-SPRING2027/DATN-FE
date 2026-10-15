"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeftIcon } from "@/icons";
import { WorkStatusBadge } from "./WorkStatusBadge";
import WorkCalendarEventButton from "./WorkCalendarEventButton";
import type { WorkItem } from "./work-types";
import {
  formatCalendarDate,
  getCalendarDays,
  isCalendarToday,
  toCalendarDateKey,
} from "./work-calendar-utils";

export default function WorkCalendarView({
  items,
  month,
  onMonthChange,
  onOpenItem,
}: {
  items: readonly WorkItem[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("work");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const today = new Date();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const days = useMemo(() => getCalendarDays(month), [month]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "full" }), [locale]);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, index + 1)),
  );
  const itemsByDate = useMemo(() => {
    const result = new Map<string, WorkItem[]>();
    for (const item of items) {
      if (!item.dueDate) continue;
      result.set(item.dueDate, [...(result.get(item.dueDate) ?? []), item]);
    }
    return result;
  }, [items]);
  const monthItems = items.filter((item) => item.dueDate?.startsWith(monthKey));
  const unscheduledItems = items.filter((item) => !item.dueDate);
  const selectedItems = selectedDay ? itemsByDate.get(selectedDay) ?? [] : [];

  function changeMonth(offset: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelectedDay(null);
  }

  function goToToday() {
    const today = new Date();
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(toCalendarDateKey(today));
  }

  return (
    <section aria-labelledby="work-calendar-title" className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h2 id="work-calendar-title" className="text-base font-semibold text-gray-900 dark:text-white/90">
            {t("calendarTitle")}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("calendarSummary", { scheduled: monthItems.length, unscheduled: unscheduledItems.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("calendarNavigation")}>
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label={t("previousMonth")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
          <h3 className="min-w-36 text-center text-sm font-semibold text-gray-900 dark:text-white/90" aria-live="polite">
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label={t("nextMonth")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t("today")}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full table-fixed border-collapse" aria-label={t("calendarGridLabel", { month: monthLabel })}>
          <thead className="bg-gray-50 dark:bg-gray-800/70">
            <tr>
              {weekdays.map((weekday) => (
                <th key={weekday} scope="col" className="border border-gray-200 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-2 sm:py-3 sm:text-xs dark:border-gray-800 dark:text-gray-400">
                  {weekday}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: days.length / 7 }, (_, weekIndex) => (
              <tr key={toCalendarDateKey(days[weekIndex * 7])}>
                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
                  const dateKey = toCalendarDateKey(day);
                  const dayItems = itemsByDate.get(dateKey) ?? [];
                  const isCurrentMonth = day.getMonth() === month.getMonth();
                  const isToday = isCalendarToday(day, today);
                  const isSelected = selectedDay === dateKey;

                  return (
                    <td key={dateKey} className={`h-24 border border-gray-200 p-1 align-top sm:h-32 sm:p-2 dark:border-gray-800 ${isCurrentMonth ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-950/50"} ${isSelected ? "ring-2 ring-inset ring-brand-500" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedDay(dateKey)}
                        aria-label={t("selectCalendarDay", { date: dateFormat.format(day) })}
                        aria-pressed={isSelected}
                        className={`flex min-h-6 cursor-pointer items-center rounded px-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 sm:h-7 ${isToday ? "bg-brand-500 font-semibold text-white hover:bg-brand-600 dark:text-white" : isCurrentMonth ? "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800" : "text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-800"} ${isSelected && !isToday ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : ""}`}
                      >
                        <time dateTime={dateKey} aria-current={isToday ? "date" : undefined}>
                          {day.getDate()}
                        </time>
                      </button>
                      <ul className="mt-1 hidden space-y-1 sm:block">
                        {dayItems.map((item) => (
                          <li key={item.id}>
                            <WorkCalendarEventButton item={item} onOpenItem={onOpenItem} />
                          </li>
                        ))}
                      </ul>
                      {dayItems.length > 0 && (
                        <div aria-hidden="true" className="mt-1 flex items-center gap-1 sm:hidden">
                          {dayItems.slice(0, 3).map((item) => (
                            <span key={item.id} className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                          ))}
                          <span className="truncate text-[9px] text-gray-500 dark:text-gray-400">{dayItems.length}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {monthItems.length === 0 && (
          <div role="status" className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("emptyCalendarTitle")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("emptyCalendarDescription")}</p>
          </div>
        )}
      </div>

      {selectedDay && (
        <section aria-live="polite" aria-labelledby="calendar-day-title" className="rounded-xl border border-gray-200 bg-white p-4 sm:hidden dark:border-gray-800 dark:bg-gray-900">
          <h3 id="calendar-day-title" className="mb-3 text-sm font-semibold text-gray-900 dark:text-white/90">
            {t("calendarTasksOnDate", { date: formatCalendarDate(new Date(`${selectedDay}T00:00:00.000Z`), locale, { timeZone: "UTC" }) })}
          </h3>
          {selectedItems.length ? (
            <ul className="space-y-2">
              {selectedItems.map((item) => <li key={item.id}><WorkCalendarEventButton item={item} onOpenItem={onOpenItem} /></li>)}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("noTasksOnDate")}</p>
          )}
        </section>
      )}

      {unscheduledItems.length > 0 && (
        <section aria-labelledby="calendar-unscheduled-title" className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3">
            <h3 id="calendar-unscheduled-title" className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("unscheduled")}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("unscheduledDescription")}</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unscheduledItems.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                <button type="button" onClick={(event) => onOpenItem(item, event.currentTarget)} aria-label={t("openWorkItem", { key: item.key, title: item.title })} className="min-w-0 flex-1 truncate text-start text-sm font-medium text-gray-800 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:text-brand-400">
                  <span className="me-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">{item.key}</span>{item.title}
                </button>
                <WorkStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
