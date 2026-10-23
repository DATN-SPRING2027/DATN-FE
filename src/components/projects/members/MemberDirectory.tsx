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
import { ArrowRightIcon, GroupIcon, LockIcon, TrashBinIcon } from "@/icons";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import type { LeaderRoleStatus } from "./MemberDetails";

export default function MemberDirectory({
  members,
  selectedId,
  disabled,
  removeDisabled,
  leaderUserIds,
  inactiveLeaderUserIds,
  leaderRoleStatus = "ready",
  canManageLeaders = false,
  leaderBusyUserId,
  onSelect,
  onRemove,
  onToggleLeader,
}: {
  members: readonly ProjectMembership[];
  selectedId?: string;
  disabled: boolean;
  removeDisabled: boolean;
  leaderUserIds?: ReadonlySet<string>;
  inactiveLeaderUserIds?: ReadonlySet<string>;
  leaderRoleStatus?: LeaderRoleStatus;
  canManageLeaders?: boolean;
  leaderBusyUserId?: string;
  onSelect: (id: string) => void;
  onRemove: (member: ProjectMembership) => void;
  onToggleLeader?: (
    member: ProjectMembership,
    isCurrentlyLeader: boolean,
  ) => void;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  const activeLeaderCount = leaderUserIds?.size ?? 0;

  if (!members.length) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center px-4 py-12 text-center"
      >
        <span
          aria-hidden="true"
          className="mb-3 flex size-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        >
          <GroupIcon className="size-5" />
        </span>
        <p className="text-sm font-medium text-gray-900 dark:text-white/90">
          {t("empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full p-3 sm:p-4 lg:p-0">
      <Table className="block w-full min-w-0 table-fixed text-start lg:table lg:min-w-full">
        <caption className="sr-only">{t("list")}</caption>
        <TableHeader className="hidden bg-gray-50/75 dark:bg-white/2 lg:table-header-group">
          <TableRow className="border-b border-gray-100 dark:border-gray-800">
            <TableCell
              isHeader
              className="w-[26%] px-5 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
            >
              {t("memberColumn")}
            </TableCell>
            <TableCell
              isHeader
              className="w-[23%] px-5 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
            >
              {t("accessLevel")}
            </TableCell>
            <TableCell
              isHeader
              className="w-[13%] px-5 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
            >
              {t("joinedAt")}
            </TableCell>
            <TableCell
              isHeader
              className="w-[10%] px-5 py-3 text-start text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
            >
              {t("statusColumn")}
            </TableCell>
            <TableCell
              isHeader
              className="w-[28%] px-5 py-3 text-end text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
            >
              {t("actions")}
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="block w-full space-y-3 lg:table-row-group lg:space-y-0 lg:divide-y lg:divide-gray-100 dark:lg:divide-gray-800">
          {members.map((member) => {
            const isLeader =
              leaderRoleStatus === "ready" &&
              Boolean(leaderUserIds?.has(member.userId));
            const isInactiveLeader =
              leaderRoleStatus === "ready" &&
              !isLeader &&
              Boolean(inactiveLeaderUserIds?.has(member.userId));
            const hasLeaderAssignment = isLeader || isInactiveLeader;
            const isSoleLeader =
              (isLeader && activeLeaderCount <= 1) ||
              (isInactiveLeader && activeLeaderCount === 0);
            const isBusyLeader = leaderBusyUserId === member.userId;
            return (
              <TableRow
                key={member.id}
                className={`grid w-full grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 lg:table-row lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-gray-100 lg:p-0 dark:lg:border-gray-800 ${
                  selectedId === member.id
                    ? "bg-brand-50/50 dark:bg-brand-500/10"
                    : ""
                }`}
              >
                <TableCell className="col-span-2 px-0 py-0 align-middle lg:table-cell lg:px-5 lg:py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {member.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.fullName || member.user.email}
                        className="size-9.5 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20"
                      >
                        {(
                          member.user?.fullName ||
                          member.user?.email ||
                          member.userId ||
                          "M"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white/90">
                        {member.user?.fullName ||
                          member.user?.email ||
                          member.userId}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                        {member.user?.fullName
                          ? member.user.email
                          : t("projectMember")}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="col-span-2 flex items-center justify-between gap-2 px-0 py-1 align-middle lg:table-cell lg:px-5 lg:py-3.5">
                  <span className="text-xs font-medium text-gray-500 lg:sr-only">
                    {t("accessLevel")}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap lg:justify-start">
                    {leaderRoleStatus === "loading" && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {t("leaderRoleLoading")}
                      </span>
                    )}
                    {leaderRoleStatus === "unavailable" && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300">
                        {t("leaderRoleUnavailable")}
                      </span>
                    )}
                    {isLeader && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                        {t("projectLeaderBadge")}
                      </span>
                    )}
                    {isInactiveLeader && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300">
                        <LockIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
                        {t("inactiveLeaderBadge")}
                      </span>
                    )}
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/70 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      <GroupIcon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-gray-400"
                      />
                      {t("projectScope")}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="col-span-2 flex items-center justify-between gap-2 px-0 py-1 align-middle text-sm whitespace-nowrap text-gray-600 dark:text-gray-300 lg:table-cell lg:px-5 lg:py-3.5">
                  <span className="text-xs font-medium text-gray-500 lg:sr-only">
                    {t("joinedAt")}
                  </span>
                  <time
                    dateTime={member.joinedAt}
                    className="text-xs font-medium tabular-nums sm:text-sm lg:font-normal"
                  >
                    {format.dateTime(new Date(member.joinedAt), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })}
                  </time>
                </TableCell>

                <TableCell className="col-span-2 flex items-center justify-between gap-2 px-0 py-1 align-middle lg:table-cell lg:justify-start lg:px-5 lg:py-3.5">
                  <span className="text-xs font-medium text-gray-500 lg:sr-only">
                    {t("statusColumn")}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                      member.status === "ACTIVE"
                        ? "bg-success-50 text-success-700 ring-1 ring-success-500/20 dark:bg-success-500/10 dark:text-success-400"
                        : "bg-gray-100 text-gray-600 ring-1 ring-gray-400/20 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${
                        member.status === "ACTIVE"
                          ? "bg-success-600 dark:bg-success-400"
                          : "bg-gray-400 dark:bg-gray-500"
                      }`}
                    />
                    {t(member.status)}
                  </span>
                </TableCell>

                <TableCell className="col-span-2 flex items-center justify-end border-t border-gray-100 pt-3 text-end align-middle dark:border-gray-800 lg:table-cell lg:border-0 lg:px-5 lg:py-3.5 lg:pt-0">
                  <div className="flex flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap">
                    <button
                      type="button"
                      disabled={disabled}
                      title={t("memberDetails")}
                      aria-label={t("viewMember", {
                        userId:
                          member.user?.fullName ||
                          member.user?.email ||
                          member.userId,
                      })}
                      aria-pressed={selectedId === member.id}
                      onClick={() => onSelect(member.id)}
                      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedId === member.id
                          ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      <ArrowRightIcon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
                      />
                    </button>

                    {canManageLeaders &&
                      (member.status === "ACTIVE" || isInactiveLeader) &&
                      onToggleLeader && (
                        <button
                          type="button"
                          disabled={
                            disabled ||
                            Boolean(leaderBusyUserId) ||
                            isSoleLeader
                          }
                          title={
                            isSoleLeader
                              ? t("soleLeaderCannotRevoke")
                              : undefined
                          }
                          onClick={() =>
                            onToggleLeader(member, hasLeaderAssignment)
                          }
                          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                            hasLeaderAssignment
                              ? "border-warning-200 bg-warning-50/60 text-warning-700 enabled:hover:border-warning-300 enabled:hover:bg-warning-100/70 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300 dark:enabled:hover:bg-warning-500/20"
                              : "border-brand-200 bg-brand-50/60 text-brand-700 enabled:hover:border-brand-300 enabled:hover:bg-brand-100/70 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:enabled:hover:bg-brand-500/20"
                          }`}
                        >
                          {hasLeaderAssignment
                            ? t(isBusyLeader ? "revokingLeader" : "revokeLeader")
                            : t(
                                isBusyLeader
                                  ? "appointingLeader"
                                  : "appointLeader",
                              )}
                        </button>
                      )}

                    {member.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          removeDisabled ||
                          hasLeaderAssignment ||
                          leaderRoleStatus !== "ready"
                        }
                        title={
                          leaderRoleStatus !== "ready"
                            ? t("leaderRoleRequiredForRemove")
                            : isSoleLeader
                              ? t("soleLeaderCannotRevoke")
                              : hasLeaderAssignment
                                ? t("leaderCannotBeRemoved")
                                : undefined
                        }
                        startIcon={
                          <TrashBinIcon
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0"
                          />
                        }
                        onClick={() => onRemove(member)}
                        className="h-8 border-gray-200 px-2.5 text-xs text-error-600! enabled:cursor-pointer enabled:hover:border-error-200 enabled:hover:bg-error-50 dark:border-gray-700 dark:text-error-400! dark:enabled:hover:bg-error-950/20"
                      >
                        {t("remove")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
