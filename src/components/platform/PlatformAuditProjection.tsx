"use client";

import Button from "@/components/ui/button/Button";
import PlatformPagination from "@/components/platform/PlatformPagination";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import {
  platformAuditActions,
  usePlatformAuditEventQuery,
  usePlatformAuditEventsQuery,
  usePlatformAuditResourceHistoryQuery,
} from "@/lib/queries/platform/usePlatformOperations";
import { useTranslations } from "next-intl";
import { useState } from "react";
import EmptyState from "./ui/EmptyState";
import { TableSkeleton } from "./ui/LoadingSkeleton";
import { isReadAccessLost, QueryRefreshStatus } from "./PlatformOperationsUi";

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
      pageSize: 25,
      action: action || undefined,
      actorUserId: actorFilter,
      resourceType: resource || undefined,
      resourceId: resourceIdFilter,
      from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
    },
    allowed,
  );
  const detail = usePlatformAuditEventQuery(
    selectedEventId,
    allowed && Boolean(selectedEventId),
  );
  const history = usePlatformAuditResourceHistoryQuery(
    detail.data?.resourceType ?? "",
    detail.data?.resourceId ?? "",
    allowed && Boolean(detail.data),
  );
  const events = audit.data?.data ?? [];

  const getActionBadgeColor = (actionName: string) =>
    actionName.includes("create")
      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
      : actionName.includes("suspend") ||
          actionName.includes("revoke") ||
          actionName.includes("cancel")
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
        : "bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {t("audit.title")}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("audit.boundedNote")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!allowed || audit.isFetching}
            onClick={() => void audit.refetch()}
          >
            {audit.isFetching ? t("refreshing") : t("refresh")}
          </Button>
        </div>
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
            {audit.data !== undefined && !isReadAccessLost(audit.error) && (audit.isFetching || audit.isRefetchError) && (
              <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <QueryRefreshStatus
                  hasData
                  isFetching={audit.isFetching}
                  isRefetchError={audit.isRefetchError}
                  onRetry={() => void audit.refetch()}
                />
              </div>
            )}
            <div className="dark:bg-gray-850/40 grid gap-3 border-b border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-gray-800">
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
            {events.length ? (
              <div className="overflow-x-auto">
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
                            onClick={() => setSelectedEventId(row.eventId)}
                            className={`font-mono inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${getActionBadgeColor(row.action)}`}
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
                            {new Date(row.occurredAt).toLocaleString()}
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
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>
      {selectedEventId && (
        <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold">Audit event detail</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEventId("")}
            >
              Close
            </Button>
          </div>
          {detail.data !== undefined &&
            !isReadAccessLost(detail.error) &&
            (detail.isFetching || detail.isRefetchError) && (
              <div className="mb-4">
                <QueryRefreshStatus
                  hasData
                  isFetching={detail.isFetching}
                  isRefetchError={detail.isRefetchError}
                  onRetry={() => void detail.refetch()}
                />
              </div>
            )}
          {detail.isPending && !detail.data ? (
            <TableSkeleton rows={2} columns={3} />
          ) : detail.isError && (!detail.data || isReadAccessLost(detail.error)) ? (
            <p role="alert" className="text-xs text-rose-600">
              Audit event detail is unavailable.
            </p>
          ) : (
            <>
              <dl className="grid gap-4 break-words sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Action" value={detail.data.action} />
                <Detail
                  label="Resource"
                  value={`${detail.data.resourceType} · ${detail.data.resourceId}`}
                />
                <Detail label="Actor" value={detail.data.actorUserId} />
                <Detail
                  label="Time"
                  value={new Date(detail.data.occurredAt).toLocaleString()}
                />
                <Detail
                  label="Request ID"
                  value={detail.data.requestId ?? "—"}
                />
                <Detail label="Reason" value={detail.data.reasonCode ?? "—"} />
              </dl>
              {detail.data.changes && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold">
                    Allowed change projection
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(detail.data.changes).map(([key, value]) => (
                      <li
                        key={key}
                        className="font-mono rounded bg-gray-50 p-2 text-[10px] break-all dark:bg-gray-800"
                      >
                        {key}: {String(value.from ?? "—")} →{" "}
                        {String(value.to ?? "—")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <h4 className="text-xs font-bold">Resource history</h4>
                {history.data !== undefined &&
                  !isReadAccessLost(history.error) &&
                  (history.isFetching || history.isRefetchError) && (
                    <div className="mt-2">
                      <QueryRefreshStatus
                        hasData
                        isFetching={history.isFetching}
                        isRefetchError={history.isRefetchError}
                        onRetry={() => void history.refetch()}
                      />
                    </div>
                  )}
                {history.isPending && !history.data ? (
                  <p role="status" className="mt-2 text-xs text-gray-500">
                    Loading history
                  </p>
                ) : history.isError && (!history.data || isReadAccessLost(history.error)) ? (
                  <p role="alert" className="mt-2 text-xs text-gray-500">
                    Resource history is unavailable.
                  </p>
                ) : history.data?.data.length ? (
                  <ul className="mt-2 space-y-1">
                    {history.data.data.map((event) => (
                      <li
                        key={event.eventId}
                        className="rounded bg-gray-50 p-2 text-xs dark:bg-gray-800"
                      >
                        {event.action} ·{" "}
                        {new Date(event.occurredAt).toLocaleString()} ·{" "}
                        {event.actorUserId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">
                    No resource history was returned.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
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
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-gray-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs text-gray-800 dark:text-gray-200">{value}</dd>
    </div>
  );
}
