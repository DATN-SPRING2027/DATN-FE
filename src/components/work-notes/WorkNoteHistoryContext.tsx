"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, History, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  agentApi,
  type HistoricalContextView,
  type HistoryFactStatus,
  type HistoryRelation,
} from "@/lib/queries/work-notes/work-note-agent.api";

const MASKED = /\[\[WN_SEC:([A-Z_]+):[a-f0-9]{10,16}\]\]/g;

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function statusClass(status: HistoryFactStatus): string {
  switch (status) {
    case "CURRENT":
      return "bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30";
    case "SUPERSEDED":
      return "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700";
    case "OUTDATED":
      return "bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30";
    default:
      return "bg-error-50 text-error-700 ring-error-200 dark:bg-error-500/15 dark:text-error-300 dark:ring-error-500/30";
  }
}

/**
 * "Ghi chú cũ AI tham khảo": read-only view of masked, verified facts that the
 * Agent receives from previous notes of the same Task (plus outdated/conflict warnings).
 */
export default function WorkNoteHistoryContext({
  projectId,
  draftId,
  refreshKey = 0,
}: {
  projectId: string;
  draftId: string | null | undefined;
  refreshKey?: number;
}) {
  const t = useTranslations("workNotes.agent.historyContext");
  const [reloadTick, setReloadTick] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    scopeKey: string;
    history: HistoricalContextView | null;
    failed: boolean;
  } | null>(null);

  const loadFn = agentApi.history;
  const scopeKey = `${projectId}:${draftId ?? ""}`;
  const requestKey =
    draftId && typeof loadFn === "function"
      ? `${scopeKey}:${refreshKey}:${reloadTick}`
      : null;

  useEffect(() => {
    if (!draftId || !requestKey || typeof loadFn !== "function") return;
    const controller = new AbortController();
    Promise.resolve(loadFn(projectId, draftId, controller.signal))
      .then((response) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key: requestKey,
          scopeKey,
          history: response?.history ?? null,
          failed: false,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoaded((prev) => ({
          key: requestKey,
          scopeKey,
          history: prev?.scopeKey === scopeKey ? prev.history : null,
          failed: true,
        }));
      });
    return () => controller.abort();
  }, [projectId, draftId, requestKey, scopeKey, loadFn]);

  if (!draftId) return null;
  const isLoading = requestKey !== null && loaded?.key !== requestKey;
  const isError = loaded?.key === requestKey && loaded.failed;
  const history = loaded?.scopeKey === scopeKey ? loaded.history : null;
  const warnings = history?.facts.filter((f) => f.status !== "CURRENT") ?? [];
  const pretty = (quote: string) =>
    quote.replace(MASKED, (_m, category: string) => `🔒 ${t.has(`masked.${category}`) ? t(`masked.${category}`) : category}`);
  const relationBadge = (relation?: HistoryRelation, taskKey?: string) => {
    if (!relation || relation === "SELF") return null;
    const label = t(`relation.${relation}`);
    return taskKey ? `${label} · ${taskKey}` : label;
  };

  return (
    <section
      data-testid="worknote-history-context"
      aria-labelledby="worknote-history-title"
      className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="flex items-center justify-between gap-2">
        <h4
          id="worknote-history-title"
          className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100"
        >
          <History className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {t("title", { count: history?.notes.length ?? 0 })}
        </h4>
        <button
          type="button"
          onClick={() => setReloadTick((n) => n + 1)}
          disabled={isLoading}
          aria-label={t("reload")}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-gray-800"
        >
          <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </header>
      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{t("subtitle")}</p>

      {isError && (
        <p role="alert" className="text-[11px] text-error-600 dark:text-error-400">
          {t("loadFailed")}
        </p>
      )}
      {!isError && !history && !isLoading && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("empty")}</p>
      )}

      {history && (
        <ul className="space-y-1.5">
          {history.notes.map((note) => (
            <li
              key={note.ref}
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] dark:bg-gray-800/60"
            >
              <span className="rounded bg-brand-100 px-1.5 py-0.5 font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                {note.ref}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">
                {note.source === "CLARIFICATION_LEDGER" ? t("ledgerSource") : note.title}
              </span>
              {relationBadge(note.relation, note.taskKey) && (
                <span
                  data-testid="worknote-history-relation-badge"
                  className="shrink-0 rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700/80 dark:text-gray-200"
                >
                  {relationBadge(note.relation, note.taskKey)}
                </span>
              )}
              <span className="shrink-0 tabular-nums text-gray-500">{formatDate(note.date)}</span>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <div
          data-testid="worknote-history-warnings"
          className="space-y-1.5 rounded-lg border border-warning-200 bg-warning-50/60 p-2.5 dark:border-warning-500/30 dark:bg-warning-500/10"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-warning-800 dark:text-warning-200">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {t("warningsTitle", { count: warnings.length })}
          </p>
          <ul className="space-y-1.5">
            {warnings.slice(0, 6).map((fact) => (
              <li key={fact.id} className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
                <span
                  className={`me-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${statusClass(fact.status)}`}
                >
                  {t(`status.${fact.status}`)}
                </span>
                <span className="font-semibold">{fact.ref}</span> · {formatDate(fact.date)} — “{pretty(fact.quote)}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

