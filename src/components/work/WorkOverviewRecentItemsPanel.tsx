import { useFormatter, useTranslations } from "next-intl";
import { WorkStatusBadge } from "./WorkStatusBadge";
import WorkOverviewPanel from "./WorkOverviewPanel";
import type { WorkItem } from "./work-types";

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
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {latestItems.map((item) => {
          const createdDate = format.dateTime(new Date(item.createdAt), {
            dateStyle: "medium",
            timeZone: "UTC",
          });
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-label={t("openWorkItem", { key: item.key, title: item.title })}
                onClick={(event) => onOpenItem(item, event.currentTarget)}
                className="flex w-full cursor-pointer items-center gap-3 py-3 text-start transition-colors first:pt-0 last:pb-0 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800/50"
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {item.assignee.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white/90">
                    <span className="text-brand-600 dark:text-brand-400">{item.key}</span>
                    <span aria-hidden="true"> · </span>
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {overview("createdOn", { date: createdDate })}
                  </span>
                </span>
                <span className="hidden shrink-0 sm:inline-flex">
                  <WorkStatusBadge status={item.status} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </WorkOverviewPanel>
  );
}
