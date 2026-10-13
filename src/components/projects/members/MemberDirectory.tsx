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
import { GroupIcon, TrashBinIcon } from "@/icons";
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
        <TableHeader className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30">
          <TableRow>
            <TableCell isHeader className="w-12 px-5 py-4">
              <input
                type="checkbox"
                aria-label={t("selectAll")}
                disabled
                className="size-4 rounded border-gray-300 text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
              />
            </TableCell>
            {[
              "userName",
              "userId",
              "role",
              "accessLevel",
              "statusColumn",
              "joinedAt",
              "actions",
            ].map((label) => (
              <TableCell
                key={label}
                isHeader
                className="px-5 py-4 text-start text-xs font-medium text-gray-500 dark:text-gray-400"
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
              className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
            >
              <TableCell className="px-5 py-4">
                <input
                  type="checkbox"
                  aria-label={t("selectMember", { userId: member.userId })}
                  disabled
                  className="size-4 rounded border-gray-300 text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
                />
              </TableCell>
              <TableCell className="min-w-40 px-5 py-4 text-sm text-gray-400 dark:text-gray-500">
                <span
                  aria-label={t("userNameUnavailable")}
                  title={t("userNameUnavailable")}
                >
                  —
                </span>
              </TableCell>
              <TableCell className="px-5 py-4">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t("viewMember", { userId: member.userId })}
                  aria-pressed={selectedId === member.id}
                  onClick={() => onSelect(member.id)}
                  className="flex min-w-48 cursor-pointer items-center gap-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {member.userId.slice(-2).toUpperCase()}
                  </span>
                  <span className="max-w-xs text-sm font-medium break-all text-gray-800 dark:text-gray-100">
                    {member.userId}
                  </span>
                </button>
              </TableCell>
              <TableCell className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                {t("projectMember")}
              </TableCell>
              <TableCell className="px-5 py-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <GroupIcon aria-hidden="true" className="size-3.5" />
                  {t("projectScope")}
                </span>
              </TableCell>
              <TableCell className="px-5 py-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${member.status === "ACTIVE" ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                >
                  {t(member.status)}
                </span>
              </TableCell>
              <TableCell className="px-5 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                <time dateTime={member.joinedAt}>
                  {format.dateTime(new Date(member.joinedAt), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </time>
              </TableCell>
              <TableCell className="px-5 py-4">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
