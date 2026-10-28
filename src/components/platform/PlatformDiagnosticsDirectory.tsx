"use client";

import { useTranslations } from "next-intl";
import useDirectoryPagination from "./useDirectoryPagination";
import PlatformPagination from "./PlatformPagination";
import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/platform/ui/EmptyState";
import {
  DirectoryTable,
  formatPlatformDate,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  box,
  cell,
  input,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformDiagnosticsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole");
  const {
    canReadDiagnostics,
    requestId,
    setRequestId,
    setTraceId,
    traceId,
    trace,
  } = model;
  const pagination = useDirectoryPagination(trace.data?.events ?? [], traceId);
  return !canReadDiagnostics ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.diagnostics.trace.read.
    </p>
  ) : (
    <section className={`${box} overflow-hidden`}>
      <div className="border-b border-gray-100 p-5 dark:border-gray-800">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTraceId(requestId.trim());
          }}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-xs">
            {t("operations.requestId")}
            <input
              className={`${input} w-full`}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              aria-label="Request ID"
              maxLength={128}
              pattern="[A-Za-z0-9._:-]+"
              required
              placeholder="Request ID"
            />
          </label>
          <Button variant="outline" size="sm">
            Find trace
          </Button>
        </form>
      </div>
      {trace.data !== undefined &&
        !isReadAccessLost(trace.error) &&
        (trace.isFetching || trace.isRefetchError) && (
          <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <QueryRefreshStatus
              hasData
              isFetching={trace.isFetching}
              isRefetchError={trace.isRefetchError}
              onRetry={() => void trace.refetch()}
            />
          </div>
        )}
      {trace.isPending && traceId && !trace.data ? (
        <Loading />
      ) : trace.isError && (!trace.data || isReadAccessLost(trace.error)) ? (
        <ErrorState retry={() => void trace.refetch()} />
      ) : trace.data ? (
        <>
          <DirectoryTable
            headers={["Time", "Action", "Resource", "Actor", "Result"]}
          >
            {pagination.rows.map((event) => (
              <tr key={event.eventId}>
                <td className={cell}>{formatPlatformDate(event.occurredAt)}</td>
                <td className={cell}>{event.action}</td>
                <td className={cell}>
                  {event.resourceType} · {event.resourceId}
                </td>
                <td className={cell}>{event.actorUserId}</td>
                <td className={cell}>{event.result}</td>
              </tr>
            ))}
          </DirectoryTable>
          <PlatformPagination
            {...pagination}
            alwaysShow
            ariaLabel={t("operations.tabs.diagnostics")}
            returnedItems={pagination.rows.length}
            disabled={trace.isFetching}
          />
          {trace.data.truncated && (
            <p className="px-5 py-3 text-xs text-amber-700">
              The API truncated this trace to its bounded event limit.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          title="No trace selected"
          body="Submit a request ID to query the diagnostics API."
        />
      )}
    </section>
  );
}
