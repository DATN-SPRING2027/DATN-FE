"use client";

import { useMemo, useState } from"react";
import { useLocale, useTranslations } from"next-intl";
import { ChevronLeftIcon } from"@/icons";
import { MonoIcon } from"./WorkMonoIcons";
import { WorkStatusBadge } from"./WorkStatusBadge";
import WorkCalendarEventButton from"./WorkCalendarEventButton";
import type { WorkItem } from"./work-types";
import {
  formatCalendarDate,
  getCalendarDays,
  isCalendarToday,
  toCalendarDateKey,
} from"./work-calendar-utils";

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
  const [unscheduledDrawerOpen, setUnscheduledDrawerOpen] = useState(true);
  const [unscheduledSearch, setUnscheduledSearch] = useState("");
  const [showSprintBanner, setShowSprintBanner] = useState(true);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month:"long",
    year:"numeric",
  }).format(month);
  const today = new Date();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2,"0")}`;
  const days = useMemo(() => getCalendarDays(month), [month]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle:"full"}),
    [locale],
  );
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday:"short"}).format(
      new Date(2024, 0, index + 1),
    ),
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
  const filteredUnscheduled = unscheduledItems.filter((item) =>
    !unscheduledSearch.trim()
      ? true
      : `${item.key} ${item.title}`
          .toLowerCase()
          .includes(unscheduledSearch.trim().toLowerCase()),
  );
  const selectedItems = selectedDay ? (itemsByDate.get(selectedDay) ?? []) : [];

  function changeMonth(offset: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelectedDay(null);
  }

  function goToToday() {
    const todayDate = new Date();
    onMonthChange(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    setSelectedDay(toCalendarDateKey(todayDate));
  }

  return (
    <section
      aria-labelledby="work-calendar-title"
      className="min-w-0 space-y-4"
    >
      <div className="flex flex-col gap-3 border border-gray-200 bg-white p-4 shadow-theme-xs sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h2
            id="work-calendar-title"
            className="text-base font-semibold text-gray-900 dark:text-white/90"
          >
            {t("calendarTitle")}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("calendarSummary", {
              scheduled: monthItems.length,
              unscheduled: unscheduledItems.length,
            })}
          </p>
        </div>
        <div
          className="relative flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("calendarNavigation")}
        >
          <button
            type="button"
            onClick={goToToday}
            className="h-9 cursor-pointer border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t("today")}
          </button>
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label={t("previousMonth")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </button>
          <h3
            className="min-w-36 text-center text-sm font-semibold text-gray-900 dark:text-white/90"
            aria-live="polite"
          >
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label={t("nextMonth")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon
              className="h-4 w-4 rotate-180 rtl:rotate-0"
              aria-hidden="true"
            />
          </button>

          {/* Jira Cloud Unscheduled Work Drawer Toggle (`36-tab-calendar.png`) */}
          <button
            type="button"
            aria-pressed={unscheduledDrawerOpen}
            onClick={() => setUnscheduledDrawerOpen((prev) => !prev)}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 border px-3 text-xs font-semibold transition ${
              unscheduledDrawerOpen
                ?"border-gray-800 bg-gray-100 text-gray-900 dark:border-gray-400 dark:bg-gray-800 dark:text-white"
                :"border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            }`}
          >
            <MonoIcon name="calendar"size={14} />
            <span>Unscheduled ({unscheduledItems.length})</span>
          </button>

          {/* Jira Cloud Calendar View Settings (`37-calendar-view-settings.png`) */}
          <button
            type="button"
            aria-expanded={viewSettingsOpen}
            onClick={() => setViewSettingsOpen((prev) => !prev)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <MonoIcon name="sliders"size={14} />
            <span>View settings</span>
          </button>

          {viewSettingsOpen && (
            <div
              role="dialog"
              aria-label="Calendar view settings"
              className="absolute end-0 top-full z-30 mt-2 w-60 border border-gray-200 bg-white p-3.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="mb-2 text-xs font-semibold text-gray-900 dark:text-white">
                Calendar display options
              </p>
              <label className="flex cursor-pointer items-center justify-between text-xs text-gray-700 dark:text-gray-300">
                <span>Show active sprints</span>
                <input
                  type="checkbox"
                  checked={showSprintBanner}
                  onChange={(e) => setShowSprintBanner(e.target.checked)}
                  className="h-4 w-4 border-gray-300 text-brand-600"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Jira Horizontal Sprint Banner across Calendar (`36-tab-calendar.png`) */}
      {showSprintBanner && (
        <div className="flex items-center justify-between border border-gray-300 bg-gray-100/80 px-4 py-2 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-200">
          <span className="inline-flex items-center gap-2">
            <MonoIcon name="sync"size={13} />
            <span>SCRUM Sprint 1 • Active Sprint Window</span>
          </span>
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {monthItems.length} scheduled items in {monthLabel}
          </span>
        </div>
      )}

      <div
        className={`grid min-w-0 grid-cols-1 gap-4 ${
          unscheduledDrawerOpen && unscheduledItems.length > 0
            ?"xl:grid-cols-[minmax(0,1fr)_20rem]"
            :""
        }`}
      >
        <div className="overflow-hidden border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <table
            className="w-full table-fixed border-collapse"
            aria-label={t("calendarGridLabel", { month: monthLabel })}
          >
            <thead className="bg-gray-50 dark:bg-gray-800/70">
              <tr>
                {weekdays.map((weekday) => (
                  <th
                    key={weekday}
                    scope="col"
                    className="border border-gray-200 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-2 sm:py-3 sm:text-xs dark:border-gray-800 dark:text-gray-400"
                  >
                    {weekday}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: days.length / 7 }, (_, weekIndex) => (
                <tr key={toCalendarDateKey(days[weekIndex * 7])}>
                  {days
                    .slice(weekIndex * 7, weekIndex * 7 + 7)
                    .map((day) => {
                      const dateKey = toCalendarDateKey(day);
                      const dayItems = itemsByDate.get(dateKey) ?? [];
                      const isCurrentMonth =
                        day.getMonth() === month.getMonth();
                      const isToday = isCalendarToday(day, today);
                      const isSelected = selectedDay === dateKey;

                      return (
                        <td
                          key={dateKey}
                          className={`h-24 border border-gray-200 p-1 align-top sm:h-32 sm:p-2 dark:border-gray-800 ${
                            isCurrentMonth
                              ?"bg-white dark:bg-gray-900"
                              :"bg-gray-50 dark:bg-gray-950/50"
                          } ${isSelected ?"ring-2 ring-inset ring-brand-500":""}`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDay(dateKey)}
                            aria-label={t("selectCalendarDay", {
                              date: dateFormat.format(day),
                            })}
                            aria-pressed={isSelected}
                            className={`flex min-h-6 cursor-pointer items-center px-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 sm:h-7 ${
                              isToday
                                ?"bg-brand-500 font-semibold text-white hover:bg-brand-600 dark:text-white"
                                : isCurrentMonth
                                  ?"text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                  :"text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-800"
                            } ${
                              isSelected && !isToday
                                ?"bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                                :""
                            }`}
                          >
                            <time
                              dateTime={dateKey}
                              aria-current={isToday ?"date": undefined}
                            >
                              {day.getDate()}
                            </time>
                          </button>
                          <ul className="mt-1 hidden space-y-1 sm:block">
                            {dayItems.map((item) => (
                              <li key={item.id}>
                                <WorkCalendarEventButton
                                  item={item}
                                  onOpenItem={onOpenItem}
                                />
                              </li>
                            ))}
                          </ul>
                          {dayItems.length > 0 && (
                            <div
                              aria-hidden="true"
                              className="mt-1 flex items-center gap-1 sm:hidden"
                            >
                              {dayItems.slice(0, 3).map((item) => (
                                <span
                                  key={item.id}
                                  className="h-1.5 w-1.5 bg-brand-500"
                                />
                              ))}
                              <span className="truncate text-[9px] text-gray-500 dark:text-gray-400">
                                {dayItems.length}
                              </span>
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
            <div
              role="status"
              className="border-t border-gray-200 px-4 py-4 dark:border-gray-800"
            >
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("emptyCalendarTitle")}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("emptyCalendarDescription")}
              </p>
            </div>
          )}
        </div>

        {/* Jira Collapsible Right Unscheduled Work Drawer (`36-tab-calendar.png`) */}
        {unscheduledDrawerOpen && unscheduledItems.length > 0 && (
          <section
            aria-labelledby="calendar-unscheduled-title"
            className="border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3
                  id="calendar-unscheduled-title"
                  className="text-sm font-semibold text-gray-900 dark:text-white/90"
                >
                  {t("unscheduled")}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("unscheduledDescription")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUnscheduledDrawerOpen(false)}
                aria-label="Close unscheduled work drawer"
                className="cursor-pointer p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <input
              type="search"
              value={unscheduledSearch}
              onChange={(e) => setUnscheduledSearch(e.target.value)}
              placeholder="Search unscheduled items"
              className="mb-3 h-8 w-full border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />

            <ul className="space-y-2">
              {filteredUnscheduled.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 items-center gap-2 border border-gray-200 p-2.5 transition hover:border-brand-300 dark:border-gray-800"
                >
                  <button
                    type="button"
                    onClick={(event) => onOpenItem(item, event.currentTarget)}
                    aria-label={t("openWorkItem", {
                      key: item.key,
                      title: item.title,
                    })}
                    className="min-w-0 flex-1 truncate text-start text-sm font-medium text-gray-800 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:text-brand-400"
                  >
                    <span className="me-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
                      {item.key}
                    </span>
                    {item.title}
                  </button>
                  <WorkStatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {selectedDay && (
        <section
          aria-live="polite"
          aria-labelledby="calendar-day-title"
          className="border border-gray-200 bg-white p-4 sm:hidden dark:border-gray-800 dark:bg-gray-900"
        >
          <h3
            id="calendar-day-title"
            className="mb-3 text-sm font-semibold text-gray-900 dark:text-white/90"
          >
            {t("calendarTasksOnDate", {
              date: formatCalendarDate(
                new Date(`${selectedDay}T00:00:00.000Z`),
                locale,
                { timeZone:"UTC"},
              ),
            })}
          </h3>
          {selectedItems.length ? (
            <ul className="space-y-2">
              {selectedItems.map((item) => (
                <li key={item.id}>
                  <WorkCalendarEventButton
                    item={item}
                    onOpenItem={onOpenItem}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("noTasksOnDate")}
            </p>
          )}
        </section>
      )}
    </section>
  );
}
