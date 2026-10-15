"use client";

import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { Table } from "@/components/ui/table";
import { WorkPriorityLabel, WorkStatusBadge } from "./WorkStatusBadge";
import type { WorkItemGroup, WorkPriority, WorkStatus } from "./work-types";

export default function WorkListView({
  groups,
  selectedIds,
  allVisibleSelected,
  onToggleItem,
  onToggleAll,
  onOpenItem,
}: {
  groups: readonly WorkItemGroup[];
  selectedIds: ReadonlySet<string>;
  allVisibleSelected: boolean;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  onOpenItem: (item: WorkItemGroup["items"][number], trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("work");

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0 overflow-x-auto">
        <Table className="min-w-max border-collapse text-sm">
          <caption className="sr-only">{t("listCaption")}</caption>
          <thead className="bg-gray-50 dark:bg-gray-800/70">
            <tr>
              <th scope="col" className="w-12 px-3 py-3 text-start">
                <input
                  type="checkbox"
                  aria-label={t("selectAllVisible")}
                  checked={allVisibleSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-950"
                />
              </th>
              <th scope="col" className="min-w-80 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("workColumn")}</th>
              <th scope="col" className="min-w-40 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("assignee")}</th>
              <th scope="col" className="min-w-40 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("reporter")}</th>
              <th scope="col" className="min-w-32 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("priority")}</th>
              <th scope="col" className="min-w-36 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("status")}</th>
              <th scope="col" className="min-w-32 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("resolution")}</th>
              <th scope="col" className="min-w-32 px-3 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300">{t("created")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {groups.map((group) => (
              <Fragment key={group.id}>
                {group.label && (
                  <tr key={`${group.id}-heading`} className="bg-gray-50/70 dark:bg-gray-800/40">
                    <th colSpan={8} scope="rowgroup" className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-2">
                        {group.labelKind === "status"
                          ? t(`statuses.${group.label as WorkStatus}`)
                          : group.labelKind === "priority"
                            ? t(`priorities.${group.label as WorkPriority}`)
                            : group.label}
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {group.items.length}
                        </span>
                      </span>
                    </th>
                  </tr>
                )}
                {group.items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        aria-label={t("selectWorkItem", { key: item.key })}
                        checked={selectedIds.has(item.id)}
                        onChange={() => onToggleItem(item.id)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </td>
                    <td className="max-w-96 px-3 py-3 align-middle">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-brand-200 text-[10px] text-brand-600 dark:border-brand-500/30 dark:text-brand-400">✓</span>
                        <button
                          type="button"
                          onClick={(event) => onOpenItem(item, event.currentTarget)}
                          aria-label={t("openWorkItem", { key: item.key, title: item.title })}
                          className="min-w-0 cursor-pointer text-start focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        >
                          <span className="block truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400">{item.title}</span>
                          <span className="mt-0.5 block text-xs font-medium text-brand-600 dark:text-brand-400">{item.key}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PersonLabel person={item.assignee} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PersonLabel person={item.reporter} />
                    </td>
                    <td className="px-3 py-3 align-middle"><WorkPriorityLabel priority={item.priority} /></td>
                    <td className="px-3 py-3 align-middle"><WorkStatusBadge status={item.status} /></td>
                    <td className="px-3 py-3 align-middle">
                      <span className={`whitespace-nowrap text-sm ${item.resolution === "RESOLVED" ? "text-success-700 dark:text-success-400" : "text-gray-500 dark:text-gray-400"}`}>
                        {t(`resolutions.${item.resolution}`)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-gray-500 dark:text-gray-400">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(item.createdAt))}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{t("createHint")}</span>
        <span>{t("workItemCount", { count: groups.reduce((total, group) => total + group.items.length, 0) })}</span>
      </div>
    </div>
  );
}

function PersonLabel({
  person,
}: {
  person: { name: string; initials: string };
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
        {person.initials}
      </span>
      {person.name}
    </span>
  );
}
