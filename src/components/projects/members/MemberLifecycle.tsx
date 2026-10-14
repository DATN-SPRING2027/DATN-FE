"use client";
import { useFormatter, useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export default function MemberLifecycle({
  member,
}: {
  member: ProjectMembership;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  return (
    <ComponentCard
      title={t("membershipOverview")}
      className="h-full shadow-theme-xs"
    >
      <ol className="space-y-5 border-s border-gray-200 ps-5 dark:border-gray-700">
        <li className="relative">
          <span
            aria-hidden="true"
            className="absolute -start-6 top-1.5 size-2 rounded-full bg-brand-500 ring-4 ring-brand-50 dark:ring-brand-500/10"
          />
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-300">
              {t("joinedProject")}
            </p>
            <time
              dateTime={member.joinedAt}
              className="mt-2 block text-sm font-medium text-gray-800 dark:text-gray-200"
            >
              {format.dateTime(new Date(member.joinedAt), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              })}
            </time>
          </div>
        </li>
        <li className="relative">
          <span
            aria-hidden="true"
            className="absolute -start-6 top-1.5 size-2 rounded-full bg-gray-400 ring-4 ring-gray-100 dark:ring-gray-800"
          />
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("currentStatus")}
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t(member.status)}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("membershipRecordHint")}
            </p>
          </div>
        </li>
      </ol>
    </ComponentCard>
  );
}
