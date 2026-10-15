import { useTranslations } from "next-intl";
import type { WorkPriority, WorkStatus } from "./work-types";

const statusStyles: Record<WorkStatus, string> = {
  TODO: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  IN_PROGRESS:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300",
  IN_REVIEW:
    "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400",
  DONE: "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400",
};

const statusDots: Record<WorkStatus, string> = {
  TODO: "bg-gray-400 dark:bg-gray-500",
  IN_PROGRESS: "bg-brand-500",
  IN_REVIEW: "bg-warning-500",
  DONE: "bg-success-500",
};

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  const t = useTranslations("work.statuses");
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDots[status]}`} />
      {t(status)}
    </span>
  );
}

const priorityStyles: Record<WorkPriority, string> = {
  HIGH: "text-warning-700 dark:text-warning-400",
  MEDIUM: "text-gray-700 dark:text-gray-300",
  LOW: "text-gray-500 dark:text-gray-400",
};

const priorityLevels: Record<WorkPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function WorkPriorityLabel({
  priority,
}: {
  priority: WorkPriority;
}) {
  const t = useTranslations("work.priorities");
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-sm ${priorityStyles[priority]}`}>
      <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
        {Array.from({ length: 3 }, (_, index) => (
          <span
            key={index}
            className={`w-0.5 rounded-full ${index < priorityLevels[priority] ? "h-3 bg-current" : "h-1.5 bg-gray-300 dark:bg-gray-700"}`}
          />
        ))}
      </span>
      {t(priority)}
    </span>
  );
}
