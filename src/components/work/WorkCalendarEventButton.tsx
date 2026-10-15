"use client";

import { useLocale, useTranslations } from "next-intl";
import type { WorkItem } from "./work-types";
import { formatCalendarDate } from "./work-calendar-utils";

export default function WorkCalendarEventButton({
  item,
  onOpenItem,
}: {
  item: WorkItem;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("work");

  return (
    <button
      type="button"
      onClick={(event) => onOpenItem(item, event.currentTarget)}
      aria-label={t("calendarEventLabel", {
        key: item.key,
        title: item.title,
        status: t(`statuses.${item.status}`),
        date: item.dueDate
          ? formatCalendarDate(new Date(`${item.dueDate}T00:00:00.000Z`), locale, { timeZone: "UTC" })
          : t("noDueDate"),
      })}
      title={`${item.key} · ${item.title}`}
      className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-brand-200 border-s-2 border-s-brand-500 bg-brand-50 px-1.5 py-1 text-start text-xs font-medium text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 sm:gap-2 sm:px-2 dark:border-brand-500/30 dark:border-s-brand-400 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      <span className="hidden shrink-0 text-[10px] font-normal text-brand-700 xl:inline dark:text-brand-300">{item.key}</span>
    </button>
  );
}
