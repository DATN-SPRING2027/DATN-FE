"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, TaskIcon } from "@/icons";
import {
  WORK_STATUS_ORDER,
  type WorkItem,
  type WorkStatus,
} from "./work-types";
import { WorkStatusBadge } from "./WorkStatusBadge";

const WIP_LIMIT_IN_PROGRESS = 4;

export default function WorkBoardView({
  items,
  onOpenItem,
  onStatusChange,
  onQuickCreate,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onQuickCreate?: (title: string, status: WorkStatus) => void;
}) {
  const t = useTranslations("work");
  const [dragOverColumn, setDragOverColumn] = useState<WorkStatus | null>(null);
  const [quickCreateColumn, setQuickCreateColumn] =
    useState<WorkStatus | null>(null);
  const [quickTitle, setQuickTitle] = useState("");

  function handleQuickCreate(
    event: FormEvent<HTMLFormElement>,
    status: WorkStatus,
  ) {
    event.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed || !onQuickCreate) return;
    onQuickCreate(trimmed, status);
    setQuickTitle("");
    setQuickCreateColumn(null);
  }

  return (
    <div className="min-w-0 pb-2">
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {WORK_STATUS_ORDER.map((status) => {
          const columnItems = items.filter((item) => item.status === status);
          const isWipExceeded =
            status === "IN_PROGRESS" &&
            columnItems.length > WIP_LIMIT_IN_PROGRESS;
          const isDragOver = dragOverColumn === status;

          return (
            <section
              key={status}
              aria-labelledby={`work-column-${status}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverColumn(status);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverColumn(null);
                const draggedId = event.dataTransfer.getData("text/plain");
                if (draggedId && onStatusChange) {
                  onStatusChange(draggedId, status);
                }
              }}
              className={`min-w-0 rounded-xl p-2.5 transition sm:p-3 ${
                isDragOver
                  ? "bg-brand-50/70 ring-2 ring-brand-500 dark:bg-brand-500/15"
                  : isWipExceeded
                    ? "bg-error-50/60 ring-1 ring-error-300 dark:bg-error-500/10"
                    : "bg-gray-100/80 dark:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-2.5">
                <h2
                  id={`work-column-${status}`}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200"
                >
                  <span>{t(`statuses.${status}`)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                    {columnItems.length}
                  </span>
                  {status === "IN_PROGRESS" && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isWipExceeded
                          ? "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300"
                          : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      MAX {WIP_LIMIT_IN_PROGRESS}
                    </span>
                  )}
                </h2>
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"
                />
              </div>

              <ul className="flex min-h-40 flex-col gap-2.5">
                {columnItems.length === 0 ? (
                  <li className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-gray-300 px-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t("emptyColumn")}
                  </li>
                ) : (
                  columnItems.map((item) => (
                    <WorkCard
                      key={item.id}
                      item={item}
                      status={status}
                      onOpenItem={onOpenItem}
                      onStatusChange={onStatusChange}
                    />
                  ))
                )}
              </ul>

              {onQuickCreate && (
                <div className="mt-2.5">
                  {quickCreateColumn === status ? (
                    <form
                      onSubmit={(event) => handleQuickCreate(event, status)}
                      className="space-y-2 rounded-lg border border-brand-300 bg-white p-2.5 dark:border-brand-500 dark:bg-gray-900"
                    >
                      <input
                        value={quickTitle}
                        onChange={(event) => setQuickTitle(event.target.value)}
                        placeholder="What needs to be done?"
                        className="h-8 w-full rounded border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickCreateColumn(null);
                            setQuickTitle("");
                          }}
                          className="h-7 cursor-pointer rounded px-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="h-7 cursor-pointer rounded bg-brand-500 px-2.5 text-xs font-semibold text-white hover:bg-brand-600"
                        >
                          Create
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCreateColumn(status);
                        setQuickTitle("");
                      }}
                      className="inline-flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white"
                    >
                      <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Create issue
                    </button>
                  )}
                </div>
              )}
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
  onStatusChange,
}: {
  item: WorkItem;
  status: WorkStatus;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
}) {
  const t = useTranslations("work");
  const assignee = item.assignee;
  const isDone = status === "DONE";

  return (
    <li
      draggable={Boolean(onStatusChange)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
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
          <span className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300">
            <span aria-hidden="true">⚡</span>
            <span className="truncate">
              {item.parent?.summary ?? item.projectName}
            </span>
          </span>
          <span className="mt-3 flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 ${
                isDone ? "line-through opacity-75" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-4 items-center justify-center rounded border border-brand-300 text-[9px] dark:border-brand-500/50"
              >
                ✓
              </span>
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

          <div className="flex items-center gap-1.5">
            {onStatusChange && (
              <select
                aria-label={`Move ${item.key} to status`}
                value={status}
                onChange={(event) =>
                  onStatusChange(item.id, event.target.value as WorkStatus)
                }
                className="h-6 cursor-pointer rounded border border-gray-200 bg-transparent px-1 text-[10px] text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                {WORK_STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {t(`statuses.${st}`)}
                  </option>
                ))}
              </select>
            )}
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
        </div>
      </article>
    </li>
  );
}
