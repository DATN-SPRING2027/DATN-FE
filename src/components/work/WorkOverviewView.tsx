"use client";

import { useTranslations } from "next-intl";
import {
  CalenderIcon,
  CheckCircleIcon,
  TaskIcon,
  TimeIcon,
} from "@/icons";
import type { ReactNode } from "react";
import WorkOverviewBreakdownPanel from "./WorkOverviewBreakdownPanel";
import WorkOverviewRecentItemsPanel from "./WorkOverviewRecentItemsPanel";
import WorkOverviewStatusPanel from "./WorkOverviewStatusPanel";
import WorkOverviewSubtasksPanel from "./WorkOverviewSubtasksPanel";
import { PREVIEW_PEOPLE } from "./work-preview-data";
import {
  type WorkItem,
  type WorkItemType,
  type WorkPriority,
  type WorkStatus,
} from "./work-types";

const PRIORITY_ORDER: readonly WorkPriority[] = ["HIGH", "MEDIUM", "LOW"];
const WORK_TYPE_ORDER: readonly WorkItemType[] = ["TASK", "BUG", "STORY"];

const priorityColors: Record<WorkPriority, string> = {
  HIGH: "bg-error-500",
  MEDIUM: "bg-warning-500",
  LOW: "bg-gray-400",
};

const typeColors: Record<WorkItemType, string> = {
  TASK: "bg-brand-500",
  BUG: "bg-error-500",
  STORY: "bg-success-500",
};

export default function WorkOverviewView({
  items,
  onOpenItem,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("work");
  const overview = useTranslations("work.overviewPanel");
  const statusCounts: Record<WorkStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };
  const priorityCounts: Record<WorkPriority, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const typeCounts: Record<WorkItemType, number> = {
    TASK: 0,
    BUG: 0,
    STORY: 0,
  };
  const assigneeCounts = new Map<string, number>();
  let unscheduledCount = 0;

  for (const item of items) {
    statusCounts[item.status] += 1;
    priorityCounts[item.priority] += 1;
    typeCounts[item.type] += 1;
    assigneeCounts.set(item.assignee.id, (assigneeCounts.get(item.assignee.id) ?? 0) + 1);
    if (!item.dueDate) unscheduledCount += 1;
  }

  const priorityRows = PRIORITY_ORDER.map((key) => ({
    id: key,
    label: t(`priorities.${key}`),
    value: priorityCounts[key],
    colorClass: priorityColors[key],
  }));

  const typeRows = WORK_TYPE_ORDER.map((key) => ({
    id: key,
    label: t(`types.${key}`),
    value: typeCounts[key],
    colorClass: typeColors[key],
  }));

  const teamRows = PREVIEW_PEOPLE.flatMap((person) => {
    const value = assigneeCounts.get(person.id) ?? 0;
    return value === 0
      ? []
      : [{ id: person.id, label: person.name, initials: person.initials, value, colorClass: "bg-brand-500" }];
  });

  return (
    <section aria-label={overview("dashboardLabel")} className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetricCard
          icon={<TaskIcon className="h-5 w-5" aria-hidden="true" />}
          label={overview("totalItems")}
          value={items.length}
          hint={overview("currentView")}
        />
        <OverviewMetricCard
          icon={<CheckCircleIcon className="h-5 w-5" aria-hidden="true" />}
          label={overview("completedItems")}
          value={statusCounts.DONE}
          hint={overview("currentView")}
        />
        <OverviewMetricCard
          icon={<TimeIcon className="h-5 w-5" aria-hidden="true" />}
          label={overview("inProgressItems")}
          value={statusCounts.IN_PROGRESS}
          hint={overview("currentView")}
        />
        <OverviewMetricCard
          icon={<CalenderIcon className="h-5 w-5" aria-hidden="true" />}
          label={overview("unscheduledItems")}
          value={unscheduledCount}
          hint={overview("currentView")}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <WorkOverviewStatusPanel counts={statusCounts} total={items.length} />
        <WorkOverviewRecentItemsPanel items={items} onOpenItem={onOpenItem} />
        <WorkOverviewBreakdownPanel
          title={overview("priorityTitle")}
          description={overview("priorityDescription")}
          rows={priorityRows}
          total={items.length}
        />
        <WorkOverviewBreakdownPanel
          title={overview("typeTitle")}
          description={overview("typeDescription")}
          rows={typeRows}
          total={items.length}
        />
        <WorkOverviewBreakdownPanel
          title={overview("teamTitle")}
          description={overview("teamDescription")}
          rows={teamRows}
          total={items.length}
        />
        <WorkOverviewSubtasksPanel items={items} />
      </div>
    </section>
  );
}

function OverviewMetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex min-h-24 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
        <span className="mt-0.5 block text-2xl font-semibold leading-none tabular-nums text-gray-900 dark:text-white/90">
          {value}
        </span>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-500">
          {hint}
        </span>
      </span>
    </div>
  );
}
