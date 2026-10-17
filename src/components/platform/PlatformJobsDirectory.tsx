"use client";

import Button from "@/components/ui/button/Button";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  box,
  cell,
  input,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformJobsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const {
    canReadJobs,
    queues,
    jobs,
    status,
    setStatus,
    setPage,
    canManageJobs,
    jobCommand,
    setFormMessage,
    formMessage,
  } = model;
  return !canReadJobs ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.jobs.job.read.
    </p>
  ) : (
    <div className="space-y-6">
      <section className={`${box} overflow-hidden`}>
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="text-sm font-bold">Queues</h2>
          <p className="mt-1 text-xs text-gray-500">
            Live queue health, worker counts, and bounded job counts.
          </p>
        </div>
        {queues.isPending ? (
          <Loading columns={4} />
        ) : queues.isError ? (
          <ErrorState retry={() => void queues.refetch()} />
        ) : queues.data?.length ? (
          <DirectoryTable
            headers={["Queue", "Status", "Paused", "Workers", "Depth"]}
          >
            {queues.data.map((queue) => (
              <tr key={queue.id}>
                <td className={cell}>{queue.id}</td>
                <td className={cell}>
                  <StatusBadge status={queue.status} label={queue.status} />
                </td>
                <td className={cell}>
                  {queue.paused === null
                    ? "Unknown"
                    : queue.paused
                      ? "Yes"
                      : "No"}
                </td>
                <td className={cell}>{queue.workers ?? "—"}</td>
                <td className={cell}>{queue.depth ?? "—"}</td>
              </tr>
            ))}
          </DirectoryTable>
        ) : (
          <EmptyState
            title="No queue data"
            body="The configured queue runtime returned no queue projections."
          />
        )}
      </section>
      <section className={`${box} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-bold">Jobs</h2>
            <p className="mt-1 text-xs text-gray-500">
              Payload, result, and raw failure text are withheld by the API.
            </p>
          </div>
          <select
            className={input}
            aria-label="Job status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All states</option>
            {[
              "WAITING",
              "ACTIVE",
              "COMPLETED",
              "FAILED",
              "DELAYED",
              "PAUSED",
              "WAITING_CHILDREN",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {jobs.isPending ? (
          <Loading />
        ) : jobs.isError ? (
          <ErrorState retry={() => void jobs.refetch()} />
        ) : jobs.data?.data.length ? (
          <DirectoryTable
            headers={[
              "Job",
              "Queue",
              "Status",
              "Attempts",
              "Failure summary",
              "Action",
            ]}
          >
            {jobs.data.data.map((job) => (
              <tr key={`${job.queueId}-${job.id}`}>
                <td className={`${cell} font-mono`}>{job.id}</td>
                <td className={cell}>{job.queueId}</td>
                <td className={cell}>
                  <StatusBadge status={job.status} label={job.status} />
                </td>
                <td className={cell}>
                  {job.attemptsMade}/{job.attempts}
                </td>
                <td className={cell}>{job.failureSummary ?? "—"}</td>
                <td className={cell}>
                  {canManageJobs && job.status === "FAILED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={jobCommand.isPending}
                      onClick={() => {
                        if (window.confirm(`Retry failed job ${job.id}?`))
                          void jobCommand
                            .mutateAsync({
                              queueId: job.queueId,
                              jobId: job.id,
                              action: "retry",
                              expectedStatus: "FAILED",
                            })
                            .catch(() =>
                              setFormMessage(
                                "Job state changed or the operation was blocked. Refreshed Platform data is required.",
                              ),
                            );
                      }}
                    >
                      Retry
                    </Button>
                  ) : canManageJobs &&
                    ["WAITING", "DELAYED"].includes(job.status) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={jobCommand.isPending}
                      onClick={() => {
                        if (window.confirm(`Cancel job ${job.id}?`))
                          void jobCommand
                            .mutateAsync({
                              queueId: job.queueId,
                              jobId: job.id,
                              action: "cancel",
                              expectedStatus: job.status as
                                "WAITING" | "DELAYED",
                            })
                            .catch(() =>
                              setFormMessage(
                                "Job state changed or the operation was blocked. Refreshed Platform data is required.",
                              ),
                            );
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </DirectoryTable>
        ) : (
          <EmptyState
            title="No jobs found"
            body="The Platform API returned no jobs for these filters."
          />
        )}
        {jobs.data?.pagination && (
          <PlatformPagination
            ariaLabel="Jobs"
            page={jobs.data.pagination.page}
            totalPages={jobs.data.pagination.totalPages}
            totalItems={jobs.data.pagination.totalItems}
            onPageChange={setPage}
          />
        )}
      </section>
      {formMessage && (
        <p role="status" className="text-xs">
          {formMessage}
        </p>
      )}
    </div>
  );
}
