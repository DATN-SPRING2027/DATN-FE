import { useTranslations } from "next-intl";
import WorkOverviewPanel from "./WorkOverviewPanel";
import type { WorkItem } from "./work-types";

export default function WorkOverviewSubtasksPanel({
  items,
}: {
  items: readonly WorkItem[];
}) {
  const overview = useTranslations("work.overviewPanel");
  const itemsWithSubtasks = items.filter((item) => item.subtasks.total > 0);

  return (
    <WorkOverviewPanel
      title={overview("subtaskTitle")}
      description={overview("subtaskDescription")}
    >
      {itemsWithSubtasks.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
          {overview("noSubtasks")}
        </p>
      ) : (
        <ul className="grid gap-4">
          {itemsWithSubtasks.slice(0, 5).map((item) => {
            const { completed, total } = item.subtasks;
            const percentage = Math.round((completed / total) * 100);
            return (
              <li key={item.id} className="grid gap-2">
                <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-gray-800 dark:text-gray-200">
                    <span className="text-brand-600 dark:text-brand-400">{item.key}</span>
                    <span aria-hidden="true"> · </span>
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {completed}/{total}
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
                  className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-full rounded-full ${percentage === 100 ? "bg-success-500" : "bg-brand-500"}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WorkOverviewPanel>
  );
}
