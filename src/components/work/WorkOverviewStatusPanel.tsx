import { useTranslations } from"next-intl";
import WorkOverviewPanel from"./WorkOverviewPanel";
import { WORK_STATUS_ORDER, type WorkStatus } from"./work-types";

const STATUS_HEX: Record<WorkStatus, string> = {
  DONE:"#22A06B",
  IN_REVIEW:"#8270DB",
  IN_PROGRESS:"#0C66E4",
  TODO:"#E56910",
};

export default function WorkOverviewStatusPanel({
  counts,
  total,
  onViewAllItems,
}: {
  counts: Record<WorkStatus, number>;
  total: number;
  onViewAllItems?: () => void;
}) {
  const t = useTranslations("work");
  const overview = useTranslations("work.overviewPanel");

  const circumference = 2 * Math.PI * 60;
  const donutSegments = WORK_STATUS_ORDER.reduce<{
    offset: number;
    items: {
      status: WorkStatus;
      dashArray: string;
      dashOffset: number;
      color: string;
    }[];
  }>(
    (acc, status) => {
      const count = counts[status];
      if (count <= 0 || total <= 0) return acc;
      const segLength = (count / total) * circumference;
      return {
        offset: acc.offset + segLength,
        items: [
          ...acc.items,
          {
            status,
            dashArray: `${segLength} ${circumference - segLength}`,
            dashOffset: -acc.offset,
            color: STATUS_HEX[status],
          },
        ],
      };
    },
    { offset: 0, items: [] },
  ).items;

  return (
    <WorkOverviewPanel
      title={overview("statusTitle")}
      description={overview("statusDescription")}
    >
      <div className="space-y-4">
        {onViewAllItems && (
          <div className="-mt-2 flex justify-end">
            <button
              type="button"
              onClick={onViewAllItems}
              className="cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              View all work items
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]">
          {/* Jira 160x160 Multi-Segment SVG Donut Chart */}
          <div
            aria-hidden="true"
            className="relative mx-auto flex h-40 w-40 shrink-0 items-center justify-center"
          >
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              className="-rotate-90"
            >
              <circle
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke="currentColor"
                strokeWidth="20"
                className="text-gray-100 dark:text-gray-800"
              />
              {donutSegments.map((seg) => (
                <circle
                  key={seg.status}
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="20"
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold leading-none tabular-nums text-gray-900 dark:text-white/90">
                {total}
              </span>
              <span className="mt-1 max-w-24 text-[11px] leading-3.5 text-gray-500 dark:text-gray-400">
                {overview("totalItems")}
              </span>
            </div>
          </div>

          <ul className="grid gap-3"aria-label={overview("statusTitle")}>
            {WORK_STATUS_ORDER.map((status) => (
              <li
                key={status}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2.5 text-gray-700 dark:text-gray-300">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0"
                    style={{ backgroundColor: STATUS_HEX[status] }}
                  />
                  <span className="truncate font-medium">
                    {t(`statuses.${status}`)}
                  </span>
                </span>
                <span className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white/90">
                  {counts[status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WorkOverviewPanel>
  );
}
