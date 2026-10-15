"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import { ArrowRightIcon, GroupIcon, TrashBinIcon } from "@/icons";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export default function MemberDirectory({
  members,
  selectedId,
  disabled,
  removeDisabled,
  onSelect,
  onRemove,
}: {
  members: readonly ProjectMembership[];
  selectedId?: string;
  disabled: boolean;
  removeDisabled: boolean;
  onSelect: (id: string) => void;
  onRemove: (member: ProjectMembership) => void;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  if (!members.length)
    return (
      <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
        {t("empty")}
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-2xl!">
        <caption className="sr-only">{t("list")}</caption>
        <TableHeader className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
          <TableRow>
            {[
              "memberColumn",
              "accessLevel",
              "joinedAt",
              "statusColumn",
              "actions",
            ].map((label) => (
              <TableCell
                key={label}
                isHeader
                className="px-5 py-3 text-start text-theme-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
              >
                {t(label)}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {members.map((member) => (
            <TableRow
              key={member.id}
              className={`border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-gray-800/40 ${selectedId === member.id ? "bg-brand-50/50 dark:bg-brand-500/10" : ""}`}
            >
              <TableCell className="min-w-64 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {member.userId.slice(-2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block break-all text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {member.userId}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {t("projectMember")}
                    </span>
                  </span>
                </div>
              </TableCell>
              <TableCell className="px-5 py-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <GroupIcon
                    aria-hidden="true"
                    className="size-3.5 text-gray-400"
                  />
                  {t("projectScope")}
                </span>
              </TableCell>
              <TableCell className="px-5 py-4 text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
                <time dateTime={member.joinedAt}>
                  {format.dateTime(new Date(member.joinedAt), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </time>
              </TableCell>
              <TableCell className="px-5 py-4">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${member.status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${member.status === "ACTIVE" ? "bg-success-600 dark:bg-success-400" : "bg-gray-400 dark:bg-gray-500"}`}
                  />
                  {t(member.status)}
                </span>
              </TableCell>
              <TableCell className="px-5 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={t("viewMember", { userId: member.userId })}
                    aria-pressed={selectedId === member.id}
                    onClick={() => onSelect(member.id)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-gray-600 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/3"
                  >
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="size-4 rtl:rotate-180"
                    />
                  </button>
                  {member.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={removeDisabled}
                      startIcon={
                        <TrashBinIcon aria-hidden="true" className="size-4" />
                      }
                      onClick={() => onRemove(member)}
                      className="cursor-pointer text-error-600! dark:text-error-400!"
                    >
                      {t("remove")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
