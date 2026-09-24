import { useTranslations } from "next-intl";
import type {
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
} from "@/lib/queries/work-management/work-management.types";
import {
  controlClassName,
  formatDate,
  priorities,
  secondaryButtonClassName,
  statuses,
} from "./work-management-ui";

type WorkItemCardProps = Readonly<{
  item: WorkItem;
  locale: string;
  selected: boolean;
  onOpen: () => void;
  onStatusChange: (status: WorkItemStatus) => void;
  onPriorityChange: (priority: WorkItemPriority) => void;
  onArchive: () => void;
}>;

export default function WorkItemCard({
  item,
  locale,
  selected,
  onOpen,
  onStatusChange,
  onPriorityChange,
  onArchive,
}: WorkItemCardProps) {
  const t = useTranslations("workManagement");

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words text-gray-900 dark:text-white/90">
            {item.title}
          </h3>
          {item.description && (
            <p className="mt-1 text-sm break-words whitespace-pre-wrap text-gray-500 dark:text-gray-400">
              {item.description}
            </p>
          )}
        </div>
        {item.archivedAt && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-400">
            {t("archivedBadge")}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("status")}
          </span>
          <select
            className={controlClassName}
            value={item.status}
            disabled={Boolean(item.archivedAt)}
            onChange={(event) =>
              onStatusChange(event.currentTarget.value as WorkItemStatus)
            }
            aria-label={`${t("status")}: ${item.title}`}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("priority")}
          </span>
          <select
            className={controlClassName}
            value={item.priority}
            disabled={Boolean(item.archivedAt)}
            onChange={(event) =>
              onPriorityChange(event.currentTarget.value as WorkItemPriority)
            }
            aria-label={`${t("priority")}: ${item.title}`}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {t(`priorities.${priority}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <span>
          {t("dueDate")}: {formatDate(item.dueDate, locale)}
        </span>
        <span>
          {t("createdBy")}: {item.createdBy.slice(0, 8)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={secondaryButtonClassName}
          aria-expanded={selected}
          onClick={onOpen}
        >
          {t("viewDetails")}
        </button>
        {!item.archivedAt && (
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-error-500/30 px-3 py-2 text-sm font-medium text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
            onClick={onArchive}
          >
            {t("archive")}
          </button>
        )}
      </div>
    </article>
  );
}
