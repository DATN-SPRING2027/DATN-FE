import { useTranslations } from "next-intl";
import { MonoIssueTypeIcon } from "./WorkMonoIcons";
import WorkOverviewPanel from "./WorkOverviewPanel";
import type { WorkItem } from "./work-types";

export default function WorkOverviewSubtasksPanel({
  items,
  onOpenItem,
  onOpenSubtask,
}: {
  items: readonly WorkItem[];
  onOpenItem?: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onOpenSubtask?: (
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  const overview = useTranslations("work.overviewPanel");
  const itemsWithSubtasks = items.filter((item) => item.subtasks.total > 0);

  return (
    <WorkOverviewPanel
      title={overview("subtaskTitle")}
      description={overview("subtaskDescription")}
    >
      {itemsWithSubtasks.length === 0 ? (
        <p className="bg-gray-50 px-3 py-5 text-center text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
          {overview("noSubtasks")}
        </p>
      ) : (
        <ul className="grid gap-4">
          {itemsWithSubtasks.slice(0, 5).map((item) => {
            const subtaskList = item.subtaskItems ?? [];
            const total = subtaskList.length || item.subtasks.total;
            const completed =
              subtaskList.length > 0
                ? subtaskList.filter((s) => s.done || s.status === "DONE")
                    .length
                : item.subtasks.completed;
            const inProgress = subtaskList.filter(
              (s) =>
                !s.done &&
                (s.status === "IN_PROGRESS" || s.status === "IN_REVIEW"),
            ).length;
            const percentage =
              total > 0 ? Math.round((completed / total) * 100) : 0;
            const inProgPct =
              total > 0 ? Math.round((inProgress / total) * 100) : 0;

            return (
              <li
                key={item.id}
                className="grid gap-2 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 dark:border-gray-800/70"
              >
                <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                  {onOpenItem ? (
                    <button
                      type="button"
                      onClick={(e) => onOpenItem(item, e.currentTarget)}
                      className="min-w-0 cursor-pointer truncate text-start font-medium text-gray-800 hover:underline dark:text-gray-200"
                    >
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {item.key}
                      </span>
                      <span aria-hidden="true"> · </span>
                      {item.title}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate font-medium text-gray-800 dark:text-gray-200">
                      <span className="text-brand-600 dark:text-brand-400">
                        {item.key}
                      </span>
                      <span aria-hidden="true"> · </span>
                      {item.title}
                    </span>
                  )}
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                    {completed}/{total} ({percentage}%)
                  </span>
                </div>
                <div
                  role="meter"
                  aria-label={overview("subtaskAccessibleLabel", {
                    completed,
                    total,
                    key: item.key,
                    title: item.title,
                  })}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={completed}
                  className="flex h-2 overflow-hidden bg-gray-100 dark:bg-gray-800"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-full ${percentage === 100 ? "bg-gray-900 dark:bg-gray-100" : "bg-gray-700 dark:bg-gray-300"}`}
                    style={{ width: `${percentage}%` }}
                  />
                  {inProgPct > 0 && (
                    <span
                      aria-hidden="true"
                      className="block h-full bg-gray-400 dark:bg-gray-500"
                      style={{ width: `${inProgPct}%` }}
                    />
                  )}
                </div>
                {subtaskList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {subtaskList.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={(e) =>
                          onOpenSubtask
                            ? onOpenSubtask(item, sub.id, e.currentTarget)
                            : onOpenItem?.(item, e.currentTarget)
                        }
                        title={`${sub.key}: ${sub.summary} (${sub.status})`}
                        className={`inline-flex cursor-pointer items-center gap-1 border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                          sub.done || sub.status === "DONE"
                            ? "border-gray-200 bg-gray-50 text-gray-400 line-through hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-500"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                      >
                        <MonoIssueTypeIcon type="SUBTASK" size={10} />
                        <span className="font-bold">{sub.key}</span>
                        <span className="max-w-36 truncate">{sub.summary}</span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WorkOverviewPanel>
  );
}
