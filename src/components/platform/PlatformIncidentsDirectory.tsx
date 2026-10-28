"use client";

import { useRef } from "react";
import { useModal } from "@/hooks/useModal";
import CreatePlatformIncidentDialog from "./CreatePlatformIncidentDialog";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
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
  TextField,
  box,
  cell,
  isReadAccessLost,
  input,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformIncidentsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole");
  const createModal = useModal();
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const {
    canReadIncidents,
    canManageIncidents,
    handleSubmit,
    incidentAction,
    status,
    setStatus,
    setPage,
    incidents,
    setSelectedId,
    setIncidentHistoryPage,
    selectedId,
    selectedIncident,
    incidentHistory,
    note,
    setNote,
    runOperation,
    formMessage,
  } = model;
  return !canReadIncidents ? (
    <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
      Your Platform session does not grant platform.incidents.incident.read.
    </p>
  ) : (
    <div className="space-y-6">
      <section className={`${box} overflow-hidden`}>
        <DirectoryToolbar title="Incidents">
          <select
            className={input}
            aria-label="Incident status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canManageIncidents}
            onClick={(event) => {
              createTriggerRef.current = event.currentTarget;
              model.setFormMessage("");
              createModal.openModal();
            }}
          >
            {t("incidentForm.create")}
          </Button>
        </DirectoryToolbar>
        {incidents.data !== undefined &&
          !isReadAccessLost(incidents.error) &&
          (incidents.isFetching || incidents.isRefetchError) && (
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <QueryRefreshStatus
                hasData
                isFetching={incidents.isFetching}
                isRefetchError={incidents.isRefetchError}
                onRetry={() => void incidents.refetch()}
              />
            </div>
          )}
        {incidents.isPending && !incidents.data ? (
          <Loading />
        ) : incidents.isError &&
          (!incidents.data || isReadAccessLost(incidents.error)) ? (
          <ErrorState retry={() => void incidents.refetch()} />
        ) : incidents.data?.data.length ? (
          <DirectoryTable
            headers={[
              "Incident",
              "Severity",
              "Service",
              "Status",
              "Version",
              "Action",
            ]}
          >
            {incidents.data.data.map((incident) => (
              <tr key={incident.id}>
                <td className={cell}>
                  <strong>{incident.title}</strong>
                  <span className="font-mono mt-1 block text-[10px] text-gray-500">
                    {incident.id}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge
                    status={incident.severity}
                    label={incident.severity}
                  />
                </td>
                <td className={cell}>{incident.affectedServiceId}</td>
                <td className={cell}>
                  <StatusBadge status={incident.status} />
                </td>
                <td className={cell}>{incident.version}</td>
                <td className={cell}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedId(incident.id);
                      setIncidentHistoryPage(1);
                    }}
                  >
                    Details & history
                  </Button>
                </td>
              </tr>
            ))}
          </DirectoryTable>
        ) : (
          <EmptyState
            title="No incidents"
            body="The Platform API returned no incidents for these filters."
          />
        )}
        {incidents.data?.pagination && !isReadAccessLost(incidents.error) && (
          <PlatformPagination
            ariaLabel="Incidents"
            page={incidents.data.pagination.page}
            totalPages={incidents.data.pagination.totalPages}
            totalItems={incidents.data.pagination.totalItems}
            alwaysShow
            pageSize={incidents.data.pagination.pageSize}
            returnedItems={incidents.data.data.length}
            disabled={incidents.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>
      {createModal.isOpen && canManageIncidents && (
        <CreatePlatformIncidentDialog
          model={model}
          triggerRef={createTriggerRef}
          onClose={createModal.closeModal}
        />
      )}
      {!createModal.isOpen && !selectedId && formMessage && (
        <p role="status" className="text-xs">
          {formMessage}
        </p>
      )}
      {selectedId && (
        <section className={`${box} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold">Incident detail & history</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedId("");
                setIncidentHistoryPage(1);
                setNote("");
              }}
            >
              Close
            </Button>
          </div>
          {selectedIncident.data !== undefined &&
            !isReadAccessLost(selectedIncident.error) &&
            (selectedIncident.isFetching ||
              selectedIncident.isRefetchError) && (
              <div className="mb-4">
                <QueryRefreshStatus
                  hasData
                  isFetching={selectedIncident.isFetching}
                  isRefetchError={selectedIncident.isRefetchError}
                  onRetry={() => void selectedIncident.refetch()}
                />
              </div>
            )}
          {selectedIncident.isPending && !selectedIncident.data ? (
            <Loading columns={4} />
          ) : selectedIncident.isError &&
            (!selectedIncident.data ||
              isReadAccessLost(selectedIncident.error)) ? (
            <ErrorState retry={() => void selectedIncident.refetch()} />
          ) : (
            <dl className="mb-5 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-gray-800">
              <TextField label="Title" value={selectedIncident.data.title} />
              <TextField
                label="Severity / status"
                value={`${selectedIncident.data.severity} · ${selectedIncident.data.status}`}
              />
              <TextField
                label="Affected service"
                value={selectedIncident.data.affectedServiceId}
              />
              <TextField
                label="Version / updated"
                value={`v${selectedIncident.data.version} · ${formatPlatformDate(selectedIncident.data.updatedAt)}`}
              />
            </dl>
          )}
          {incidentHistory.data !== undefined &&
            !isReadAccessLost(incidentHistory.error) &&
            (incidentHistory.isFetching || incidentHistory.isRefetchError) && (
              <div className="mb-3">
                <QueryRefreshStatus
                  hasData
                  isFetching={incidentHistory.isFetching}
                  isRefetchError={incidentHistory.isRefetchError}
                  onRetry={() => void incidentHistory.refetch()}
                />
              </div>
            )}
          {incidentHistory.isPending && !incidentHistory.data ? (
            <Loading columns={4} />
          ) : incidentHistory.isError &&
            (!incidentHistory.data ||
              isReadAccessLost(incidentHistory.error)) ? (
            <ErrorState retry={() => void incidentHistory.refetch()} />
          ) : incidentHistory.data?.data.length ? (
            <ul className="space-y-2">
              {incidentHistory.data.data.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800"
                >
                  <strong>{item.action}</strong> · {item.fromStatus ?? "—"} →{" "}
                  {item.toStatus} · v{item.version}
                  <p className="mt-1 text-gray-500">
                    {formatPlatformDate(item.occurredAt)} · {item.actorUserId}
                  </p>
                  {item.note && <p className="mt-2 break-words">{item.note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No history"
              body="No history records were returned."
            />
          )}
          {incidentHistory.data?.pagination &&
            !isReadAccessLost(incidentHistory.error) && (
              <PlatformPagination
                ariaLabel="Incident history"
                page={incidentHistory.data.pagination.page}
                totalPages={incidentHistory.data.pagination.totalPages}
                totalItems={incidentHistory.data.pagination.totalItems}
                alwaysShow
                pageSize={incidentHistory.data.pagination.pageSize}
                returnedItems={incidentHistory.data.data.length}
                disabled={incidentHistory.isFetching}
                onPageChange={setIncidentHistoryPage}
              />
            )}
          {canManageIncidents && selectedIncident.data && (
            <form
              className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"
              onSubmit={(e) => {
                const incident = selectedIncident.data;
                if (incident)
                  void handleSubmit(e, () =>
                    incidentAction.mutateAsync({
                      incidentId: incident.id,
                      action: "notes",
                      expectedVersion: incident.version,
                      note,
                    }),
                  );
              }}
            >
              <label className="grid min-w-56 flex-1 gap-1 text-xs">
                Redacted operational note
                <textarea
                  className={`${input} min-h-20 py-2`}
                  maxLength={2000}
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={incidentAction.isPending}
                onClick={() => {
                  const incident = selectedIncident.data;
                  if (
                    incident &&
                    window.confirm(`Acknowledge incident ${incident.id}?`)
                  )
                    void runOperation(() =>
                      incidentAction.mutateAsync({
                        incidentId: incident.id,
                        action: "acknowledge",
                        expectedVersion: incident.version,
                        note,
                      }),
                    );
                }}
              >
                Acknowledge
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={incidentAction.isPending}
                onClick={() => {
                  const incident = selectedIncident.data;
                  if (
                    incident &&
                    window.confirm(`Resolve incident ${incident.id}?`)
                  )
                    void runOperation(() =>
                      incidentAction.mutateAsync({
                        incidentId: incident.id,
                        action: "resolve",
                        expectedVersion: incident.version,
                        note,
                      }),
                    );
                }}
              >
                Resolve
              </Button>
              <Button variant="outline" size="sm" type="submit">
                Add note
              </Button>
            </form>
          )}
          {formMessage && (
            <p className="mt-3 text-xs" role="status">
              {formMessage}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
