"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export default function MemberDirectory({
  members,
  selectedId,
  disabled,
  onSelect,
}: {
  members: readonly ProjectMembership[];
  selectedId?: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  if (!members.length)
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {t("empty")}
      </p>
    );
  return (
    <ul className="flex custom-scrollbar max-h-128 flex-col gap-2 overflow-y-auto p-1">
      {members.map((member) => (
        <li key={member.id}>
          <button
            type="button"
            aria-label={t("viewMember", { userId: member.userId })}
            aria-pressed={selectedId === member.id}
            disabled={disabled}
            onClick={() => onSelect(member.id)}
            className={`w-full cursor-pointer space-y-3 rounded-xl border p-3.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${selectedId === member.id ? "border-brand-400 bg-brand-25 shadow-theme-xs dark:border-brand-500 dark:bg-brand-500/10" : "border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/50 dark:hover:bg-gray-800"}`}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {member.userId.slice(-2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium break-all text-gray-900 dark:text-gray-100">
                {member.userId}
              </span>
              <span
                aria-hidden="true"
                className="text-gray-400 rtl:rotate-180 dark:text-gray-500"
              >
                ›
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <time dateTime={member.joinedAt}>
                {format.dateTime(new Date(member.joinedAt), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                })}
              </time>
              <span
                className={
                  member.status === "ACTIVE"
                    ? "text-success-700 dark:text-success-400"
                    : "text-gray-500 dark:text-gray-400"
                }
              >
                {t(member.status)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
