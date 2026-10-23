import { useTranslations } from"next-intl";
import WorkOverviewPanel from"./WorkOverviewPanel";

export type WorkOverviewBreakdownRow = Readonly<{
  id: string;
  label: string;
  value: number;
  colorClass: string;
  initials?: string;
}>;

export default function WorkOverviewBreakdownPanel({
  title,
  description,
  rows,
  total,
}: {
  title: string;
  description: string;
  rows: readonly WorkOverviewBreakdownRow[];
  total: number;
}) {
  const overview = useTranslations("work.overviewPanel");

  return (
    <WorkOverviewPanel title={title} description={description}>
      <ul className="grid gap-4">
        {rows.map((row) => {
          const percentage = total === 0 ? 0 : Math.round((row.value / total) * 100);
          return (
            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,1.5fr)] items-center gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                {row.initials ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {row.initials}
                  </span>
                ) : (
                  <span aria-hidden="true"className={`h-2.5 w-2.5 shrink-0 ${row.colorClass}`} />
                )}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true"className="h-3 min-w-0 flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <span className={`block h-full ${row.colorClass}`} style={{ width: `${percentage}%` }} />
                </span>
                <span className="w-16 shrink-0 text-end text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
                  {overview("distributionValue", { count: row.value, percentage })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </WorkOverviewPanel>
  );
}
