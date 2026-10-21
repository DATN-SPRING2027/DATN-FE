"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import WorkOverviewBreakdownPanel from "./WorkOverviewBreakdownPanel";
import WorkOverviewPanel from "./WorkOverviewPanel";
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

export default function WorkOverviewView({
  items,
  onOpenItem,
  onOpenReports,
  onOpenList,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onOpenReports?: () => void;
  onOpenList?: () => void;
}) {
  const overview = useTranslations("work.overviewPanel");
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
      id: "highest",
      label: "Highest",
      symbol: "︽",
      symbolColor: "text-error-600 dark:text-error-400",
      barColor: "#E2483D",
      count: 0,
    },
    {
      id: "high",
      label: "High",
      symbol: "︿",
      symbolColor: "text-error-500 dark:text-error-400",
      barColor: "#F87168",
      count: priorityCounts.HIGH,
    },
    {
      id: "medium",
      label: "Medium",
      symbol: "＝",
      symbolColor: "text-warning-600 dark:text-warning-400",
      barColor: "#E56910",
      count: priorityCounts.MEDIUM,
    },
    {
      id: "low",
      label: "Low",
      symbol: "﹀",
      symbolColor: "text-brand-600 dark:text-brand-400",
      barColor: "#0C66E4",
      count: priorityCounts.LOW,
    },
    {
      id: "lowest",
      label: "Lowest",
      symbol: "︾",
      symbolColor: "text-brand-500 dark:text-brand-400",
      barColor: "#579DFF",
      count: 0,
    },
  ];

  const totalTypeUnits = Math.max(1, items.length + totalSubtasksCount);
  const workTypeDistribution = [
    {
      id: "subtask",
      label: "Subtask",
      count: totalSubtasksCount,
      pct: Math.round((totalSubtasksCount / totalTypeUnits) * 100),
      iconBg: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
      barBg: "bg-brand-500",
      symbol: "⧉",
    },
    {
      id: "task",
      label: "Task",
      count: typeCounts.TASK,
      pct: Math.round((typeCounts.TASK / totalTypeUnits) * 100),
      iconBg: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
      barBg: "bg-brand-600",
      symbol: "☑",
    },
    {
      id: "story",
      label: "Story",
      count: typeCounts.STORY,
      pct: Math.round((typeCounts.STORY / totalTypeUnits) * 100),
      iconBg: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
      barBg: "bg-success-500",
      symbol: "🔖",
    },
    {
      id: "bug",
      label: "Bug",
      count: typeCounts.BUG,
      pct: Math.round((typeCounts.BUG / totalTypeUnits) * 100),
      iconBg: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
      barBg: "bg-error-500",
      symbol: "🐛",
    },
  ];

  const teamRows = PREVIEW_PEOPLE.flatMap((person) => {
    const value = assigneeCounts.get(person.id) ?? 0;
    return value === 0
      ? []
      : [
          {
            id: person.id,
            label: person.name,
            initials: person.initials,
            value,
            colorClass: "bg-brand-500",
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
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
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
            <svg width="190" height="74" viewBox="0 0 190 74" fill="none">
              <rect
                x="35"
                y="6"
                width="120"
                height="62"
                rx="6"
                fill="white"
                stroke="#B3D4FF"
                strokeWidth="1.5"
              />
              <line
                x1="47"
                y1="18"
                x2="85"
                y2="18"
                stroke="#0C66E4"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <rect
                x="47"
                y="32"
                width="14"
                height="26"
                rx="2"
                fill="#4C9AFF"
              />
              <rect
                x="66"
                y="24"
                width="14"
                height="34"
                rx="2"
                fill="#36B37E"
              />
              <rect
                x="85"
                y="38"
                width="14"
                height="20"
                rx="2"
                fill="#6554C0"
              />
              <rect
                x="104"
                y="20"
                width="14"
                height="38"
                rx="2"
                fill="#FFAB00"
              />
              <rect
                x="125"
                y="14"
                width="48"
                height="44"
                rx="6"
                fill="white"
                stroke="#0C66E4"
                strokeWidth="1.5"
              />
              <circle
                cx="149"
                cy="36"
                r="13"
                stroke="#E9F2FF"
                strokeWidth="5"
                fill="none"
              />
              <path
                d="M149 23 A13 13 0 1 1 136 36"
                stroke="#0C66E4"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}

      {/* 2. Top 4 Summary Metric Cards (Completed, Updated, Created, Due Soon) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetricCard
          iconBg="bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          title={`${statusCounts.DONE} completed`}
          hint="in the last 7 days"
        />
        <OverviewMetricCard
          iconBg="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          }
          title={`${items.length} updated`}
          hint="in the last 7 days"
        />
        <OverviewMetricCard
          iconBg="bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          }
          title={`${items.length} created`}
          hint="in the last 7 days"
        />
        <OverviewMetricCard
          iconBg="bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
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
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70" />
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70" />
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70" />
                  <div className="border-t border-dashed border-gray-100 dark:border-gray-800/70" />
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
                        className="w-8 rounded-t-md transition-all"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor:
                            col.count > 0 ? col.barColor : "#E4E7EC",
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
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${row.iconBg}`}
                    >
                      {row.symbol}
                    </span>
                    <span>{row.label}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-6 flex-1 items-center overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`flex h-full items-center px-2 text-xs font-semibold text-white transition-all ${row.barBg}`}
                        style={{ width: `${Math.max(row.pct, row.count > 0 ? 18 : 0)}%` }}
                      >
                        {row.pct > 0 ? `${row.pct}%` : ""}
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
        <WorkOverviewSubtasksPanel items={items} />
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
    <div className="flex min-h-22 items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}
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
