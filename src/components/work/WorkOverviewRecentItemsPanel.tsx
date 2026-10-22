import { useFormatter, useTranslations } from"next-intl";
import { MonoIssueTypeIcon } from"./WorkMonoIcons";
import { WorkStatusBadge } from"./WorkStatusBadge";
import WorkOverviewPanel from"./WorkOverviewPanel";
import type { WorkItem } from"./work-types";

export default function WorkOverviewRecentItemsPanel({
  items,
  onOpenItem,
}: {
  items: readonly WorkItem[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
}) {
  const format = useFormatter();
  const t = useTranslations("work");
  const overview = useTranslations("work.overviewPanel");
  const latestItems = [...items]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);

  return (
    <WorkOverviewPanel
      title={overview("recentTitle")}
      description={overview("recentDescription")}
    >
      <ul className="space-y-2.5">
        {latestItems.map((item) => {
          const createdDate = format.dateTime(new Date(item.createdAt), {
            dateStyle:"medium",
            timeZone:"UTC",
          });

          return (
            <li key={item.id}>
              <button
                type="button"
                aria-label={t("openWorkItem", { key: item.key, title: item.title })}
                onClick={(event) => onOpenItem(item, event.currentTarget)}
                className="flex w-full cursor-pointer items-center gap-3 border border-gray-200 bg-white px-3.5 py-2.5 text-start transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 dark:hover:bg-gray-800/60"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <MonoIssueTypeIcon type={item.type} size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white/90">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {item.key}
                    </span>
                    <span aria-hidden="true"> · </span>
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {overview("createdOn", { date: createdDate })} ·{""}
                    {item.assignee.name}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-2 sm:inline-flex">
                  <WorkStatusBadge status={item.status} />
                  <span
                    aria-hidden="true"
                    title={item.assignee.name}
                    className="flex h-6 w-6 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-[10px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {item.assignee.initials}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </WorkOverviewPanel>
  );
}
