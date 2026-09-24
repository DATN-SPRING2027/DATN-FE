import { useTranslations } from "next-intl";
import type {
  WorkItemPriority,
  WorkItemStatus,
} from "@/lib/queries/work-management/work-management.types";
import { controlClassName, priorities, statuses } from "./work-management-ui";

type WorkItemFiltersProps = Readonly<{
  status: WorkItemStatus | "ALL";
  priority: WorkItemPriority | "ALL";
  includeArchived: boolean;
  onStatusChange: (status: WorkItemStatus | "ALL") => void;
  onPriorityChange: (priority: WorkItemPriority | "ALL") => void;
  onIncludeArchivedChange: (includeArchived: boolean) => void;
}>;

export default function WorkItemFilters({
  status,
  priority,
  includeArchived,
  onStatusChange,
  onPriorityChange,
  onIncludeArchivedChange,
}: WorkItemFiltersProps) {
  const t = useTranslations("workManagement");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-sm sm:p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("filterStatus")}
          </span>
          <select
            className={controlClassName}
            value={status}
            onChange={(event) =>
              onStatusChange(event.currentTarget.value as WorkItemStatus | "ALL")
            }
          >
            <option value="ALL">{t("allStatuses")}</option>
            {statuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {t(`statuses.${statusOption}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("filterPriority")}
          </span>
          <select
            className={controlClassName}
            value={priority}
            onChange={(event) =>
              onPriorityChange(
                event.currentTarget.value as WorkItemPriority | "ALL",
              )
            }
          >
            <option value="ALL">{t("allPriorities")}</option>
            {priorities.map((priorityOption) => (
              <option key={priorityOption} value={priorityOption}>
                {t(`priorities.${priorityOption}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            className="size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900"
            checked={includeArchived}
            onChange={(event) =>
              onIncludeArchivedChange(event.currentTarget.checked)
            }
          />
          {t("includeArchived")}
        </label>
      </div>
    </section>
  );
}
