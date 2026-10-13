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
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export default function MemberTable({
  members,
  disabled,
  onRemove,
  showActions = true,
}: {
  members: readonly ProjectMembership[];
  disabled: boolean;
  onRemove: (member: ProjectMembership) => void;
  showActions?: boolean;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  if (!members.length)
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {t("empty")}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <Table className="w-full min-w-lg">
        <caption className="sr-only">{t("list")}</caption>
        <TableHeader className="bg-gray-50 dark:bg-gray-800">
          <TableRow>
            {[
              "userId",
              "status",
              "joinedAt",
              ...(showActions ? ["actions"] : []),
            ].map((key) => (
              <TableCell
                key={key}
                isHeader
                className="px-4 py-3 text-start text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t(key)}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="px-4 py-3 text-sm whitespace-nowrap text-gray-800 dark:text-gray-200">
                {member.userId}
              </TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {t(member.status)}
              </TableCell>
              <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                <time dateTime={member.joinedAt}>
                  {format.dateTime(new Date(member.joinedAt), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </time>
              </TableCell>
              {showActions && (
                <TableCell className="px-4 py-3">
                  {member.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onRemove(member)}
                      className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      {t("remove")}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
