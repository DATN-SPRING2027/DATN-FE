"use client";

import { useState } from "react";
import { WorkPriorityLabel, WorkStatusBadge } from "./WorkStatusBadge";
import type { WorkItem } from "./work-types";

const REPORT_TYPES = [
  {
    id: "burndown",
    title: "Sprint Burndown Report",
    desc: "Track remaining work in the sprint over time against the ideal burndown line.",
  },
  {
    id: "velocity",
    title: "Sprint Velocity Chart",
    desc: "Measure committed vs. completed story points across past sprints.",
  },
  {
    id: "cfd",
    title: "Cumulative Flow Diagram (CFD)",
    desc: "Cumulative flow diagram showing work states over time.",
  },
  {
    id: "cycletime",
    title: "Control Chart / Cycle Time",
    desc: "Analyze lead time and cycle time from start to completion.",
  },
  {
    id: "distribution",
    title: "Work Item Distribution",
    desc: "Work distribution breakdown by status, issue type, and team members.",
  },
  {
    id: "epicprogress",
    title: "Epic Progress Report",
    desc: "Track delivery and progress across major project epics.",
  },
] as const;

const PAGE_SIZE = 5;

export default function WorkReportsView({
  items,
  onOpenItem,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const [activeReportId, setActiveReportId] = useState<string>("burndown");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [page, setPage] = useState(1);

  const activeReport =
    REPORT_TYPES.find((r) => r.id === activeReportId) ?? REPORT_TYPES[0];

  const total = items.length;
  const doneCount = items.filter((item) => item.status === "DONE").length;
  const inProgressCount = items.filter(
    (item) => item.status === "IN_PROGRESS",
  ).length;
  const inReviewCount = items.filter(
    (item) => item.status === "IN_REVIEW",
  ).length;
  const todoCount = items.filter((item) => item.status === "TODO").length;
  const dueSoonCount = items.filter((item) => Boolean(item.dueDate)).length;

  const taskCount = items.filter((item) => item.type === "TASK").length;
  const storyCount = items.filter((item) => item.type === "STORY").length;
  const bugCount = items.filter((item) => item.type === "BUG").length;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <section aria-label="Agile reports and analytics" className="min-w-0 space-y-5">
      {/* Top Report Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDirectoryOpen((prev) => !prev)}
            className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            More reports ▾
          </button>
          <span className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
            Report: {activeReport.title}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {activeReport.desc}
        </span>
      </div>

      {/* Reports Directory Drawer */}
      {directoryOpen && (
        <div
          role="region"
          aria-label="Reports directory"
          className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-sm sm:grid-cols-2 xl:grid-cols-3 dark:border-gray-800 dark:bg-gray-900"
        >
          {REPORT_TYPES.map((rpt) => {
            const selected = rpt.id === activeReportId;
            return (
              <button
                key={rpt.id}
                type="button"
                onClick={() => {
                  setActiveReportId(rpt.id);
                  setDirectoryOpen(false);
                }}
                className={`cursor-pointer rounded-xl border p-3.5 text-start transition ${
                  selected
                    ? "border-brand-400 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/15"
                    : "border-gray-200 hover:border-brand-300 dark:border-gray-800"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  {rpt.title}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {rpt.desc}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* 4 Top KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Completed in last 7 days
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success-700 dark:text-success-400">
            {doneCount} work items
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Updated in last 7 days
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-600 dark:text-brand-400">
            {total} work items
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            In Progress & Review
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-purple-600 dark:text-purple-400">
            {inProgressCount + inReviewCount} work items
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Scheduled with due date
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warning-600 dark:text-warning-400">
            {dueSoonCount} work items
          </p>
        </div>
      </div>

      {/* 3 Distribution Cards Row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Work items by status
          </h3>
          <div className="mt-4 space-y-2.5 text-xs">
            <DistributionBar
              label="Done"
              count={doneCount}
              total={total}
              color="bg-success-500"
            />
            <DistributionBar
              label="In Progress"
              count={inProgressCount}
              total={total}
              color="bg-brand-500"
            />
            <DistributionBar
              label="In Review"
              count={inReviewCount}
              total={total}
              color="bg-purple-500"
            />
            <DistributionBar
              label="To Do"
              count={todoCount}
              total={total}
              color="bg-warning-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Work items by type
          </h3>
          <div className="mt-4 space-y-2.5 text-xs">
            <DistributionBar
              label="Task"
              count={taskCount}
              total={total}
              color="bg-brand-500"
            />
            <DistributionBar
              label="Story"
              count={storyCount}
              total={total}
              color="bg-success-500"
            />
            <DistributionBar
              label="Bug"
              count={bugCount}
              total={total}
              color="bg-error-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Sprint Velocity Chart
            </h3>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              Last 3 sprints
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 pt-2 text-center text-xs">
            {[
              { sprint: "Sprint 1", commit: 24, done: 22 },
              { sprint: "Sprint 2", commit: 28, done: 27 },
              { sprint: "Sprint 3", commit: 30, done: 29 },
            ].map((sp) => (
              <div
                key={sp.sprint}
                className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50"
              >
                <p className="font-semibold text-gray-900 dark:text-white/90">
                  {sp.sprint}
                </p>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  Committed: <strong>{sp.commit}</strong>
                </p>
                <p className="text-success-700 dark:text-success-400">
                  Completed: <strong>{sp.done}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sprint Burndown & Cycle Time SVG Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Sprint Burndown Chart
            </h3>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
              Active Sprint
            </span>
          </div>
          <svg
            width="100%"
            height="170"
            viewBox="0 0 500 170"
            className="mt-3"
            aria-label="Sprint burndown chart"
          >
            <line
              x1="40"
              y1="25"
              x2="470"
              y2="145"
              stroke="#98A2B3"
              strokeWidth="2"
              strokeDasharray="5"
            />
            <polyline
              points="40,25 120,38 200,68 280,98 360,130 430,138"
              fill="none"
              stroke="#465FFF"
              strokeWidth="3"
            />
            <circle cx="430" cy="138" r="4.5" fill="#465FFF" />
          </svg>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>--- Ideal Guideline</span>
            <span className="font-medium text-brand-600 dark:text-brand-400">
              ━━ Actual Remaining Work (3 pts remaining)
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Work item cycle time
          </h3>
          <svg
            width="100%"
            height="170"
            viewBox="0 0 500 170"
            className="mt-3"
            aria-label="Work item cycle time chart"
          >
            <path
              d="M40 140 L90 132 L140 105 L190 118 L240 90 L290 112 L340 68 L390 95 L450 52"
              fill="none"
              stroke="#465FFF"
              strokeWidth="2.5"
            />
            {[
              [40, 140],
              [90, 132],
              [140, 105],
              [190, 118],
              [240, 90],
              [290, 112],
              [340, 68],
              [390, 95],
              [450, 52],
            ].map(([cx, cy]) => (
              <circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r="3.5"
                fill="#465FFF"
              />
            ))}
          </svg>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Rolling cycle time across completed sprint deliverables.
          </p>
        </div>
      </div>

      {/* Paginated Work Items Report Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Work items in report ({total})
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 cursor-pointer rounded-lg border border-gray-200 px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 cursor-pointer rounded-lg border border-gray-200 px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/70">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Key
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Summary
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Type
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Status
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Priority
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Assignee
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pageItems.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(event) =>
                        onOpenItem(item, event.currentTarget)
                      }
                      className="cursor-pointer font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {item.key}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white/90">
                    {item.title}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                    {item.type}
                  </td>
                  <td className="px-4 py-3">
                    <WorkStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    <WorkPriorityLabel priority={item.priority} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {item.assignee.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="tabular-nums text-gray-500 dark:text-gray-400">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
