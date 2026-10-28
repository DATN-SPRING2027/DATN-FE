"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchIcon } from "@/icons";
import PlatformPagination from "./PlatformPagination";
import useDirectoryPagination from "./useDirectoryPagination";
import DirectorySelect from "./ui/DirectorySelect";
import EmptyState from "./ui/EmptyState";
import StatusBadge from "./ui/StatusBadge";
import jira from "./ui/jira.module.css";
import {
  DirectoryTable,
  formatPlatformDate,
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
  const t = useTranslations("platformConsole");
  const { canReadServices, services } = model;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const scope = JSON.stringify([search, sort]);
  const query = search.trim().toLocaleLowerCase();
  // This endpoint returns a complete, bounded service inventory (not an API page).
  const rows = [...(services.data ?? [])]
    .filter((service) =>
      `${service.name} ${service.id}`.toLocaleLowerCase().includes(query),
    )
    .sort((a, b) =>
      sort === "checked"
        ? (Date.parse(b.lastCheckedAt ?? "") || 0) -
            (Date.parse(a.lastCheckedAt ?? "") || 0) ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  const pagination = useDirectoryPagination(rows, scope);
  const visibleRows = pagination.rows;
  const hasData =
    services.data !== undefined && !isReadAccessLost(services.error);

  if (!canReadServices)
    return (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant platform.services.service.read.
      </p>
    );

  return (
    <section className={box} aria-busy={services.isFetching || undefined}>
      <div className={jira.toolbar}>
        <label className={jira.searchField}>
          <SearchIcon aria-hidden="true" />
          <span className="sr-only">{t("operations.searchServices")}</span>
          <input
            type="search"
            value={search}
            maxLength={100}
            placeholder={t("operations.searchServices")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <DirectorySelect
          aria-label={t("operations.sortServices")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="name">{t("operations.sortName")}</option>
          <option value="checked">{t("operations.sortChecked")}</option>
        </DirectorySelect>
      </div>
      <QueryRefreshStatus
        hasData={hasData}
        isFetching={services.isFetching}
        isRefetchError={services.isRefetchError}
        onRetry={() => void services.refetch()}
      />
      {services.isPending && !services.data ? (
        <Loading columns={5} />
      ) : services.isError &&
        (!services.data || isReadAccessLost(services.error)) ? (
        <ErrorState retry={() => void services.refetch()} />
      ) : visibleRows.length ? (
        <DirectoryTable
          headers={[
            "Service",
            "Status",
            "Availability",
            "Dependencies",
            "Checked",
          ]}
        >
          {visibleRows.map((service) => (
            <tr key={service.id}>
              <td className={cell} title={service.id}>
                <strong>{service.name}</strong>
                <span className="sr-only">{service.id}</span>
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
              <td className={cell} title={service.diagnosticsSummary}>
                {service.lastCheckedAt
                  ? formatPlatformDate(service.lastCheckedAt)
                  : "—"}
                <span className="sr-only">{service.diagnosticsSummary}</span>
              </td>
            </tr>
          ))}
        </DirectoryTable>
      ) : (
        <EmptyState
          title={t("operations.noServices")}
          body={t("operations.noServicesBody")}
        />
      )}
      {hasData && (
        <PlatformPagination
          alwaysShow
          {...pagination}
          returnedItems={visibleRows.length}
          ariaLabel={t("operations.tabs.services")}
          disabled={services.isFetching}
        />
      )}
    </section>
  );
}
