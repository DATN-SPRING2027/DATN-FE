"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import PlatformRecordModal from "./ui/PlatformRecordModal";
import {
  usePlatformAuditEventQuery,
  usePlatformAuditResourceHistoryQuery,
} from "@/lib/queries/platform/usePlatformOperations";
import {
  ErrorState,
  Loading,
  QueryRefreshStatus,
  formatPlatformDate,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import StatusBadge from "./ui/StatusBadge";
import styles from "./PlatformAuditEventDialog.module.css";

export default function PlatformAuditEventDialog({
  eventId,
  triggerRef,
  onClose,
}: {
  eventId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const t = useTranslations("platformConsole.audit.detail");
  const detail = usePlatformAuditEventQuery(eventId, true);
  const record =
    detail.data?.eventId === eventId && !isReadAccessLost(detail.error)
      ? detail.data
      : undefined;
  const history = usePlatformAuditResourceHistoryQuery(
    record?.resourceType ?? "",
    record?.resourceId ?? "",
    Boolean(record),
  );

  return (
    <PlatformRecordModal
      title={t("title")}
      closeLabel={t("close")}
      triggerRef={triggerRef}
      onClose={onClose}
    >
      <div className={styles.body} aria-busy={detail.isFetching || undefined}>
        <QueryRefreshStatus
          hasData={Boolean(record)}
          isFetching={detail.isFetching}
          isRefetchError={detail.isRefetchError}
          onRetry={() => void detail.refetch()}
        />
        {detail.isError && !record ? (
          <ErrorState
            message={t("unavailable")}
            retry={() => void detail.refetch()}
          />
        ) : !record ? (
          <Loading columns={2} />
        ) : (
          <>
            <p className={styles.action}>{record.action}</p>
            <dl className={styles.fields}>
              <Field label={t("eventId")} value={record.eventId} />
              <Field
                label={t("resource")}
                value={`${record.resourceType} · ${record.resourceId}`}
              />
              <Field label={t("actor")} value={record.actorUserId} />
              <Field
                label={t("time")}
                value={formatPlatformDate(record.occurredAt)}
              />
              <Field label={t("requestId")} value={record.requestId ?? "—"} />
              <Field label={t("reason")} value={record.reasonCode ?? "—"} />
              <div>
                <dt>{t("result")}</dt>
                <dd>
                  <StatusBadge status={record.result} />
                </dd>
              </div>
            </dl>
            {record.changes && (
              <div className={styles.section}>
                <h3>{t("changes")}</h3>
                <ul className={styles.history}>
                  {Object.entries(record.changes).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}</strong>: {String(value.from ?? "—")} →{" "}
                      {String(value.to ?? "—")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.section}>
              <h3>{t("history")}</h3>
              <QueryRefreshStatus
                hasData={
                  history.data !== undefined && !isReadAccessLost(history.error)
                }
                isFetching={history.isFetching}
                isRefetchError={history.isRefetchError}
                onRetry={() => void history.refetch()}
              />
              {history.isError &&
              (!history.data || isReadAccessLost(history.error)) ? (
                <p role="alert">{t("historyUnavailable")}</p>
              ) : history.isPending && !history.data ? (
                <p role="status">{t("loadingHistory")}</p>
              ) : history.data?.data.length ? (
                <ol className={styles.history}>
                  {history.data.data.map((event) => (
                    <li key={event.eventId}>
                      <strong>{event.action}</strong>
                      <p>
                        {formatPlatformDate(event.occurredAt)} ·{" "}
                        {event.actorUserId}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("emptyHistory")}</p>
              )}
            </div>
          </>
        )}
      </div>
    </PlatformRecordModal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
