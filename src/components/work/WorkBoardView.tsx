"use client";

import { useTranslations } from "next-intl";
import { TaskIcon } from "@/icons";
import { WORK_STATUS_ORDER, type WorkItem, type WorkStatus } from "./work-types";
import { WorkStatusBadge } from "./WorkStatusBadge";

export default function WorkBoardView({
  items,
  onOpenItem,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("work");

  return (
    <div className="min-w-0 pb-2">
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {WORK_STATUS_ORDER.map((status) => {
          const columnItems = items.filter((item) => item.status === status);
          return (
            <section
              key={status}
              aria-labelledby={`work-column-${status}`}
              className="min-w-0 rounded-xl bg-gray-100/80 p-2.5 dark:bg-gray-800/60 sm:p-3"
            >
              <div className="flex items-center justify-between px-1 pb-2.5">
                <h2 id={`work-column-${status}`} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {t(`statuses.${status}`)}
                  <span className="ms-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {columnItems.length}
                  </span>
                </h2>
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              <ul className="flex min-h-40 flex-col gap-2.5">
                {columnItems.length === 0 ? (
                  <li className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-gray-300 px-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t("emptyColumn")}
                  </li>
                ) : (
                  columnItems.map((item) => (
                    <WorkCard key={item.id} item={item} status={status} onOpenItem={onOpenItem} />
                  ))
                )}
              </ul>
              <p className="mt-2 px-1 text-[11px] text-gray-400 dark:text-gray-500">
                {t("boardPreviewHint")}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WorkCard({
  item,
  status,
  onOpenItem,
}: {
  item: WorkItem;
  status: WorkStatus;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("work");
  const assignee = item.assignee;

  return (
    <li>
      <article className="rounded-lg border border-gray-200 bg-white p-3 shadow-theme-xs transition-colors hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500">
        <button
          type="button"
          onClick={(event) => onOpenItem(item, event.currentTarget)}
          aria-label={t("openWorkItem", { key: item.key, title: item.title })}
          className="block w-full cursor-pointer rounded-md text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <span className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-gray-900 dark:text-white/90">
            {item.title}
          </span>
          <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-sm bg-brand-500" />
          <span className="truncate">{item.projectName}</span>
          </span>
          <span className="mt-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400">
            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded border border-brand-300 text-[9px] dark:border-brand-500/50">✓</span>
            {item.key}
          </span>
          <WorkStatusBadge status={status} />
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-800">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <TaskIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t("subtasks")}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-gray-800">
              {t("subtaskProgress", {
                completed: item.subtasks.completed,
                total: item.subtasks.total,
              })}
            </span>
          </span>
          {assignee && (
            <span
              aria-label={t("assignedTo", { name: assignee.name })}
              title={assignee.name}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {assignee.initials}
            </span>
          )}
        </div>
      </article>
    </li>
  );
}
