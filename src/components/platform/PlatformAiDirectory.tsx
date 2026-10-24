"use client";

import {
  ErrorState,
  Loading,
  QueryRefreshStatus,
  TextField,
  box,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformAiDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const { canReadAi, ai } = model;
  return !canReadAi ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.ai.operations.read.
    </p>
  ) : (
    <section className={`${box} p-5`}>
      <h2 className="text-sm font-bold">SAG / RAG operations</h2>
      <p className="mt-1 text-xs text-gray-500">
        Operational metadata only; model/provider health and processing job
        details are not exposed by the current BE contract.
      </p>
      {ai.data !== undefined && !isReadAccessLost(ai.error) && (ai.isFetching || ai.isRefetchError) && (
        <div className="mt-4">
          <QueryRefreshStatus
            hasData
            isFetching={ai.isFetching}
            isRefetchError={ai.isRefetchError}
            onRetry={() => void ai.refetch()}
          />
        </div>
      )}
      {ai.isPending && !ai.data ? (
        <Loading columns={3} />
      ) : ai.isError && (!ai.data || isReadAccessLost(ai.error)) ? (
        <ErrorState retry={() => void ai.refetch()} />
      ) : (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Service" value={ai.data.name} />
            <TextField label="Readiness" value={ai.data.readiness} />
            <TextField label="Availability" value={ai.data.availability} />
            <TextField
              label="Last checked"
              value={new Date(ai.data.lastCheckedAt).toLocaleString()}
            />
          </dl>
          <p className="mt-4 rounded-xl bg-gray-50 p-4 text-xs dark:bg-gray-800">
            {ai.data.diagnosticsSummary}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Dependencies:{" "}
            {Object.entries(ai.data.dependencies)
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(" · ") || "No dependency detail"}
          </p>
        </>
      )}
    </section>
  );
}
