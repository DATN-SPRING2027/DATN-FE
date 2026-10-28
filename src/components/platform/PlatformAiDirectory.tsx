"use client";

import { useTranslations } from "next-intl";
import StatusBadge from "./ui/StatusBadge";

import {
  DirectoryToolbar,
  DirectoryTable,
  formatPlatformDate,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  box,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformAiDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole");
  const { canReadAi, ai } = model;
  return !canReadAi ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.ai.operations.read.
    </p>
  ) : (
    <section className={`${box} p-5`}>
      <DirectoryToolbar title="SAG / RAG operations" />
      {ai.data !== undefined &&
        !isReadAccessLost(ai.error) &&
        (ai.isFetching || ai.isRefetchError) && (
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
          <DirectoryTable
            headers={[
              t("operations.service"),
              t("operations.readiness"),
              t("operations.availability"),
              t("operations.checked"),
            ]}
          >
            <tr>
              <td>{ai.data.name}</td>
              <td>
                <StatusBadge status={ai.data.readiness} />
              </td>
              <td>
                <StatusBadge status={ai.data.availability} />
              </td>
              <td>{formatPlatformDate(ai.data.lastCheckedAt)}</td>
            </tr>
          </DirectoryTable>
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
