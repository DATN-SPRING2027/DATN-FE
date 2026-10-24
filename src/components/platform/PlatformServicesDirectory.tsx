"use client";

import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  box,
  cell,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformServicesDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const { canReadServices, services } = model;
  return !canReadServices ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.services.service.read.
    </p>
  ) : (
    <section className={`${box} overflow-hidden`}>
      <div className="border-b border-gray-100 p-5 dark:border-gray-800">
        <h2 className="text-sm font-bold">Service operations</h2>
        <p className="mt-1 text-xs text-gray-500">
          Readiness, dependency status, and bounded diagnostics from the
          Platform API.
        </p>
      </div>
      {services.data !== undefined &&
        !isReadAccessLost(services.error) &&
        (services.isFetching || services.isRefetchError) && (
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
        <QueryRefreshStatus
          hasData
          isFetching={services.isFetching}
          isRefetchError={services.isRefetchError}
          onRetry={() => void services.refetch()}
        />
        </div>
      )}
      {services.isPending && !services.data ? (
        <Loading columns={4} />
      ) : services.isError && (!services.data || isReadAccessLost(services.error)) ? (
        <ErrorState retry={() => void services.refetch()} />
      ) : services.data?.length ? (
        <DirectoryTable
          headers={[
            "Service",
            "Status",
            "Availability",
            "Dependencies",
            "Checked",
          ]}
        >
          {services.data.map((service) => (
            <tr key={service.id}>
              <td className={cell}>
                <strong>{service.name}</strong>
                <span className="font-mono mt-1 block text-[10px] text-gray-500">
                  {service.id}
                </span>
              </td>
              <td className={cell}>
                <StatusBadge status={service.status} label={service.status} />
              </td>
              <td className={cell}>
                {service.availability} / {service.liveness}
              </td>
              <td className={cell}>
                {Object.entries(service.dependencies)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(" · ") || "No dependency detail"}
              </td>
              <td className={cell}>
                {service.lastCheckedAt
                  ? new Date(service.lastCheckedAt).toLocaleString()
                  : "—"}
                <span className="mt-1 block max-w-sm text-[10px] text-gray-500">
                  {service.diagnosticsSummary}
                </span>
              </td>
            </tr>
          ))}
        </DirectoryTable>
      ) : (
        <EmptyState
          title="No service data"
          body="No service projections were returned."
        />
      )}
    </section>
  );
}
