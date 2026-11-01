import { useTranslations } from "next-intl";
import { MonoIssueTypeIcon } from "./WorkMonoIcons";
import type {
  WorkIntakeFormType,
  WorkItemType,
  WorkPriority,
  WorkStatus,
} from "./work-types";

const statusStyles: Record<WorkStatus, string> = {
  TODO: "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  IN_PROGRESS:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
  IN_REVIEW:
    "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-400",
  DONE: "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400",
};

const statusDots: Record<WorkStatus, string> = {
  TODO: "bg-gray-400 dark:bg-gray-500",
  IN_PROGRESS: "bg-brand-500",
  IN_REVIEW: "bg-warning-500",
  DONE: "bg-success-500",
};

export function WorkStatusBadge({
  status,
  showChevron = false,
}: {
  status: WorkStatus;
  showChevron?: boolean;
}) {
  const t = useTranslations("work.statuses");
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold tracking-tight ${statusStyles[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${statusDots[status]}`}
      />
      <span>{t(status)}</span>
      {showChevron && (
        <span aria-hidden="true" className="ms-0.5 text-[10px] opacity-70">
          ▾
        </span>
      )}
    </span>
  );
}

const issueTypeTileStyles: Record<string, string> = {
  TASK: "bg-blue-light-600 text-white dark:bg-blue-light-500 dark:text-white",
  STORY: "bg-success-600 text-white dark:bg-success-500 dark:text-white",
  BUG: "bg-error-600 text-white dark:bg-error-500 dark:text-white",
  EPIC: "bg-theme-purple-500 text-white",
  SUBTASK:
    "border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
};

export function WorkIssueTypeBadge({
  type,
  size = "md",
  title,
}: {
  type: WorkItemType | WorkIntakeFormType | "SUBTASK" | "EPIC";
  size?: "sm" | "md";
  title?: string;
}) {
  const normalized = type.toUpperCase();
  const toneClass =
    issueTypeTileStyles[normalized] ?? issueTypeTileStyles.TASK;
  const boxClass = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  const iconSize = size === "sm" ? 10 : 11;

  return (
    <span
      aria-hidden="true"
      title={title ?? type}
      className={`inline-flex shrink-0 items-center justify-center rounded-xs shadow-theme-xs ${boxClass} ${toneClass}`}
    >
      <MonoIssueTypeIcon type={type} size={iconSize} />
    </span>
  );
}

function PriorityGlyph({ priority }: { priority: WorkPriority }) {
  if (priority === "HIGH") {
    return (
      <svg
        viewBox="0 0 16 16"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-error-600 dark:text-error-400"
      >
        <path d="M3.5 8.5L8 4l4.5 4.5" />
        <path d="M3.5 12.5L8 8l4.5 4.5" />
      </svg>
    );
  }

  if (priority === "MEDIUM") {
    return (
      <svg
        viewBox="0 0 16 16"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 text-orange-500 dark:text-orange-400"
      >
        <path d="M3 6h10" />
        <path d="M3 10h10" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-blue-light-600 dark:text-blue-light-400"
    >
      <path d="M3.5 6L8 10.5 12.5 6" />
    </svg>
  );
}

export function WorkPriorityLabel({
  priority,
}: {
  priority: WorkPriority;
}) {
  const t = useTranslations("work.priorities");
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700 dark:text-gray-200">
      <PriorityGlyph priority={priority} />
      <span>{t(priority)}</span>
    </span>
  );
}
