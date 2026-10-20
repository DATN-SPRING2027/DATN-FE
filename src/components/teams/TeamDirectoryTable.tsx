"use client";

import type { ReactNode } from "react";
import Button from "@/components/ui/button/Button";
import { ChevronDownIcon, PlusIcon } from "@/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TeamDirectoryStatus = "ACTIVE" | "ARCHIVED" | "ALL";

export interface TeamDirectoryItem {
  id: string;
  name: string;
  code: string;
  status: Exclude<TeamDirectoryStatus, "ALL">;
}

export interface TeamDirectoryCopy {
  statusFilter: string;
  statuses: Record<TeamDirectoryStatus, string>;
  teamCount: (count: number) => string;
  headers: { name: string; code: string; status: string; actions: string };
  tableCaption: string;
  emptyMessage: string;
  paginationLabel: string;
  pageLabel: (page: number) => string;
  pageSummary: (page: number, totalPages: number) => string;
  previous: string;
  next: string;
}

export default function TeamDirectoryTable({
  items,
  status,
  onStatusChange,
  totalItems,
  page = 1,
  totalPages = 1,
  onPageChange,
  isPageChanging = false,
  copy,
  renderActions,
  stateContent,
  createAction,
}: {
  items: readonly TeamDirectoryItem[];
  status: TeamDirectoryStatus;
  onStatusChange: (status: TeamDirectoryStatus) => void;
  totalItems?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isPageChanging?: boolean;
  copy: TeamDirectoryCopy;
  renderActions: (team: TeamDirectoryItem) => ReactNode;
  stateContent?: ReactNode;
  createAction?: { label: string; onClick: () => void };
}) {
  const cell =
    "px-4 py-3.5 text-start text-sm text-gray-700 dark:text-gray-300";
  const headers = [
    ["name", copy.headers.name],
    ["code", copy.headers.code],
    ["status", copy.headers.status],
    ["actions", copy.headers.actions],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {copy.statusFilter}
          </span>
          <span className="relative inline-flex">
            <select
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value as TeamDirectoryStatus)
              }
              className="h-9 w-32 cursor-pointer appearance-none rounded-md border border-gray-200 bg-white py-1.5 ps-3 pe-9 text-sm text-gray-800 shadow-theme-xs transition-colors outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-white/5"
            >
              {(["ACTIVE", "ARCHIVED", "ALL"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy.statuses[value]}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            />
          </span>
        </label>
        <div className="ms-auto flex flex-wrap items-center gap-3">
          {totalItems !== undefined && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {copy.teamCount(totalItems)}
            </p>
          )}
          {createAction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              startIcon={<PlusIcon aria-hidden="true" className="size-4" />}
              className="h-9 shrink-0 bg-transparent! px-3! py-1.5! whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              onClick={createAction.onClick}
            >
              {createAction.label}
            </Button>
          )}
        </div>
      </div>

      {stateContent ? (
        stateContent
      ) : items.length ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <Table className="w-full">
            <caption className="sr-only">{copy.tableCaption}</caption>
            <TableHeader className="bg-gray-50 dark:bg-white/3">
              <TableRow>
                {headers.map(([key, label]) => (
                  <TableCell
                    key={key}
                    isHeader
                    className="h-11 px-4 text-start text-xs font-semibold whitespace-nowrap text-gray-600 dark:text-gray-300"
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((team) => (
                <TableRow
                  key={team.id}
                  className="transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5"
                >
                  <TableCell className={cell}>
                    <p className="min-w-48 font-medium text-gray-900 dark:text-gray-100">
                      {team.name}
                    </p>
                  </TableCell>
                  <TableCell className={`${cell} font-mono text-xs`}>
                    {team.code}
                  </TableCell>
                  <TableCell className={cell}>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${team.status === "ACTIVE" ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400" : "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                    >
                      {copy.statuses[team.status]}
                    </span>
                  </TableCell>
                  <TableCell className={`${cell} text-end`}>
                    {renderActions(team)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p
          role="status"
          className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
        >
          {copy.emptyMessage}
        </p>
      )}

      {items.length > 0 && totalPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {copy.pageSummary(page, totalPages)}
          </span>
          <nav
            aria-label={copy.paginationLabel}
            className="flex items-center gap-2"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || isPageChanging}
              onClick={() => onPageChange?.(page - 1)}
            >
              {copy.previous}
            </Button>
            <span
              aria-current="page"
              aria-label={copy.pageLabel(page)}
              className="flex h-9 min-w-9 items-center justify-center rounded-md bg-brand-500 px-2 text-sm font-medium text-white"
            >
              {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPageChanging}
              onClick={() => onPageChange?.(page + 1)}
            >
              {copy.next}
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}
