"use client";

import { useState, type ReactNode } from"react";
import { useTranslations } from"next-intl";
import {
  CalenderIcon,
  CheckLineIcon,
  FilePlusIcon,
  PencilIcon,
  ReportsPromoIllustration,
} from "@/icons";
import WorkOverviewBreakdownPanel from"./WorkOverviewBreakdownPanel";
import WorkOverviewPanel from"./WorkOverviewPanel";
import WorkOverviewRecentItemsPanel from"./WorkOverviewRecentItemsPanel";
import WorkOverviewStatusPanel from"./WorkOverviewStatusPanel";
import WorkOverviewSubtasksPanel from"./WorkOverviewSubtasksPanel";
import { MonoIssueTypeIcon } from"./WorkMonoIcons";
import { PREVIEW_PEOPLE } from"./work-preview-data";
import {
  type WorkItem,
  type WorkItemType,
  type WorkPerson,
  type WorkPriority,
  type WorkStatus,
} from"./work-types";

export default function WorkOverviewView({
  items,
  people,
  onOpenItem,
  onOpenSubtask,
  onOpenReports,
  onOpenList,
}: {
  items: readonly WorkItem[];
  people?: readonly WorkPerson[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onOpenSubtask?: (
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onOpenReports?: () => void;
  onOpenList?: () => void;
}) {
  const overview = useTranslations("work.overviewPanel");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const statusCounts: Record<WorkStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
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
  let dueSoonCount = 0;
  let totalSubtasksCount = 0;

  for (const item of items) {
    statusCounts[item.status] += 1;
    priorityCounts[item.priority] += 1;
    typeCounts[item.type] += 1;
    totalSubtasksCount += item.subtasks.total;
    assigneeCounts.set(
      item.assignee.id,
      (assigneeCounts.get(item.assignee.id) ?? 0) + 1,
    );
    if (item.dueDate) dueSoonCount += 1;
  }

  const maxPriorityBar = Math.max(
    1,
    priorityCounts.HIGH,
    priorityCounts.MEDIUM,
    priorityCounts.LOW,
  );

  const priorityColumns = [
    {
      id:"highest",
      label:"Highest",
      symbol:"︽",
      symbolColor:"text-gray-700 dark:text-gray-300",
      barColor:"#344054",
      count: 0,
    },
    {
      id:"high",
      label:"High",
      symbol:"︿",
      symbolColor:"text-gray-700 dark:text-gray-300",
      barColor:"#475467",
      count: priorityCounts.HIGH,
    },
    {
      id:"medium",
      label:"Medium",
      symbol:"＝",
      symbolColor:"text-gray-600 dark:text-gray-400",
      barColor:"#667085",
      count: priorityCounts.MEDIUM,
    },
    {
      id:"low",
      label:"Low",
      symbol:"﹀",
      symbolColor:"text-gray-500 dark:text-gray-400",
      barColor:"#98A2B3",
      count: priorityCounts.LOW,
    },
    {
      id:"lowest",
      label:"Lowest",
      symbol:"︾",
      symbolColor:"text-gray-500 dark:text-gray-400",
      barColor:"#D0D5DD",
      count: 0,
    },
  ];

  const totalTypeUnits = Math.max(1, items.length + totalSubtasksCount);
  const workTypeDistribution: readonly {
    id: string;
    label: string;
    type: WorkItemType |"SUBTASK";
    count: number;
    pct: number;
  }[] = [
    {
      id:"subtask",
      label:"Subtask",
      type:"SUBTASK",
      count: totalSubtasksCount,
      pct: Math.round((totalSubtasksCount / totalTypeUnits) * 100),
    },
    {
      id:"task",
      label:"Task",
      type:"TASK",
      count: typeCounts.TASK,
      pct: Math.round((typeCounts.TASK / totalTypeUnits) * 100),
    },
    {
      id:"story",
      label:"Story",
      type:"STORY",
      count: typeCounts.STORY,
      pct: Math.round((typeCounts.STORY / totalTypeUnits) * 100),
    },
    {
      id:"bug",
      label:"Bug",
      type:"BUG",
      count: typeCounts.BUG,
      pct: Math.round((typeCounts.BUG / totalTypeUnits) * 100),
    },
  ];

  const teamRows = (people ?? PREVIEW_PEOPLE).flatMap((person) => {
    const value = assigneeCounts.get(person.id) ?? 0;
    return value === 0
      ? []
      : [
          {
            id: person.id,
            label: person.name,
            initials: person.initials,
            value,
            colorClass:"bg-brand-500",
          },
        ];
  });

  return (
    <section
      aria-label={overview("dashboardLabel")}
      className="min-w-0 space-y-4"
    >
      {/* 1. Top Promotion Notice Banner with 190x74 SVG Illustration */}
      {!bannerDismissed && (
        <div className="flex flex-wrap items-center justify-between gap-4 border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-brand-600 text-xs font-bold text-white"
            >
              i
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                Customize your Reports view to suit your space
              </h2>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                Head to the Reports tab to try adding, editing, and removing
                reports — just how you like them.
              </p>
              <div className="mt-2.5 flex items-center gap-4 text-xs font-semibold">
                {onOpenReports && (
                  <button
                    type="button"
                    onClick={onOpenReports}
                    className="cursor-pointer text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Take me to Reports
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="cursor-pointer text-gray-500 hover:underline dark:text-gray-400"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="hidden sm:block">
            <ReportsPromoIllustration
              aria-hidden="true"
              className="h-[74px] w-[190px]"
            />
          </div>
        </div>
      )}

      {/* 2. Top 4 Summary Metric Cards (Completed, Updated, Created, Due Soon) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetricCard
          iconBg="border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          icon={<CheckLineIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
          title={`${statusCounts.DONE} completed`}
          hint="in the last 7 days"
        />
        <OverviewMetricCard
          iconBg="border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          icon={<PencilIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
          title={`${items.length} updated`}
          hint="in the last 7 days"
        />
        <OverviewMetricCard
          iconBg="border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          icon={<FilePlusIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
          title={`${items.length} created`}
          hint="in the last 7 days"
        />
        <OverviewMetricCard
          iconBg="border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          icon={<CalenderIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
          title={`${dueSoonCount} due soon`}
          hint="in the next 7 days"
        />
      </div>

      {/* 3. Main 2x2 Summary Grid */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Panel 1: Status Overview Donut Chart */}
        <WorkOverviewStatusPanel
          counts={statusCounts}
          total={items.length}
          onViewAllItems={onOpenList}
        />

        {/* Panel 2: Recent Activity Stream */}
        <WorkOverviewRecentItemsPanel items={items} onOpenItem={onOpenItem} />

        {/* Panel 3: Priority Breakdown Vertical Column Chart */}
        <WorkOverviewPanel
          title={overview("priorityTitle")}
          description="Get a holistic view of how work is being prioritized."
        >
          <div className="pt-2">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              {/* Y-Axis Labels */}
              <div className="flex h-44 flex-col justify-between text-end text-[11px] tabular-nums text-gray-400">
                <span>{maxPriorityBar}</span>
                <span>{Math.round(maxPriorityBar * 0.75)}</span>
                <span>{Math.round(maxPriorityBar * 0.5)}</span>
                <span>{Math.round(maxPriorityBar * 0.25)}</span>
                <span>0</span>
              </div>

              {/* 5 Vertical Priority Columns */}
              <div className="relative flex h-44 items-end justify-around border-b border-gray-200 px-2 dark:border-gray-800">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex flex-col justify-between"
                >
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70"/>
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70"/>
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70"/>
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70"/>
                  <div />
                </div>

                {priorityColumns.map((col) => {
                  const heightPct =
                    col.count === 0
                      ? 4
                      : Math.max(12, Math.round((col.count / maxPriorityBar) * 100));
                  return (
                    <div
                      key={col.id}
                      className="relative z-1 flex h-full w-12 flex-col items-center justify-end"
                    >
                      <span className="mb-1 text-xs font-bold tabular-nums text-gray-700 dark:text-gray-300">
                        {col.count}
                      </span>
                      <div
                        className="w-8 transition-all"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor:
                            col.count > 0 ? col.barColor :"#E4E7EC",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Priority Labels */}
            <div className="mt-2.5 grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <div />
              <div className="flex items-center justify-around text-xs font-medium text-gray-600 dark:text-gray-400">
                {priorityColumns.map((col) => (
                  <span
                    key={col.id}
                    className="inline-flex items-center gap-1"
                  >
                    <span className={`font-bold ${col.symbolColor}`}>
                      {col.symbol}
                    </span>
                    <span>{col.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </WorkOverviewPanel>

        {/* Panel 4: Types of Work Table (TYPE | DISTRIBUTION) */}
        <WorkOverviewPanel
          title={overview("typeTitle")}
          description="Get a breakdown of work items by their types."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-[9rem_minmax(0,1fr)] border-b border-gray-100 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:border-gray-800">
              <span>Type</span>
              <span>Distribution</span>
            </div>

            <div className="space-y-3">
              {workTypeDistribution.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 text-sm"
                >
                  <div className="flex items-center gap-2.5 font-medium text-gray-800 dark:text-gray-200">
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <MonoIssueTypeIcon type={row.type} size={13} />
                    </span>
                    <span>{row.label}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-6 flex-1 items-center overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div
                        className="flex h-full items-center bg-gray-700 px-2 text-xs font-semibold text-white transition-all dark:bg-gray-300 dark:text-gray-900"
                        style={{ width: `${Math.max(row.pct, row.count > 0 ? 18 : 0)}%` }}
                      >
                        {row.pct > 0 ? `${row.pct}%` :""}
                      </div>
                    </div>
                    <span className="w-8 text-end text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-400">
                      {row.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </WorkOverviewPanel>

        {/* Team Workload & Subtasks Progress */}
        <WorkOverviewBreakdownPanel
          title={overview("teamTitle")}
          description={overview("teamDescription")}
          rows={teamRows}
          total={items.length}
        />
        <WorkOverviewSubtasksPanel
          items={items}
          onOpenItem={onOpenItem}
          onOpenSubtask={onOpenSubtask}
        />
      </div>
    </section>
  );
}

function OverviewMetricCard({
  icon,
  iconBg,
  title,
  hint,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex min-h-22 items-center gap-3.5 border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center ${iconBg}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold text-gray-900 dark:text-white/90">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      </span>
    </div>
  );
}
