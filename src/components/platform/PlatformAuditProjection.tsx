"use client";

import jira from "./ui/jira.module.css";
import { useModal } from "@/hooks/useModal";
import PlatformAuditEventDialog from "./PlatformAuditEventDialog";
import PlatformPagination from "@/components/platform/PlatformPagination";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import {
  platformAuditActions,
  usePlatformAuditEventsQuery,
} from "@/lib/queries/platform/usePlatformOperations";
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

const resourceTypes = [
  "ORGANIZATION",
  "PLATFORM_AUTHORITY",
  "ORGANIZATION_MEMBERSHIP",
  "USER",
  "PROJECT",
  "SESSION",
  "INCIDENT",
  "JOB",
];
const resourceIdPattern =
  /^(?:[a-f\d]{24}|[A-Za-z0-9._:-]{1,200}:[A-Za-z0-9._:-]{1,200})$/i;
const userIdPattern = /^[a-f\d]{24}$/i;
const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PlatformAuditProjection({
  permissions,
}: {
  permissions: readonly PlatformPermission[];
}) {
  const t = useTranslations("platformConsole");
  const allowed = permissions.includes("platform.audit.read");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [resource, setResource] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const eventTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const actorFilter = userIdPattern.test(actor.trim())
    ? actor.trim()
    : undefined;
  const resourceIdFilter =
    (resource === "SESSION" && sessionIdPattern.test(resourceId.trim())) ||
    resourceIdPattern.test(resourceId.trim())
      ? resourceId.trim()
      : undefined;
  const audit = usePlatformAuditEventsQuery(
    {
      page,
      pageSize: 10,
      action: action || undefined,
      actorUserId: actorFilter,
      resourceType: resource || undefined,
      resourceId: resourceIdFilter,
      from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
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
        {allowed && (
          <>
            <div className="grid gap-2 pb-2 sm:grid-cols-2 xl:grid-cols-3">
              <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase">
                {t("audit.filterAction")}
                <select
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="">All actions</option>
                  {platformAuditActions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <FilterInput
                label={t("audit.filterActor")}
                value={actor}
                onChange={(v) => {
                  setActor(v);
                  setPage(1);
                }}
                placeholder="User ObjectId"
              />
              <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase">
                {t("audit.filterResource")}
                <select
                  value={resource}
                  onChange={(e) => {
                    setResource(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="">All resources</option>
                  {resourceTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <FilterInput
                label="Resource ID"
                value={resourceId}
                onChange={(v) => {
                  setResourceId(v);
                  setPage(1);
                }}
                placeholder="ObjectId or queue:job"
              />
              <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase">
                {t("audit.from")}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase">
                {t("audit.to")}
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-xs dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
            </div>
            {((actor && !actorFilter) || (resourceId && !resourceIdFilter)) && (
              <p className="px-5 pt-3 text-[11px] text-amber-700" role="status">
                Actor/resource ID filters are sent only after they match the BE
                identifier format.
              </p>
            )}
          </>
        )}
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

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={240}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}
