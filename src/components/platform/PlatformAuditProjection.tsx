"use client";

import jira from "./ui/jira.module.css";
import { useModal } from "@/hooks/useModal";
import PlatformAuditEventDialog from "./PlatformAuditEventDialog";
import PlatformPagination from "@/components/platform/PlatformPagination";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import { usePlatformAuditEventsQuery } from "@/lib/queries/platform/usePlatformOperations";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import EmptyState from "./ui/EmptyState";
import { TableSkeleton } from "./ui/LoadingSkeleton";
import {
  DirectoryToolbar,
  formatPlatformDate,
  isReadAccessLost,
  QueryRefreshStatus,
} from "./PlatformOperationsUi";

export default function PlatformAuditProjection({
  permissions,
}: {
  permissions: readonly PlatformPermission[];
}) {
  const t = useTranslations("platformConsole");
  const allowed = permissions.includes("platform.audit.read");
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState("");
  const eventTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const audit = usePlatformAuditEventsQuery(
    {
      page,
      pageSize: 10,
    },
    allowed,
  );
  const events = audit.data?.data ?? [];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <DirectoryToolbar
          title={t("audit.title")}
          description={t("audit.boundedNote")}
        />
        {!allowed ? (
          <p
            role="status"
            className="px-5 py-8 text-center text-xs text-gray-500"
          >
            {t("audit.permissionNeeded")}
          </p>
        ) : audit.isError && (!audit.data || isReadAccessLost(audit.error)) ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-6"
            role="alert"
          >
            <p className="text-xs text-rose-600">{t("errors.audit")}</p>
            <button
              type="button"
              onClick={() => void audit.refetch()}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : audit.isPending && !audit.data ? (
          <div>
            <p role="status" className="sr-only">
              {t("audit.loading")}
            </p>
            <TableSkeleton rows={5} columns={4} />
          </div>
        ) : (
          <>
            {audit.data !== undefined &&
              !isReadAccessLost(audit.error) &&
              (audit.isFetching || audit.isRefetchError) && (
                <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                  <QueryRefreshStatus
                    hasData
                    isFetching={audit.isFetching}
                    isRefetchError={audit.isRefetchError}
                    onRetry={() => void audit.refetch()}
                  />
                </div>
              )}
            {events.length ? (
              <div
                className={`${jira.tableFrame} overflow-x-auto`}
                role="region"
                tabIndex={0}
                aria-label={t("audit.title")}
              >
                <table className="min-w-full text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40">
                    <tr>
                      <th className="px-5 py-3 text-start">
                        {t("table.event")}
                      </th>
                      <th className="px-5 py-3 text-start">
                        {t("table.target")}
                      </th>
                      <th className="px-5 py-3 text-start">
                        {t("table.actor")}
                      </th>
                      <th className="px-5 py-3 text-end">{t("table.time")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {events.map((row) => (
                      <tr
                        key={row.eventId}
                        className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              eventTriggerRef.current = event.currentTarget;
                              setSelectedEventId(row.eventId);
                              openModal();
                            }}
                            className="text-start font-medium text-brand-600 hover:underline dark:text-brand-400"
                            aria-haspopup="dialog"
                          >
                            {row.action}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            {row.resourceType}
                          </p>
                          <p className="font-mono text-[10px] text-gray-400">
                            {row.resourceId}
                          </p>
                        </td>
                        <td className="font-mono px-5 py-3.5 text-gray-500">
                          {row.actorUserId}
                        </td>
                        <td className="px-5 py-3.5 text-end text-gray-400">
                          <time dateTime={row.occurredAt}>
                            {formatPlatformDate(row.occurredAt)}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title={t("audit.emptyTitle")}
                body={t("audit.emptyBody")}
              />
            )}
            {audit.data?.pagination && (
              <PlatformPagination
                ariaLabel={t("audit.title")}
                page={audit.data.pagination.page}
                totalPages={audit.data.pagination.totalPages}
                totalItems={audit.data.pagination.totalItems}
                alwaysShow
                pageSize={audit.data.pagination.pageSize}
                returnedItems={audit.data.data.length}
                disabled={audit.isFetching}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>
      {isOpen && selectedEventId && allowed && (
        <PlatformAuditEventDialog
          eventId={selectedEventId}
          triggerRef={eventTriggerRef}
          onClose={() => {
            closeModal();
            setSelectedEventId("");
          }}
        />
      )}
    </div>
  );
}
