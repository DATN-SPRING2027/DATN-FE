"use client";

import { useState, type ComponentProps, type RefObject } from "react";
import { useTranslations } from "next-intl";
import jira from "../ui/jira.module.css";
import PlatformPageControls from "../ui/PlatformPageControls";
import {
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import styles from "./UserDirectory.module.css";
import PlatformUserActionsMenu from "../PlatformUserActionsMenu";
import EmptyState from "../ui/EmptyState";
import StatusBadge from "../ui/StatusBadge";
import { ErrorState } from "../PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";

interface UserDirectoryProps {
  model: PlatformOperationsViewModel;
  searchRef: RefObject<HTMLInputElement | null>;
  onAction: ComponentProps<typeof PlatformUserActionsMenu>["onAction"];
  actionsPending: boolean;
}

export default function UserDirectory({
  model,
  onAction,
  actionsPending,
}: UserDirectoryProps) {
  const t = useTranslations("platformUserDirectory");
  const { users, status, setStatus, setPage, operatorId, canManageUsers } =
    model;
  const [sort, setSort] = useState("fullName");
  const rows = [...(users.data?.data ?? [])].sort((a, b) => {
    const field =
      sort === "email"
        ? "email"
        : sort === "createdAt"
          ? "createdAt"
          : "fullName";
    return a[field].localeCompare(b[field], "en", {
      numeric: true,
      sensitivity: "base",
    });
  });
  // Counts and ranges always describe the server-filtered result, never the current page alone.
  const pagination = users.data?.pagination;
  const page = pagination?.page ?? 1;
  const total = pagination?.totalItems ?? 0;
  const totalPages = pagination?.totalPages ?? 0;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <section
      className={`${styles.directory} ${jira.directory}`}
      aria-labelledby="user-directory-title"
    >
      <header className="sr-only">
        <h1 id="user-directory-title">{t("title")}</h1>
      </header>
      <div className={jira.tabs} role="group" aria-label={t("statusFilter")}>
        {["", "ACTIVE", "SUSPENDED", "ARCHIVED"].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value ? t(value) : t("allUsers")}
          </button>
        ))}
      </div>
      <div className={jira.toolbar}>
        <select
          aria-label={t("sortBy")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="fullName">{t("sortName")}</option>
          <option value="email">{t("sortEmail")}</option>
          <option value="createdAt">{t("sortCreated")}</option>
        </select>
      </div>

      {users.isPending ? (
        <p
          role="status"
          className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400"
        >
          {t("loading")}
        </p>
      ) : users.isError ? (
        <ErrorState retry={() => void users.refetch()} />
      ) : users.data?.data.length ? (
        <div className="overflow-x-auto" aria-busy={users.isFetching}>
          <Table>
            <TableHeader>
              <TableRow>
                {["fullName", "email", "status", "joined", "actions"].map(
                  (key) => (
                    <TableCell
                      key={key}
                      isHeader
                      className={`px-4 text-start text-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400 ${key === "actions" ? "sticky end-0 bg-gray-50 dark:bg-gray-800" : ""}`}
                    >
                      {t(key)}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((user) => {
                const accountStatus = user.archivedAt
                  ? "ARCHIVED"
                  : user.status;
                const initials =
                  user.fullName
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")
                    .toUpperCase() || "—";
                const cellClass =
                  "whitespace-nowrap px-4 text-sm text-gray-600 dark:text-gray-300";
                return (
                  <TableRow
                    key={user.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30"
                  >
                    <TableCell className={cellClass}>
                      <button
                        type="button"
                        onClick={(event) =>
                          onAction("view-details", user, event.currentTarget)
                        }
                        className="flex cursor-pointer items-center gap-3 rounded text-start font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-100"
                      >
                        <span aria-hidden="true" className={jira.userAvatar}>
                          {initials}
                        </span>
                        <span
                          className="max-w-52 truncate"
                          title={user.fullName}
                        >
                          {user.fullName}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className={cellClass}>
                      <span
                        className="block max-w-64 truncate"
                        title={user.email}
                      >
                        {user.email}
                      </span>
                    </TableCell>
                    <TableCell className={cellClass}>
                      <StatusBadge
                        status={accountStatus}
                        label={t(accountStatus)}
                        className={`${jira.accountStatus} ${accountStatus === "SUSPENDED" ? jira.suspendedStatus : accountStatus === "PENDING_INVITE" ? jira.pendingStatus : accountStatus === "ARCHIVED" ? jira.mutedStatus : ""}`}
                      />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <time dateTime={user.createdAt}>
                        {formatDate(user.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell
                      className={`${cellClass} sticky end-0 bg-white dark:bg-gray-900`}
                    >
                      <PlatformUserActionsMenu
                        user={user}
                        operatorId={operatorId}
                        canManage={canManageUsers}
                        disabled={actionsPending}
                        onAction={onAction}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      )}

      {pagination && !users.isError && (
        <nav aria-label={t("pagination")} className={jira.pagination}>
          <div className="flex flex-wrap items-center gap-3">
            <span aria-live="polite">
              {t("range", {
                from:
                  total === 0 || !users.data?.data.length
                    ? 0
                    : (page - 1) * pagination.pageSize + 1,
                to: users.data?.data.length
                  ? Math.min(
                      (page - 1) * pagination.pageSize + users.data.data.length,
                      total,
                    )
                  : 0,
                total,
              })}
            </span>
          </div>
          <PlatformPageControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={users.isFetching}
          />
        </nav>
      )}
    </section>
  );
}
