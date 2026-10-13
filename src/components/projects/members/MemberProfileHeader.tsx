"use client";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { TrashBinIcon, TimeIcon } from "@/icons";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export default function MemberProfileHeader({
  member,
  disabled,
  onRemove,
}: {
  member: ProjectMembership;
  disabled: boolean;
  onRemove: (member: ProjectMembership) => void;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-600 ring-4 ring-brand-25 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/5"
        >
          {member.userId.slice(-2).toUpperCase()}
        </span>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold break-all text-gray-900 dark:text-gray-100">
              {member.userId}
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${member.status === "ACTIVE" ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400" : "border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}
            >
              {t(member.status)}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <TimeIcon aria-hidden="true" className="size-4" />
            {t("joinedAt")}:{" "}
            <time dateTime={member.joinedAt}>
              {format.dateTime(new Date(member.joinedAt), {
                dateStyle: "medium",
                timeZone: "UTC",
              })}
            </time>
          </p>
        </div>
      </div>
      {member.status === "ACTIVE" && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          startIcon={<TrashBinIcon aria-hidden="true" className="size-4" />}
          onClick={() => onRemove(member)}
          className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-500"
        >
          {t("remove")}
        </Button>
      )}
    </header>
  );
}
