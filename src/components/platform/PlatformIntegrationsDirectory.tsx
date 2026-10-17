"use client";

import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  box,
  cell,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformIntegrationsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const { canReadIntegrations, integrations, setPage } = model;
  return !canReadIntegrations ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant
      platform.integrations.integration.read.
    </p>
  ) : (
    <section className={`${box} overflow-hidden`}>
      <div className="border-b border-gray-100 p-5 dark:border-gray-800">
        <h2 className="text-sm font-bold">Integrations</h2>
        <p className="mt-1 text-xs text-gray-500">
          Safe Jira metadata only. Site URLs, credentials, and raw errors are
          withheld.
        </p>
      </div>
      {integrations.isPending ? (
        <Loading columns={4} />
      ) : integrations.isError ? (
        <ErrorState retry={() => void integrations.refetch()} />
      ) : integrations.data?.data.length ? (
        <DirectoryTable
          headers={[
            "Provider",
            "Organization / Project",
            "Status",
            "Last sync",
            "Failure summary",
          ]}
        >
          {integrations.data.data.map((integration) => (
            <tr key={integration.id}>
              <td className={cell}>
                {integration.provider}
                <span className="font-mono mt-1 block text-[10px] text-gray-500">
                  {integration.id}
                </span>
              </td>
              <td className={cell}>
                {integration.organizationId}
                <span className="mt-1 block">{integration.projectId}</span>
              </td>
              <td className={cell}>
                <StatusBadge
                  status={integration.status}
                  label={integration.status}
                />
              </td>
              <td className={cell}>
                {integration.lastSyncAt
                  ? new Date(integration.lastSyncAt).toLocaleString()
                  : "—"}
              </td>
              <td className={cell}>{integration.lastFailureSummary ?? "—"}</td>
            </tr>
          ))}
        </DirectoryTable>
      ) : (
        <EmptyState
          title="No integrations found"
          body="The Platform API returned no integration projections."
        />
      )}
      {integrations.data?.pagination && (
        <PlatformPagination
          ariaLabel="Integrations"
          page={integrations.data.pagination.page}
          totalPages={integrations.data.pagination.totalPages}
          totalItems={integrations.data.pagination.totalItems}
          onPageChange={setPage}
        />
      )}
      <p className="border-t border-gray-100 px-5 py-4 text-xs text-amber-700 dark:border-gray-800 dark:text-amber-400">
        Test and reconnect commands are currently blocked by the BE provider
        readiness gate; no action has been sent.
      </p>
    </section>
  );
}
