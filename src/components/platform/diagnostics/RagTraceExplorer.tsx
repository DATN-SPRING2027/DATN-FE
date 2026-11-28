"use client";

import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookmarkPlus,
  Braces,
  Clock3,
  Columns3,
  Database,
  Filter,
  Search,
  Workflow,
  X,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import RagTraceDetailView from "./RagTraceDetailView";
import RagTraceRunCompare from "./RagTraceRunCompare";
import styles from "./RagTraceExplorer.module.css";
import { answeredTrace, trimmedTrace } from "./ragTrace.testFixtures";
import type { RagTraceDetail, RagTraceSpan } from "./ragTrace.types";

const sampleRequestId = "req_rag_knowledge_8217";

function identifyRun(
  base: RagTraceDetail,
  identity: {
    traceId: string;
    runId: string;
    startedAt: string;
    durationMs: number;
    requestId: string;
  },
): RagTraceDetail {
  return {
    ...base,
    trace: {
      ...base.trace,
      ...identity,
    },
  };
}

const sampleRuns = [
  identifyRun(trimmedTrace, {
    traceId: "trace_rag_q8217_02",
    runId: "run_4f09b",
    requestId: sampleRequestId,
    startedAt: "2026-11-28T10:42:36+07:00",
    durationMs: 1886,
  }),
  identifyRun(answeredTrace, {
    traceId: "trace_rag_q8217_01",
    runId: "run_6d31a",
    requestId: sampleRequestId,
    startedAt: "2026-11-28T10:39:12+07:00",
    durationMs: 1480,
  }),
];

type RootRow = {
  key: string;
  trace: RagTraceDetail;
  span?: RagTraceSpan;
};
type Scope = "traces" | "observations";
type QuickView = "all" | "no_answer" | "capture_gap" | "slow";
type StatusFacet = "all" | "answered" | "no_answer" | "capture_gap";
type Display = "table" | "chart";
type TimeRange = "fixture" | "5m" | "1h";
type SortKey = "started" | "duration" | "name" | "status";
type SortDirection = "asc" | "desc";
type SavedView = {
  id: string;
  name: string;
  query: string;
  scope: Scope;
  quickView: QuickView;
  facet: StatusFacet;
  display: Display;
  timeRange: TimeRange;
  sortKey: SortKey;
  sortDirection: SortDirection;
};

const savedViewsStorageKey = "continuum.rag-trace-preview.saved-views.v1";
const savedViewsChangedEvent = "continuum:rag-trace-saved-views";

function subscribeToSavedViews(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(savedViewsChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(savedViewsChangedEvent, onChange);
  };
}

function readSavedViewsSnapshot() {
  try {
    return window.localStorage.getItem(savedViewsStorageKey) ?? "[]";
  } catch {
    return "[]";
  }
}

function readServerSavedViewsSnapshot() {
  return "[]";
}

function parseSavedViews(snapshot: string): SavedView[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed.filter(isSavedView) : [];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedView[]) {
  try {
    window.localStorage.setItem(savedViewsStorageKey, JSON.stringify(views));
    window.dispatchEvent(new Event(savedViewsChangedEvent));
  } catch {
    // Local persistence is optional; the current view remains usable in memory.
  }
}

function rootStatus(trace: RagTraceDetail) {
  return trace.trace.answerStatus ?? trace.trace.runtimeState;
}

function rowStatus(row: RootRow) {
  return row.span?.status ?? rootStatus(row.trace);
}

function duration(row: RootRow) {
  return row.span?.durationMs ?? (row.span ? null : row.trace.trace.durationMs);
}

function rowSearchText(row: RootRow) {
  const span = row.span;
  const evidence = row.trace.checkpoints.flatMap((checkpoint) =>
    checkpoint.items.map((item) => item.unitRef),
  );
  return [
    row.trace.trace.traceId,
    row.trace.trace.runId,
    row.trace.trace.requestId,
    span?.spanId,
    span?.kind,
    span?.reason,
    rowStatus(row),
    ...evidence,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function parseQuery(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      const field = /^(status|name|latency|duration|trace|request|id):(.+)$/i.exec(
        term,
      );
      if (!field) return { field: "text", value: term.toLowerCase() };
      return {
        field: field[1].toLowerCase(),
        value: field[2].toLowerCase(),
      };
    });
}

