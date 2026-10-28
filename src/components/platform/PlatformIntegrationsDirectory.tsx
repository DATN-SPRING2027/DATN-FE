"use client";

import { useTranslations } from "next-intl";
import DirectorySelect from "./ui/DirectorySelect";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  formatPlatformDate,
  DirectoryToolbar,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  box,
  cell,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformIntegrationsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole.operations");
  const { canReadIntegrations, integrations, setPage, status, setStatus } =
    model;
  return !canReadIntegrations ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant
      platform.integrations.integration.read.
    </p>
  ) : (
    <section className={`${box} overflow-hidden`}>
      <DirectoryToolbar title="Integrations">
        <DirectorySelect
          aria-label={t("integrationStatus")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          {["CONNECTED", "EXPIRED", "REVOKED"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </DirectorySelect>
      </DirectoryToolbar>
      {integrations.data !== undefined &&
        !isReadAccessLost(integrations.error) &&
        (integrations.isFetching || integrations.isRefetchError) && (
          <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <QueryRefreshStatus
              hasData
              isFetching={integrations.isFetching}
              isRefetchError={integrations.isRefetchError}
              onRetry={() => void integrations.refetch()}
            />
          </div>
        )}
      {integrations.isPending && !integrations.data ? (
        <Loading columns={4} />
      ) : integrations.isError &&
        (!integrations.data || isReadAccessLost(integrations.error)) ? (
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
                  ? formatPlatformDate(integration.lastSyncAt)
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
      {integrations.data?.pagination &&
        !isReadAccessLost(integrations.error) && (
          <PlatformPagination
            ariaLabel="Integrations"
            page={integrations.data.pagination.page}
            totalPages={integrations.data.pagination.totalPages}
            totalItems={integrations.data.pagination.totalItems}
            alwaysShow
            pageSize={integrations.data.pagination.pageSize}
            returnedItems={integrations.data.data.length}
            disabled={integrations.isFetching}
            onPageChange={setPage}
          />
        )}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t("integrationUnavailable")}
      </p>
    </section>
  );
}
