"use client";

import { useState } from "react";
import { PREVIEW_PEOPLE } from "./work-preview-data";
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingWidgets, setIsEditingWidgets] = useState(false);
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

  const assigneeRows = PREVIEW_PEOPLE.map((person, index) => {
    const colors = ["#0C66E4", "#22A06B", "#8270DB", "#E56910", "#E2483D"];
    const count = items.filter((item) => item.assignee.id === person.id).length;
    return {
      label: person.name,
      count,
      color: colors[index % colors.length],
    };
  }).filter((row) => row.count > 0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function handleCopyReportLink() {
    if (typeof window !== "undefined") {
      void navigator.clipboard?.writeText(window.location.href);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <section
      aria-label="Agile reports and analytics"
      className="min-w-0 space-y-5"
    >
      {/* Top Report Controls Bar */}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReportLink}
            title="Share report link"
            className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            {copiedLink ? "✓ Link copied" : "🔗 Share"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditingWidgets((prev) => !prev)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-xs font-semibold transition ${
              isEditingWidgets
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            }`}
          >
            {isEditingWidgets ? "✓ Done editing" : "Edit"}
          </button>
        </div>
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
        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
            ✓
          </span>
          <div>
            <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white/90">
              {doneCount} completed
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              in the last 7 days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            ✎
          </span>
          <div>
            <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white/90">
              {total} updated
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              in the last 7 days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
            ＋
          </span>
          <div>
            <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white/90">
              {total} created
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              in the last 7 days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
            📅
          </span>
          <div>
            <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white/90">
              {dueSoonCount} due
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              in the next 7 days
            </p>
          </div>
        </div>
      </div>

      {/* 3 SVG Donut Charts Row (By Status, By Type, By Assignee) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ReportDonutCard
          title="Work items by status"
          total={total}
          slices={[
            { label: "Done", count: doneCount, color: "#22A06B" },
            { label: "In Progress", count: inProgressCount, color: "#0C66E4" },
            { label: "In Review", count: inReviewCount, color: "#8270DB" },
            { label: "To Do", count: todoCount, color: "#E56910" },
          ]}
        />

        <ReportDonutCard
          title="Work items by type"
          total={total}
          slices={[
            { label: "Task", count: taskCount, color: "#0C66E4" },
            { label: "Story", count: storyCount, color: "#22A06B" },
            { label: "Bug", count: bugCount, color: "#E2483D" },
          ]}
        />

        <ReportDonutCard
          title="Work items by assignee"
          total={total}
          slices={assigneeRows}
        />
      </div>

      {/* 2 Jira Cloud Analytics Trend Charts Row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Chart 1: Work Item Creation Trend */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Work item creation trend
          </h3>
          <svg
            width="100%"
            height="170"
            viewBox="0 0 500 170"
            className="mt-3"
            aria-label="Work item creation trend chart"
          >
            <line
              x1="40"
              y1="25"
              x2="470"
              y2="25"
              stroke="#E4E7EC"
              strokeDasharray="3"
            />
            <line
              x1="40"
              y1="85"
              x2="470"
              y2="85"
              stroke="#E4E7EC"
              strokeDasharray="3"
            />
            <line x1="40" y1="145" x2="470" y2="145" stroke="#D0D5DD" />
            <text x="15" y="30" fill="#667085" fontSize="10">
              10
            </text>
            <text x="20" y="88" fill="#667085" fontSize="10">
              5
            </text>
            <text x="20" y="148" fill="#667085" fontSize="10">
              0
            </text>
            <rect x="65" y="110" width="16" height="35" rx="3" fill="#0C66E4" />
            <rect
              x="84"
              y="122"
              width="16"
              height="23"
              rx="3"
              fill="#22A06B"
            />
            <rect
              x="165"
              y="88"
              width="16"
              height="57"
              rx="3"
              fill="#0C66E4"
            />
            <rect
              x="184"
              y="102"
              width="16"
              height="43"
              rx="3"
              fill="#22A06B"
            />
            <rect
              x="275"
              y="55"
              width="16"
              height="90"
              rx="3"
              fill="#0C66E4"
            />
            <rect
              x="294"
              y="72"
              width="16"
              height="73"
              rx="3"
              fill="#22A06B"
            />
            <rect
              x="385"
              y="38"
              width="16"
              height="107"
              rx="3"
              fill="#0C66E4"
            />
            <rect
              x="404"
              y="48"
              width="16"
              height="97"
              rx="3"
              fill="#22A06B"
            />
            <text x="65" y="162" fill="#667085" fontSize="10">
              12 Oct
            </text>
            <text x="165" y="162" fill="#667085" fontSize="10">
              15 Oct
            </text>
            <text x="275" y="162" fill="#667085" fontSize="10">
              18 Oct
            </text>
            <text x="385" y="162" fill="#667085" fontSize="10">
              21 Oct
            </text>
          </svg>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />
              Created
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-success-600" />
              Resolved
            </span>
          </div>
        </div>

        {/* Chart 2: Work Item Cycle Time */}
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
            <line
              x1="40"
              y1="25"
              x2="470"
              y2="25"
              stroke="#E4E7EC"
              strokeDasharray="3"
            />
            <line
              x1="40"
              y1="85"
              x2="470"
              y2="85"
              stroke="#E4E7EC"
              strokeDasharray="3"
            />
            <line x1="40" y1="145" x2="470" y2="145" stroke="#D0D5DD" />
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

      {/* Sprint Burndown & Sprint Velocity Grid */}
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              Sprint Velocity Chart
            </h3>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              Last 3 Sprints
            </span>
          </div>
          <div className="mt-4 flex h-40 items-end justify-around border-b border-gray-200 px-4 pb-2 dark:border-gray-800">
            {[
              { sprint: "Sprint 1", commit: 24, done: 22, cH: 72, dH: 66 },
              { sprint: "Sprint 2", commit: 28, done: 27, cH: 85, dH: 82 },
              {
                sprint: "Sprint 3 (Current)",
                commit: 30,
                done: 29,
                cH: 94,
                dH: 90,
              },
            ].map((sp) => (
              <div
                key={sp.sprint}
                className="flex h-full flex-col items-center justify-end gap-1.5"
              >
                <div className="flex h-full items-end gap-2">
                  <div
                    title={`Committed: ${sp.commit} pts`}
                    style={{ height: `${sp.cH}%` }}
                    className="flex w-7 items-start justify-center rounded-t bg-gray-200 pt-1 text-[10px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {sp.commit}
                  </div>
                  <div
                    title={`Completed: ${sp.done} pts`}
                    style={{ height: `${sp.dH}%` }}
                    className="flex w-7 items-start justify-center rounded-t bg-success-600 pt-1 text-[10px] font-bold text-white"
                  >
                    {sp.done}
                  </div>
                </div>
                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                  {sp.sprint}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-300 dark:bg-gray-700" />
              Committed Story Points
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-success-600" />
              Completed Story Points
            </span>
          </div>
        </div>
      </div>

      {/* Paginated Work Items Report Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
            Sprint Work Items Report ({total})
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
              ◀ Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 cursor-pointer rounded-lg border border-gray-200 px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            >
              Next ▶
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

function ReportDonutCard({
  title,
  total,
  slices,
}: {
  title: string;
  total: number;
  slices: readonly { label: string; count: number; color: string }[];
}) {
  const circumference = 2 * Math.PI * 45;
  const segments = slices.reduce<{
    offset: number;
    items: {
      label: string;
      dashArray: string;
      dashOffset: number;
      color: string;
    }[];
  }>(
    (acc, slice) => {
      if (slice.count <= 0 || total <= 0) return acc;
      const len = (slice.count / total) * circumference;
      return {
        offset: acc.offset + len,
        items: [
          ...acc.items,
          {
            label: slice.label,
            dashArray: `${len} ${circumference - len}`,
            dashOffset: -acc.offset,
            color: slice.color,
          },
        ],
      };
    },
    { offset: 0, items: [] },
  ).items;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div
          aria-hidden="true"
          className="relative flex h-28 w-28 shrink-0 items-center justify-center"
        >
          <svg
            width="112"
            height="112"
            viewBox="0 0 120 120"
            className="-rotate-90"
          >
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="#F2F4F7"
              strokeWidth="16"
            />
            {segments.map((seg) => (
              <circle
                key={seg.label}
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold leading-none tabular-nums text-gray-900 dark:text-white/90">
              {total}
            </span>
            <span className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              Total items
            </span>
          </div>
        </div>

        <ul className="w-full space-y-2 text-xs">
          {slices.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="font-bold tabular-nums text-gray-900 dark:text-white/90">
                {s.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
