"use client";

import Button from "@/components/ui/button/Button";
import EmptyState from "@/components/platform/ui/EmptyState";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  box,
  cell,
  input,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformDiagnosticsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const {
    canReadDiagnostics,
    requestId,
    setRequestId,
    setTraceId,
    traceId,
    trace,
  } = model;
  return !canReadDiagnostics ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.diagnostics.trace.read.
    </p>
  ) : (
    <section className={`${box} overflow-hidden`}>
      <div className="border-b border-gray-100 p-5 dark:border-gray-800">
        <h2 className="text-sm font-bold">Request trace</h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter a request ID to view up to 50 safe audit events. Raw logs and
          tenant content are not returned.
        </p>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTraceId(requestId.trim());
          }}
        >
          <input
            className={`${input} font-mono min-w-64 flex-1`}
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            aria-label="Request ID"
            maxLength={128}
            pattern="[A-Za-z0-9._:-]+"
            required
            placeholder="Request ID"
          />
          <Button variant="outline" size="sm">
            Find trace
          </Button>
        </form>
      </div>
      {trace.isPending && traceId ? (
        <Loading />
      ) : trace.isError ? (
        <ErrorState retry={() => void trace.refetch()} />
      ) : trace.data ? (
        <>
          <DirectoryTable
            headers={["Time", "Action", "Resource", "Actor", "Result"]}
          >
            {trace.data.events.map((event) => (
              <tr key={event.eventId}>
                <td className={cell}>
                  {new Date(event.occurredAt).toLocaleString()}
                </td>
                <td className={cell}>{event.action}</td>
                <td className={cell}>
                  {event.resourceType} · {event.resourceId}
                </td>
                <td className={cell}>{event.actorUserId}</td>
                <td className={cell}>{event.result}</td>
              </tr>
            ))}
          </DirectoryTable>
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
