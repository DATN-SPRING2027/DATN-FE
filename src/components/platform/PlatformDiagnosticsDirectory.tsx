"use client";

import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import styles from "./diagnostics/TraceDesk.module.css";
import { isReadAccessLost } from "./PlatformOperationsUi";
import type { PlatformAuditEvent } from "@/lib/queries/platform/usePlatformOperations";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformDiagnosticsDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole.operations.traceDesk");
  const format = useFormatter();
  const {
    canReadDiagnostics,
    requestId,
    setRequestId,
    setTraceId,
    traceId,
    trace,
  } = model;
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const events = trace.data?.events ?? [];
  const selectedEvent =
    events.find((event) => event.eventId === selectedEventId) ?? events[0];

  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedEventId(null);
    setTraceId(requestId.trim());
  }

  if (!canReadDiagnostics) {
    return (
      <div className={styles.page}>
        <div className={styles.accessNotice} role="status">
          <span className={styles.noticeGlyph} aria-hidden="true">
            !
          </span>
          <div>
            <strong>{t("accessTitle")}</strong>
            <p>{t("accessBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  const queryHasError =
    trace.isError && (!trace.data || isReadAccessLost(trace.error));

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.introCopy}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowMark} aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M3 5.5h5M12 5.5h5M8 5.5v9M12 14.5H3M17 14.5h-5" />
                <circle cx="10" cy="5.5" r="2" />
                <circle cx="10" cy="14.5" r="2" />
              </svg>
            </span>
            {t("eyebrow")}
            <span className={styles.eyebrowRule} aria-hidden="true" />
            <span>{t("redactedLabel")}</span>
          </div>
          <h2>{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </div>
        <div className={styles.scopeStamp}>
          <span className={styles.scopeDot} aria-hidden="true" />
          <span>{t("scopeStamp")}</span>
        </div>
      </header>

      <form className={styles.lookup} onSubmit={submitLookup}>
        <label className={styles.lookupLabel} htmlFor="trace-request-id">
          <span className={styles.lookupIcon} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <circle cx="8.8" cy="8.8" r="5.8" />
              <path d="m13.2 13.2 4 4" />
            </svg>
          </span>
          <span className={styles.lookupText}>
            <span>{t("lookupLabel")}</span>
            <input
              id="trace-request-id"
              className={styles.searchInput}
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              aria-label={t("lookupLabel")}
              maxLength={128}
              pattern="[A-Za-z0-9._:-]+"
              required
              placeholder={t("placeholder")}
              autoComplete="off"
              spellCheck={false}
            />
          </span>
        </label>
        <div className={styles.lookupAction}>
          <span className={styles.exactHint}>{t("exactHint")}</span>
          <button
            className={styles.queryButton}
            type="submit"
            disabled={trace.isFetching}
          >
            {trace.isFetching ? t("searching") : t("lookupAction")}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>

      <div className={styles.contractNote} role="note">
        <span className={styles.contractIcon} aria-hidden="true">
          i
        </span>
        <p>{t("contractNote")}</p>
      </div>

      {trace.data &&
        !isReadAccessLost(trace.error) &&
        (trace.isFetching || trace.isRefetchError) && (
          <div
            className={styles.refreshNotice}
            role="status"
            aria-live="polite"
          >
            <span className={styles.refreshDot} aria-hidden="true" />
            {trace.isFetching ? t("refreshing") : t("refreshFailed")}
            {trace.isRefetchError && (
              <button type="button" onClick={() => void trace.refetch()}>
                {t("retry")}
              </button>
            )}
          </div>
        )}

      {trace.isPending && traceId && !trace.data ? (
        renderTraceLoading(t("loading"))
      ) : queryHasError ? (
        <div className={styles.errorState} role="alert">
          <span className={styles.errorGlyph} aria-hidden="true">
            !
          </span>
          <div>
            <strong>{t("errorTitle")}</strong>
            <p>
              {isReadAccessLost(trace.error) ? t("accessLost") : t("errorBody")}
            </p>
          </div>
          <button type="button" onClick={() => void trace.refetch()}>
            {t("retry")}
          </button>
        </div>
      ) : trace.data ? (
        renderTraceResult({
          requestId: trace.data.requestId,
          events,
          selectedEvent,
          truncated: trace.data.truncated,
          formatDate: (value) =>
            format.dateTime(new Date(value), {
              dateStyle: "medium",
              timeStyle: "medium",
            }),
          onSelect: setSelectedEventId,
        })
      ) : (
        renderReadyState()
      )}
    </div>
  );

  function renderTraceResult({
    requestId: resultRequestId,
    events: resultEvents,
    selectedEvent: resultSelectedEvent,
    truncated,
    formatDate,
    onSelect,
  }: {
    requestId: string;
    events: readonly PlatformAuditEvent[];
    selectedEvent: PlatformAuditEvent | undefined;
    truncated: boolean;
    formatDate: (value: string) => string;
    onSelect: (eventId: string) => void;
  }) {
    return (
      <div className={styles.result}>
        <div className={styles.resultHeading}>
          <div>
            <div className={styles.resultKicker}>{t("resultKicker")}</div>
            <h3>{t("resultTitle")}</h3>
          </div>
          <div className={styles.resultMeta}>
            <span className={styles.requestPill} title={resultRequestId}>
              {resultRequestId}
            </span>
            <span className={styles.eventCount}>
              {t("eventCount", { count: resultEvents.length })}
            </span>
          </div>
        </div>

        {truncated && (
          <div className={styles.truncationNote} role="status">
            <span aria-hidden="true">↘</span>
            <p>{t("truncatedNote")}</p>
          </div>
        )}

        {resultEvents.length === 0 ? (
          <div className={styles.noEvents}>
            <div className={styles.noEventsGlyph} aria-hidden="true">
              ∅
            </div>
            <div>
              <strong>{t("noEventsTitle")}</strong>
              <p>{t("noEventsBody")}</p>
            </div>
          </div>
        ) : (
          <div className={styles.traceGrid}>
            <section
              className={styles.sequence}
              aria-labelledby="trace-sequence-title"
            >
              <div className={styles.sequenceHeader}>
                <div>
                  <span className={styles.panelOverline}>
                    {t("sequenceOverline")}
                  </span>
                  <h3 id="trace-sequence-title">{t("sequenceTitle")}</h3>
                </div>
                <span className={styles.sequenceLimit}>
                  {t("sequenceLimit")}
                </span>
              </div>
              <ol className={styles.eventList}>
                {resultEvents.map((event, index) => (
                  <li className={styles.eventItem} key={event.eventId}>
                    <button
                      type="button"
                      className={styles.eventButton}
                      data-selected={
                        resultSelectedEvent?.eventId === event.eventId
                      }
                      aria-current={
                        resultSelectedEvent?.eventId === event.eventId
                          ? "true"
                          : undefined
                      }
                      aria-label={t("eventAccessibleLabel", {
                        number: index + 1,
                        action: event.action,
                        resource: event.resourceType,
                      })}
                      onClick={() => onSelect(event.eventId)}
                    >
                      <span className={styles.eventRail} aria-hidden="true">
                        <span className={styles.eventNode} />
                      </span>
                      <span className={styles.eventContent}>
                        <span className={styles.eventTopline}>
                          <span className={styles.eventIndex}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <time
                            className={styles.eventTime}
                            dateTime={event.occurredAt}
                          >
                            {formatDate(event.occurredAt)}
                          </time>
                          <span className={styles.successTag}>
                            {t("success")}
                          </span>
                        </span>
                        <strong className={styles.eventAction}>
                          {event.action}
                        </strong>
                        <span className={styles.eventResource}>
                          <span>{event.resourceType}</span>
                          <span
                            className={styles.resourceSeparator}
                            aria-hidden="true"
                          >
                            /
                          </span>
                          <span className={styles.resourceId}>
                            {event.resourceId}
                          </span>
                        </span>
                      </span>
                      <span className={styles.eventChevron} aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className={styles.orderFootnote}>{t("orderFootnote")}</p>
            </section>

            {resultSelectedEvent &&
              renderEventInspector(resultSelectedEvent, formatDate)}
          </div>
        )}
      </div>
    );
  }

  function renderEventInspector(
    event: PlatformAuditEvent,
    formatDate: (value: string) => string,
  ) {
    return (
      <aside
        className={styles.inspector}
        aria-labelledby="event-inspector-title"
      >
        <div className={styles.inspectorTop}>
          <span className={styles.inspectorGlyph} aria-hidden="true">
            ⌁
          </span>
          <div>
            <span className={styles.panelOverline}>
              {t("inspectorOverline")}
            </span>
            <h3 id="event-inspector-title">{t("inspectorTitle")}</h3>
          </div>
          <span className={styles.inspectorResult}>{event.result}</span>
        </div>
        <div className={styles.selectedAction}>
          <span>{t("actionLabel")}</span>
          <strong>{event.action}</strong>
          <p>
            {event.resourceType}
            <span aria-hidden="true"> / </span>
            {event.resourceId}
          </p>
        </div>
        <dl className={styles.detailList}>
          {renderDetail(t("occurredAt"), formatDate(event.occurredAt))}
          {renderDetail(t("actor"), event.actorUserId)}
          {renderDetail(t("eventId"), event.eventId, true)}
          {renderDetail(t("scope"), event.scope)}
          {event.organizationId &&
            renderDetail(t("organization"), event.organizationId, true)}
          {event.reasonCode && renderDetail(t("reasonCode"), event.reasonCode)}
          {event.requestId &&
            renderDetail(t("requestId"), event.requestId, true)}
        </dl>
        {event.changedFields && event.changedFields.length > 0 && (
          <div className={styles.changedFields}>
            <span>{t("changedFields")}</span>
            <div>
              {event.changedFields.map((field) => (
                <code key={field}>{field}</code>
              ))}
            </div>
          </div>
        )}
        <div className={styles.inspectorFootnote}>
          <span aria-hidden="true">i</span>
          <p>{t("inspectorFootnote")}</p>
        </div>
      </aside>
    );
  }

  function renderDetail(label: string, value: string, mono = false) {
    return (
      <div className={styles.detail}>
        <dt>{label}</dt>
        <dd className={mono ? styles.mono : undefined}>{value || "—"}</dd>
      </div>
    );
  }

  function renderTraceLoading(label: string) {
    return (
      <div className={styles.loadingState} role="status" aria-busy="true">
        <span className={styles.srOnly}>{label}</span>
        <div className={styles.loadingSequence} aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div className={styles.loadingRow} key={item}>
              <span />
              <div>
                <i />
                <i />
              </div>
            </div>
          ))}
        </div>
        <div className={styles.loadingInspector} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  function renderReadyState() {
    return (
      <div className={styles.readyState}>
        <div className={styles.readyIllustration} aria-hidden="true">
          <span className={styles.readyNode} />
          <span className={styles.readyLink} />
          <span className={styles.readyNode} />
          <span className={styles.readyLink} />
          <span className={styles.readyNode} />
          <span className={styles.readyOrbit} />
        </div>
        <span className={styles.panelOverline}>{t("readyOverline")}</span>
        <h3>{t("readyTitle")}</h3>
        <p>{t("readyBody")}</p>
        <div className={styles.readySteps}>
          <span>
            <b>01</b>
            {t("readyStepOne")}
          </span>
          <span>
            <b>02</b>
            {t("readyStepTwo")}
          </span>
          <span>
            <b>03</b>
            {t("readyStepThree")}
          </span>
        </div>
      </div>
    );
  }
}
