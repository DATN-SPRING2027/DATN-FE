import { useTranslations } from "next-intl";
import WorkOverviewPanel from "./WorkOverviewPanel";
import { WORK_STATUS_ORDER, type WorkStatus } from "./work-types";

const statusColors: Record<WorkStatus, string> = {
  TODO: "var(--color-gray-400)",
  IN_PROGRESS: "var(--color-brand-500)",
  IN_REVIEW: "var(--color-warning-500)",
  DONE: "var(--color-success-500)",
};

export default function WorkOverviewStatusPanel({
  counts,
  total,
}: {
  counts: Record<WorkStatus, number>;
  total: number;
}) {
  const t = useTranslations("work");
  const overview = useTranslations("work.overviewPanel");
  const slices = WORK_STATUS_ORDER.reduce<{
    endAngle: number;
    segments: string[];
  }>(
    (result, status) => {
      const count = counts[status];
      if (count === 0) return result;
      const nextAngle = result.endAngle + (count / total) * 360;
      return {
        endAngle: nextAngle,
        segments: [
          ...result.segments,
          `${statusColors[status]} ${result.endAngle}deg ${nextAngle}deg`,
        ],
      };
    },
    { endAngle: 0, segments: [] },
  ).segments;

  return (
    <WorkOverviewPanel
      title={overview("statusTitle")}
      description={overview("statusDescription")}
    >
      <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div
          aria-hidden="true"
          className="relative mx-auto flex h-40 w-40 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${slices.join(", ")})` }}
        >
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center dark:bg-gray-900">
            <span className="text-3xl font-semibold leading-none text-gray-900 dark:text-white/90">
              {total}
            </span>
            <span className="mt-1 max-w-20 text-xs leading-4 text-gray-500 dark:text-gray-400">
              {overview("totalItems")}
            </span>
          </div>
        </div>
        <ul className="grid gap-3" aria-label={overview("statusTitle")}>
          {WORK_STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-gray-600 dark:text-gray-300">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColors[status] }}
                />
                <span className="truncate">{t(`statuses.${status}`)}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-gray-900 dark:text-white/90">
                {counts[status]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WorkOverviewPanel>
  );
}
