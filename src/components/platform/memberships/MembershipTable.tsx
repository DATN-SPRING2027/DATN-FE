"use client";

import { useLocale, useTranslations } from "next-intl";
import StatusBadge from "../ui/StatusBadge";
import jira from "../ui/jira.module.css";
import RoleLabel from "@/components/common/RoleLabel";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PlatformDirectoryMembership,
  PlatformMembership,
} from "@/lib/queries/platform/usePlatformConsole";
import styles from "./MembershipDirectory.module.css";

export default function MembershipTable({
  rows,
  canSuspend,
  currentUserId,
  onSuspend,
}: {
  rows: readonly PlatformDirectoryMembership[];
  canSuspend: boolean;
  currentUserId: string;
  onSuspend: (membership: PlatformMembership) => void;
}) {
  const t = useTranslations("platformConsole");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      className={`${jira.tableFrame} ${styles.scroll}`}
      role="region"
      tabIndex={0}
      aria-label={t("memberships.title")}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "member",
              "email",
              "organization",
              "role",
              "status",
              "updated",
              "actions",
            ].map((key) => (
              <TableCell
                key={key}
                isHeader
                className={
                  key === "actions"
                    ? "sticky end-0 bg-gray-50 dark:bg-gray-800"
                    : ""
                }
              >
                {t(`table.${key}`)}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((member) => {
            const name =
              member.user?.fullName ?? t("memberships.userUnavailable");
            const initials = name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();
            const suspendable =
              canSuspend &&
              member.status === "ACTIVE" &&
              member.userId !== currentUserId &&
              member.hasPersistedVersion !== false;
            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className={styles.identity}>
                    <span className={jira.userAvatar} aria-hidden="true">
                      {initials || "?"}
                    </span>
                    <div>
                      <span className={styles.name} title={name}>
                        {name}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={styles.email} title={member.user?.email}>
                    {member.user?.email ?? member.userId}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={styles.organization}
                    title={member.organization?.name ?? member.organizationId}
                  >
                    {member.organization?.name ?? member.organizationId}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={styles.roles}>
                    {member.organizationRoles.length
                      ? member.organizationRoles.map((role) => (
                          <span key={role}>
                            <RoleLabel roleCode={role} />
                          </span>
                        ))
                      : t("table.noRole")}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={member.status}
                    label={t(`membershipStatus.${member.status}`)}
                    className={`${jira.accountStatus} ${member.status === "SUSPENDED" ? jira.suspendedStatus : member.status === "PENDING_INVITE" ? jira.pendingStatus : member.status === "REMOVED" ? jira.mutedStatus : ""}`}
                  />
                </TableCell>
                <TableCell>
                  <time dateTime={member.updatedAt}>
                    {date.format(new Date(member.updatedAt))}
                  </time>
                </TableCell>
                <TableCell className="sticky end-0 bg-white dark:bg-gray-900">
                  {suspendable ? (
                    <button
                      type="button"
                      className={styles.suspend}
                      onClick={() => onSuspend(member)}
                    >
                      {t("memberships.suspend")}
                    </button>
                  ) : (
                    <span className={styles.secondary}>—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