function queryMatches(row: RootRow, query: string) {
  return parseQuery(query).every(({ field, value }) => {
    if (field === "text") return rowSearchText(row).includes(value);
    if (field === "status") return rowStatus(row).toLowerCase().includes(value);
    if (field === "name") {
      return (row.span?.kind ?? "request").toLowerCase().includes(value);
    }
    if (field === "trace") return row.trace.trace.traceId.toLowerCase().includes(value);
    if (field === "request") return row.trace.trace.requestId.toLowerCase().includes(value);
    if (field === "id") {
      return [row.trace.trace.traceId, row.trace.trace.requestId, row.span?.spanId]
        .filter(Boolean)
        .some((candidate) => candidate!.toLowerCase().includes(value));
    }
    if (field === "latency" || field === "duration") {
      const measured = duration(row);
      if (measured === null || measured === undefined) return false;
      const comparison = /^(>=|<=|>|<)(\d+(?:\.\d+)?)$/.exec(value);
      if (!comparison) return `${measured}`.includes(value);
      const threshold = Number(comparison[2]);
      return comparison[1] === ">"
        ? measured > threshold
        : comparison[1] === "<"
          ? measured < threshold
          : comparison[1] === ">="
            ? measured >= threshold
            : measured <= threshold;
    }
    return rowSearchText(row).includes(value);
  });
}

function matchesFacet(row: RootRow, facet: StatusFacet) {
  if (facet === "all") return true;
  if (facet === "capture_gap") return row.trace.trace.captureState !== "recorded";
  return rootStatus(row.trace) === facet;
}

function matchesQuickView(row: RootRow, quickView: QuickView) {
  if (quickView === "all") return true;
  if (quickView === "no_answer") return rootStatus(row.trace) === "no_answer";
  if (quickView === "capture_gap") return row.trace.trace.captureState !== "recorded";
  return (duration(row) ?? 0) > 1500;
}

function matchesTimeRange(
  row: RootRow,
  timeRange: TimeRange,
  newestTimestamp: number,
) {
  if (timeRange === "fixture") return true;
  const startedAt = new Date(row.trace.trace.startedAt).getTime();
  const limitMs = timeRange === "5m" ? 5 * 60 * 1000 : 60 * 60 * 1000;
  return newestTimestamp - startedAt <= limitMs;
}

function isSavedView(value: unknown): value is SavedView {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SavedView>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.query === "string" &&
    ["traces", "observations"].includes(candidate.scope ?? "") &&
    ["all", "no_answer", "capture_gap", "slow"].includes(candidate.quickView ?? "") &&
    ["all", "answered", "no_answer", "capture_gap"].includes(candidate.facet ?? "") &&
    ["table", "chart"].includes(candidate.display ?? "") &&
    ["fixture", "5m", "1h"].includes(candidate.timeRange ?? "") &&
    ["started", "duration", "name", "status"].includes(candidate.sortKey ?? "") &&
    ["asc", "desc"].includes(candidate.sortDirection ?? "")
  );
}

export default function RagTraceExplorer() {
  const t = useTranslations("platformConsole.ragTrace");
  const format = useFormatter();
  const detailRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [scope, setScope] = useState<Scope>("traces");
  const [quickView, setQuickView] = useState<QuickView>("all");
  const [facet, setFacet] = useState<StatusFacet>("all");
  const [display, setDisplay] = useState<Display>("table");
  const [timeRange, setTimeRange] = useState<TimeRange>("fixture");
  const [sortKey, setSortKey] = useState<SortKey>("started");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showTraceColumn, setShowTraceColumn] = useState(true);
  const [selectedTraceId, setSelectedTraceId] = useState(
    sampleRuns[0].trace.traceId,
  );
  const [selectedSpanId, setSelectedSpanId] = useState<string>();
  const [compareRuns, setCompareRuns] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedViewName, setSavedViewName] = useState("");
  const savedViewsSnapshot = useSyncExternalStore(
    subscribeToSavedViews,
    readSavedViewsSnapshot,
    readServerSavedViewsSnapshot,
  );
  const savedViews = useMemo(
    () => parseSavedViews(savedViewsSnapshot),
    [savedViewsSnapshot],
  );

  const rootRows = useMemo<RootRow[]>(
    () =>
      [...sampleRuns]
        .sort(
          (left, right) =>
            new Date(right.trace.startedAt).getTime() -
            new Date(left.trace.startedAt).getTime(),
        )
        .map((trace) => ({ key: trace.trace.traceId, trace })),
    [],
  );
  const newestSampleTimestamp = new Date(
    rootRows[0]?.trace.trace.startedAt ?? 0,
  ).getTime();

  const rows = useMemo(() => {
    const source =
      scope === "traces"
        ? rootRows
        : rootRows.flatMap((root) =>
            root.trace.spans.map((span) => ({
              key: `${root.key}:${span.spanId}`,
              trace: root.trace,
              span,
            })),
          );
    const filtered = source.filter(
      (row) =>
        queryMatches(row, submittedQuery) &&
        matchesFacet(row, facet) &&
        matchesQuickView(row, quickView) &&
        matchesTimeRange(row, timeRange, newestSampleTimestamp),
    );
    const sortValue = (row: RootRow) => {
      if (sortKey === "started") return new Date(row.trace.trace.startedAt).getTime();
      if (sortKey === "duration") return duration(row);
      if (sortKey === "name") return row.span?.kind ?? "request";
      return rowStatus(row);
    };
    return filtered.sort((left, right) => {
      const leftValue = sortValue(left);
      const rightValue = sortValue(right);
      if (leftValue === null || leftValue === undefined) return 1;
      if (rightValue === null || rightValue === undefined) return -1;
      const compared =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));
      return compared * (sortDirection === "asc" ? 1 : -1);
    });
  }, [
    facet,
    newestSampleTimestamp,
    quickView,
    rootRows,
    scope,
    sortDirection,
    sortKey,
    submittedQuery,
    timeRange,
  ]);

  const facetCounts = useMemo(
    () => {
      const source =
        scope === "traces"
          ? rootRows
          : rootRows.flatMap((root) =>
              root.trace.spans.map((span) => ({
                key: `${root.key}:${span.spanId}`,
                trace: root.trace,
                span,
              })),
            );
      const matchingTraceIds = new Set(
        source
          .filter(
            (row) =>
              queryMatches(row, submittedQuery) &&
              matchesQuickView(row, quickView) &&
              matchesTimeRange(row, timeRange, newestSampleTimestamp),
          )
          .map((row) => row.trace.trace.traceId),
      );
      const matchingRuns = rootRows.filter((row) =>
        matchingTraceIds.has(row.trace.trace.traceId),
      );
      return {
        all: matchingRuns.length,
        answered: matchingRuns.filter(
          (row) => rootStatus(row.trace) === "answered",
        ).length,
        no_answer: matchingRuns.filter(
          (row) => rootStatus(row.trace) === "no_answer",
        ).length,
        capture_gap: matchingRuns.filter(
          (row) => row.trace.trace.captureState !== "recorded",
        ).length,
      };
    },
    [
      newestSampleTimestamp,
      quickView,
      rootRows,
      scope,
      submittedQuery,
      timeRange,
    ],
  );
  const selectedObservation = rows.find(
    (row) =>
      row.key ===
      (selectedSpanId
        ? `${selectedTraceId}:${selectedSpanId}`
        : selectedTraceId),
  ) ?? rows[0];
  const selectedTrace = selectedObservation?.trace;
  const selectedDuration = selectedObservation
    ? duration(selectedObservation)
    : selectedTrace?.trace.durationMs;

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  }

  function chooseRow(row: RootRow) {
    setSelectedTraceId(row.trace.trace.traceId);
    setSelectedSpanId(row.span?.spanId);
    if (scope === "observations") setScope("observations");
  }

  function chooseSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(
      nextKey === "started" || nextKey === "duration" ? "desc" : "asc",
    );
  }

  function saveCurrentView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = savedViewName.trim();
    if (!name) return;
    persistSavedViews([
      ...savedViews,
      {
        id: Date.now().toString(36),
        name,
        query: submittedQuery,
        scope,
        quickView,
        facet,
        display,
        timeRange,
        sortKey,
        sortDirection,
      },
    ]);
    setSavedViewName("");
    setShowSaveForm(false);
  }

  function applySavedView(view: SavedView) {
    setQuery(view.query);
    setSubmittedQuery(view.query);
    setScope(view.scope);
    setQuickView(view.quickView);
    setFacet(view.facet);
    setDisplay(view.display);
    setTimeRange(view.timeRange);
    setSortKey(view.sortKey);
    setSortDirection(view.sortDirection);
  }

  function openFullTrace() {
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function elapsed(value: number | null | undefined) {
    if (value == null) return t("notRecorded");
    return format.number(value >= 1000 ? value / 1000 : value, {
      style: "unit",
      unit: value >= 1000 ? "second" : "millisecond",
      unitDisplay: "short",
      maximumFractionDigits: value >= 1000 ? 2 : 0,
    });
  }

  const statusFacets: StatusFacet[] = ["all", "answered", "no_answer", "capture_gap"];
  const quickViews: QuickView[] = ["all", "no_answer", "capture_gap", "slow"];
  const rootScopeRows = rows.filter((row) => !row.span);
  const comparisonRows = [...rootScopeRows].sort(
    (left, right) =>
      new Date(right.trace.trace.startedAt).getTime() -
      new Date(left.trace.trace.startedAt).getTime(),
  );
  const compareAvailable = scope === "traces" && comparisonRows.length > 1;

  return (
    <main className={styles.explorer} aria-labelledby="rag-observations-title">
      <header className={styles.masthead}>
        <div className={styles.titleBlock}>
          <div className={styles.eyebrow}>
            <Activity size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{t("observations.kicker")}</span>
            <span className={styles.eyebrowDivider} aria-hidden="true" />
            <span>{t("observations.project")}</span>
          </div>
          <h1 id="rag-observations-title">{t("observations.title")}</h1>
          <p>{t("observations.subtitle")}</p>
        </div>
        <div className={styles.previewSeal}>
          <span className={styles.previewDot} aria-hidden="true" />
          <div>
            <strong>{t("observations.sample")}</strong>
            <span>{t("observations.sampleRange")}</span>
          </div>
        </div>
      </header>

      <section className={styles.queryPanel} aria-label={t("observations.queryTitle")}>
        <form className={styles.queryForm} onSubmit={submitQuery}>
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
          <label className={styles.srOnly} htmlFor="rag-observations-query">
            {t("observations.queryLabel")}
          </label>
          <input
            id="rag-observations-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("observations.queryPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>↵</kbd>
          <button type="submit">{t("observations.runQuery")}</button>
        </form>
        <div className={styles.queryHint}>
          <span>{t("observations.queryHint")}</span>
          <span className={styles.queryExamples}>
            <code>status:no_answer</code>
            <code>name:retrieval</code>
            <code>latency:&gt;500</code>
          </span>
        </div>
      </section>

      {submittedQuery.trim() && (
        <div className={styles.queryChips} aria-label={t("observations.appliedFilters")}>
          <span>{t("observations.appliedFilters")}</span>
          {submittedQuery.split(/\s+/).filter(Boolean).map((term, index, terms) => (
            <button
              type="button"
              key={`${term}-${index}`}
              aria-label={t("observations.removeFilter", { filter: term })}
              onClick={() => {
                const remaining = terms.filter((_, termIndex) => termIndex !== index).join(" ");
                setQuery(remaining);
                setSubmittedQuery(remaining);
              }}
            >
              <code>{term}</code><X size={11} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <section className={styles.explorerBody} aria-label={t("observations.explorerLabel")}>
        <div className={styles.toolbar}>
          <nav className={styles.quickViews} aria-label={t("observations.savedViews")}>
            {quickViews.map((view) => (
              <button
                key={view}
                type="button"
                data-active={quickView === view}
                aria-pressed={quickView === view}
                onClick={() => setQuickView(view)}
              >
                {t(`observations.quickViews.${view}`)}
                {view === "all" && <span>{facetCounts.all}</span>}
              </button>
            ))}
            {savedViews.length > 0 && <span className={styles.savedViewDivider} aria-hidden="true" />}
            {savedViews.map((view) => (
              <span className={styles.savedViewChip} key={view.id}>
                <button type="button" onClick={() => applySavedView(view)}>
                  {view.name}
                </button>
                <button
                  type="button"
                  aria-label={t("observations.removeSavedView", { name: view.name })}
                  onClick={() => persistSavedViews(savedViews.filter((saved) => saved.id !== view.id))}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
            <button
              className={styles.saveViewButton}
              type="button"
              aria-expanded={showSaveForm}
              aria-controls="rag-trace-save-view"
              onClick={() => setShowSaveForm((open) => !open)}
            >
              <BookmarkPlus size={13} aria-hidden="true" />
              {t("observations.saveView")}
            </button>
          </nav>
          <div className={styles.scopeSwitch} role="group" aria-label={t("observations.scope")}>
            <button
              type="button"
              data-active={scope === "traces"}
              aria-pressed={scope === "traces"}
              onClick={() => {
                setScope("traces");
                setSelectedSpanId(undefined);
              }}
            >
              <Columns3 size={14} aria-hidden="true" />
              {t("observations.rootOnly")}
            </button>
            <button
              type="button"
              data-active={scope === "observations"}
              aria-pressed={scope === "observations"}
              onClick={() => setScope("observations")}
            >
              <Workflow size={14} aria-hidden="true" />
              {t("observations.allSteps")}
            </button>
          </div>
        </div>

        {showSaveForm && (
          <form className={styles.savedViewForm} id="rag-trace-save-view" onSubmit={saveCurrentView}>
            <label htmlFor="rag-trace-view-name">{t("observations.viewName")}</label>
            <input
              id="rag-trace-view-name"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              maxLength={40}
              autoFocus
              required
            />
            <button type="submit" disabled={!savedViewName.trim()}>{t("observations.save")}</button>
            <button type="button" onClick={() => setShowSaveForm(false)}>{t("observations.cancel")}</button>
            <small>{t("observations.savedLocally")}</small>
          </form>
        )}

        <div className={styles.facetsAndDisplay}>
          <div className={styles.facets} aria-label={t("observations.statusFacets")}>
            <span className={styles.facetLabel}>
              <Filter size={13} aria-hidden="true" /> {t("observations.status")}
            </span>
            {statusFacets.map((item) => (
              <button
                key={item}
                type="button"
                data-active={facet === item}
                aria-pressed={facet === item}
                onClick={() => setFacet(item)}
              >
                {t(`observations.facets.${item}`)}
                <span>{facetCounts[item]}</span>
              </button>
            ))}
          </div>
          <div className={styles.displaySwitch} role="group" aria-label={t("observations.display")}>
            <button
              type="button"
              data-active={display === "table"}
              aria-pressed={display === "table"}
              onClick={() => setDisplay("table")}
              aria-label={t("observations.table")}
            >
              <Columns3 size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              data-active={display === "chart"}
              aria-pressed={display === "chart"}
              onClick={() => setDisplay("chart")}
              aria-label={t("observations.chart")}
            >
              <BarChart3 size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.resultCaption}>
          <div>
            <span className={styles.resultGlyph} aria-hidden="true">
              <Database size={14} />
            </span>
            <strong>{format.number(rows.length)}</strong>
            <span>{t("observations.resultCount", { count: rows.length })}</span>
            <span className={styles.resultSeparator} aria-hidden="true" />
            <span>{t("observations.fixtureOnly")}</span>
          </div>
          <label className={styles.timeControl}>
            <Clock3 size={13} aria-hidden="true" />
            <span>{t("observations.timeRange.label")}</span>
            <select
              aria-label={t("observations.timeRange.label")}
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRange)}
            >
              <option value="fixture">{t("observations.timeRange.fixture")}</option>
              <option value="1h">{t("observations.timeRange.1h")}</option>
              <option value="5m">{t("observations.timeRange.5m")}</option>
            </select>
          </label>
          {display === "table" && (
            <label className={styles.columnToggle}>
              <input
                type="checkbox"
                checked={showTraceColumn}
                onChange={(event) => setShowTraceColumn(event.target.checked)}
              />
              <span>{t("observations.columns.trace")}</span>
            </label>
          )}
        </div>

        {rows.length > 0 ? (
          <div className={styles.resultsLayout}>
            <div className={styles.resultsPanel}>
              {display === "table" ? (
                <div className={styles.tableScroll}>
                  <table
                    className={styles.observationTable}
                    aria-label={t("observations.table")}
                  >
                    <thead>
                      <tr>
                        <th scope="col" aria-sort={sortKey === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <button className={styles.sortHeader} type="button" onClick={() => chooseSort("name")}>
                            {t("observations.columns.name")}<span aria-hidden="true">{sortKey === "name" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                          </button>
                        </th>
                        <th scope="col" aria-sort={sortKey === "started" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <button className={styles.sortHeader} type="button" onClick={() => chooseSort("started")}>
                            {t("observations.columns.started")}<span aria-hidden="true">{sortKey === "started" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                          </button>
                        </th>
                        <th scope="col" aria-sort={sortKey === "duration" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <button className={styles.sortHeader} type="button" onClick={() => chooseSort("duration")}>
                            {t("observations.columns.latency")}<span aria-hidden="true">{sortKey === "duration" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                          </button>
                        </th>
                        <th scope="col" aria-sort={sortKey === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                          <button className={styles.sortHeader} type="button" onClick={() => chooseSort("status")}>
                            {t("observations.columns.status")}<span aria-hidden="true">{sortKey === "status" ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                          </button>
                        </th>
                        {showTraceColumn && <th scope="col">{t("observations.columns.trace")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const selected = row.key === selectedObservation?.key;
                        const status = rowStatus(row);
                        return (
                          <tr key={row.key} data-selected={selected}>
                            <td>
                              <button
                                type="button"
                                className={styles.rowSelect}
                                aria-pressed={selected}
                                onClick={() => chooseRow(row)}
                              >
                                <span className={styles.kindIcon} data-kind={row.span?.kind ?? "request"} aria-hidden="true">
                                  {row.span ? <Workflow size={14} /> : <Activity size={14} />}
                                </span>
                                <span className={styles.rowName}>
                                  <strong>{row.span ? t(`span.${row.span.kind}`) : t("observations.rootName")}</strong>
                                  <small>{row.span?.spanId ?? row.trace.trace.requestId}</small>
                                </span>
                                {row.span && <span className={styles.childMarker}><ArrowDownRight size={12} aria-hidden="true" /></span>}
                              </button>
                            </td>
                            <td>
                              <span className={styles.startTime}>
                                {format.dateTime(new Date(row.trace.trace.startedAt), {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                              <small className={styles.startDate}>
                                {format.dateTime(new Date(row.trace.trace.startedAt), { month: "short", day: "2-digit" })}
                              </small>
                            </td>
                            <td className={styles.latencyCell}>{elapsed(duration(row))}</td>
                            <td>
                              <span className={styles.status} data-status={status}>
                                <span aria-hidden="true" />
                                {t(`status.${status}`)}
                              </span>
                            </td>
                            {showTraceColumn && <td>
                              <code className={styles.traceCode}>{row.trace.trace.traceId}</code>
                            </td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.chart} role="img" aria-label={t("observations.chartDescription", { count: rows.length })}>
                  <div className={styles.chartScale} aria-hidden="true">
                    <span>{t("observations.latencyAxis")}</span>
                    <span>{elapsed(Math.max(...rows.map((row) => duration(row) ?? 0)))}</span>
                  </div>
                  <ol>
                    {rows.map((row) => {
                      const ms = duration(row) ?? 0;
                      const max = Math.max(...rows.map((candidate) => duration(candidate) ?? 0), 1);
                      return (
                        <li key={row.key}>
                          <button type="button" onClick={() => chooseRow(row)}>
                            <span className={styles.chartLabel}>
                              <strong>{row.span ? t(`span.${row.span.kind}`) : row.trace.trace.runId}</strong>
                              <small>{row.trace.trace.traceId}</small>
                            </span>
                            <span className={styles.chartTrack}>
                              <span className={styles.chartBar} style={{ inlineSize: `${Math.max(2, (ms / max) * 100)}%` }} />
                            </span>
                            <span className={styles.chartValue}>{elapsed(ms)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                  <p>{t("observations.chartFooter")}</p>
                </div>
              )}
              {compareAvailable && (
                <div className={styles.tableFooter}>
                  <span>{t("observations.sortedNewest")}</span>
                  <button
                    type="button"
                    aria-expanded={compareRuns}
                    aria-controls="rag-run-comparison"
                    onClick={() => setCompareRuns((open) => !open)}
                  >
                    <ArrowUpRight size={13} aria-hidden="true" />
                    {compareRuns ? t("explorer.compare.hide") : t("explorer.compare.toggle")}
                  </button>
                </div>
              )}
            </div>

            <aside className={styles.peek} aria-label={t("observations.selectedObservation")}>
              {selectedTrace && selectedObservation ? (
                <>
                  <div className={styles.peekTopline}>
                    <span>{t("observations.peekLabel")}</span>
                    <span className={styles.peekStatus} data-status={rowStatus(selectedObservation)}>
                      {t(`status.${rowStatus(selectedObservation)}`)}
                    </span>
                  </div>
                  <h2>{selectedObservation.span ? t(`span.${selectedObservation.span.kind}`) : t("observations.rootName")}</h2>
                  <code className={styles.peekId}>{selectedObservation.span?.spanId ?? selectedTrace.trace.traceId}</code>
                  <div className={styles.peekStats}>
                    <div><span>{t("observations.columns.latency")}</span><strong>{elapsed(selectedDuration)}</strong></div>
                    <div><span>{t("observations.outcome")}</span><strong>{t(`status.${rootStatus(selectedTrace)}`)}</strong></div>
                    <div><span>{t("observations.evidenceUnits")}</span><strong>{format.number(new Set(selectedTrace.checkpoints.flatMap((checkpoint) => checkpoint.items.map((item) => item.unitRef))).size)}</strong></div>
                  </div>
                  <div className={styles.peekTrace}>
                    <span>{t("observations.traceId")}</span>
                    <code>{selectedTrace.trace.traceId}</code>
                  </div>
                  <div className={styles.peekCapture} data-capture={selectedTrace.trace.captureState}>
                    <span className={styles.captureMark} aria-hidden="true" />
                    <div>
                      <strong>{t(`captureState.${selectedTrace.trace.captureState}`)}</strong>
                      <p>{t("observations.captureNote")}</p>
                    </div>
                  </div>
                  <button className={styles.openTrace} type="button" onClick={openFullTrace}>
                    <Braces size={15} aria-hidden="true" />
                    {t("observations.openTrace")}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <div className={styles.emptyPeek}>
                  <span><Database size={17} aria-hidden="true" /></span>
                  <strong>{t("observations.noSelection")}</strong>
                  <p>{t("observations.selectRow")}</p>
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className={styles.emptyResults} role="status">
            <span><Search size={18} aria-hidden="true" /></span>
            <strong>{t("explorer.noMatchesTitle")}</strong>
            <p>{t("observations.emptyResults")}</p>
            <button type="button" onClick={() => { setQuery(""); setSubmittedQuery(""); setFacet("all"); setQuickView("all"); }}>
              {t("observations.clearFilters")}
            </button>
          </div>
        )}

        {compareRuns && compareAvailable && comparisonRows.length > 1 && (
          <div className={styles.comparison} id="rag-run-comparison">
            <RagTraceRunCompare latest={comparisonRows[0].trace} previous={comparisonRows[1].trace} />
          </div>
        )}
      </section>

      <footer className={styles.provenance}>
        <span className={styles.provenanceIcon}><Database size={13} aria-hidden="true" /></span>
        <p>{t("observations.provenance")}</p>
      </footer>

      {rows.length > 0 && selectedTrace && (
        <div ref={detailRef} className={styles.traceDetail}>
          <RagTraceDetailView detail={selectedTrace} initialSpanId={selectedObservation?.span?.spanId} />
        </div>
      )}
    </main>
  );
}
