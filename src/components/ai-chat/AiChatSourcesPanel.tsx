"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertIcon, CloseLineIcon, DocsIcon, RefreshIcon } from "@/icons";
import { ApiError } from "@/lib/api-client";
import { useAiChatProjectSourcesQuery } from "@/lib/queries/ai-chat/useAiChat";
import type { AiChatProjectSourceReadiness } from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";

const PAGE_SIZE = 25;

type ProjectSourcesErrorKind =
  | "AUTHENTICATION"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "LOAD";

function projectSourcesErrorKind(error: unknown): ProjectSourcesErrorKind {
  if (!(error instanceof ApiError)) return "LOAD";
  if (error.status === 401) return "AUTHENTICATION";
  if (error.status === 403) return "FORBIDDEN";
  if (error.status === 404) return "NOT_FOUND";
  return "LOAD";
}

const projectSourcesErrorTranslationKey: Record<
  ProjectSourcesErrorKind,
  {
    title:
      | "projectSourcesSignInErrorTitle"
      | "projectSourcesPermissionErrorTitle"
      | "projectSourcesNotFoundErrorTitle"
      | "projectSourcesErrorTitle";
    body:
      | "projectSourcesSignInErrorBody"
      | "projectSourcesPermissionErrorBody"
      | "projectSourcesNotFoundErrorBody"
      | "projectSourcesErrorBody";
  }
> = {
  AUTHENTICATION: {
    title: "projectSourcesSignInErrorTitle",
    body: "projectSourcesSignInErrorBody",
  },
  FORBIDDEN: {
    title: "projectSourcesPermissionErrorTitle",
    body: "projectSourcesPermissionErrorBody",
  },
  NOT_FOUND: {
    title: "projectSourcesNotFoundErrorTitle",
    body: "projectSourcesNotFoundErrorBody",
  },
  LOAD: {
    title: "projectSourcesErrorTitle",
    body: "projectSourcesErrorBody",
  },
};

type AiChatSourcesPanelProps = Readonly<{
  organizationId: string;
  projectId: string;
  projectName: string;
  onClose: () => void;
}>;

function readinessTone(status: AiChatProjectSourceReadiness): string {
  if (status === "READY") {
    return "border-success-200 bg-success-50 text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-300";
  }
  if (status === "PROCESSING") {
    return "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300";
  }
  if (status === "FAILED" || status === "REVOKED") {
    return "border-error-200 bg-error-50 text-error-700 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-300";
  }
  return "border-gray-200 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300";
}

const readinessTranslationKey: Record<
  AiChatProjectSourceReadiness,
  | "projectSourceReady"
  | "projectSourceProcessing"
  | "projectSourceNotApproved"
  | "projectSourceNotIndexed"
  | "projectSourceFailed"
  | "projectSourceRevoked"
  | "projectSourceArchived"
  | "projectSourceUnverified"
> = {
  READY: "projectSourceReady",
  PROCESSING: "projectSourceProcessing",
  NOT_APPROVED: "projectSourceNotApproved",
  NOT_INDEXED: "projectSourceNotIndexed",
  FAILED: "projectSourceFailed",
  REVOKED: "projectSourceRevoked",
  ARCHIVED: "projectSourceArchived",
  UNVERIFIED: "projectSourceUnverified",
};

const approvalTranslationKey: Record<
  string,
  | "projectApprovalDraft"
  | "projectApprovalPendingReview"
  | "projectApprovalApproved"
  | "projectApprovalChangesRequested"
  | "projectApprovalRejected"
  | "projectApprovalArchived"
> = {
  DRAFT: "projectApprovalDraft",
  PENDING_REVIEW: "projectApprovalPendingReview",
  APPROVED: "projectApprovalApproved",
  CHANGES_REQUESTED: "projectApprovalChangesRequested",
  REJECTED: "projectApprovalRejected",
  ARCHIVED: "projectApprovalArchived",
};

export default function AiChatSourcesPanel({
  organizationId,
  projectId,
  projectName,
  onClose,
}: AiChatSourcesPanelProps) {
  const t = useTranslations("AiChat");
  const [page, setPage] = useState(1);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const query = useAiChatProjectSourcesQuery(
    organizationId,
    projectId,
    page,
    PAGE_SIZE,
  );
  const queryErrorKind = query.isError
    ? projectSourcesErrorKind(query.error)
    : null;
  const hideCachedSources = queryErrorKind !== null && queryErrorKind !== "LOAD";
  const data = hideCachedSources ? undefined : query.data;
  const totalPages = data?.pagination.totalPages ?? 0;
  const verificationUnavailable =
    data?.summary.verificationStatus === "UNAVAILABLE" ||
    data?.summary.readyCount === null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || window.innerWidth >= 1280) return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      data-testid="ai-chat-sources-panel"
      className="absolute inset-0 z-40 flex justify-end xl:static xl:z-20 xl:shrink-0"
    >
      <button
        type="button"
        aria-label={t("projectSourcesClose")}
        onClick={onClose}
        className="absolute inset-0 bg-gray-950/45 backdrop-blur-[1px] xl:hidden"
      />
      <aside
        ref={panelRef}
        aria-label={t("projectSourcesTitle")}
        className="relative z-10 flex h-full w-full max-w-[28rem] flex-col border-s border-gray-200 bg-white shadow-theme-xl xl:w-[25rem] xl:max-w-none xl:shadow-none dark:border-white/10 dark:bg-gpt-sidebar"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-gray-200 px-4 py-4 sm:px-5 dark:border-white/10">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <DocsIcon aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {t("projectSourcesTitle")}
            </h2>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {projectName}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={t("projectSourcesClose")}
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 dark:border-white/8">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              {t("projectSourcesSummary", {
                ready: query.isError
                  ? "—"
                  : (data?.summary.readyCount ?? "—"),
                total: data?.summary.totalCount ?? "—",
              })}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                verificationUnavailable
                  ? "text-warning-700 dark:text-warning-300"
                  : "text-gray-500 dark:text-gray-400",
              )}
              role={verificationUnavailable || query.isError ? "status" : undefined}
            >
              {query.isError
                ? t("projectSourcesStatusUnknown")
                : verificationUnavailable
                ? t("projectSourcesUnverified")
                : t("projectSourcesReadOnlyHint")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("projectSourcesRefresh")}
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-wait disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <RefreshIcon
              aria-hidden="true"
              className={cn("size-4", query.isFetching && "animate-spin")}
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          {query.isPending && (
            <div role="status" className="space-y-2.5">
              <span className="sr-only">{t("projectSourcesLoading")}</span>
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="h-[4.5rem] animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-white/8 dark:bg-white/5"
                />
              ))}
            </div>
          )}

          {query.isError && (
            <div
              role="alert"
              className="rounded-2xl border border-error-200 bg-error-50 p-5 text-center dark:border-error-500/25 dark:bg-error-500/10"
            >
              <AlertIcon
                aria-hidden="true"
                className="mx-auto size-5 text-error-600 dark:text-error-300"
              />
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                {t(
                  projectSourcesErrorTranslationKey[
                    queryErrorKind ?? "LOAD"
                  ].title,
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                {t(
                  projectSourcesErrorTranslationKey[
                    queryErrorKind ?? "LOAD"
                  ].body,
                )}
              </p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="mt-4 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("projectSourcesRetry")}
              </button>
            </div>
          )}

          {!query.isPending && !query.isError && data?.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-white/15">
              <DocsIcon
                aria-hidden="true"
                className="mx-auto size-6 text-gray-400 dark:text-gray-500"
              />
              <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t("projectSourcesEmptyTitle")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {t("projectSourcesEmptyBody")}
              </p>
            </div>
          )}

          {data && data.data.length > 0 && (
            <ul
              className="space-y-2.5"
              aria-label={t("projectSourcesListAria")}
            >
              {data.data.map((source) => (
                <li
                  key={source.documentId}
                  className="rounded-xl border border-gray-200 bg-white px-3.5 py-3 shadow-theme-xs dark:border-white/10 dark:bg-gpt-popover"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
                      <DocsIcon aria-hidden="true" className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-5 font-semibold break-words text-gray-900 dark:text-gray-100">
                        {source.title ||
                          source.fileName ||
                          t("projectSourcesUntitled")}
                      </p>
                      {source.fileName && source.title && (
                        <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                          {source.fileName}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(source.projectCode || source.projectName) && (
                          <span
                            title={source.projectName ?? source.projectCode}
                            className="inline-flex max-w-40 truncate rounded-full border border-brand-200 bg-brand-50/80 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-200"
                          >
                            {source.projectCode ?? source.projectName}
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            readinessTone(source.readinessStatus),
                          )}
                        >
                          {t(readinessTranslationKey[source.readinessStatus])}
                        </span>
                        <span className="inline-flex rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">
                          {t("projectSourceApproval", {
                            status: t(
                              approvalTranslationKey[source.approvalStatus] ??
                                "projectApprovalOther",
                            ),
                          })}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {source.approvedVersion === null
                          ? t("projectSourceNoApprovedVersion", {
                              current: source.currentVersion,
                            })
                          : source.approvedVersion === source.currentVersion
                            ? t("projectSourceVersion", {
                                version: source.approvedVersion,
                              })
                            : t("projectSourceVersionDrift", {
                                approved: source.approvedVersion,
                                current: source.currentVersion,
                              })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && totalPages > 1 && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-white/10">
            <button
              type="button"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {t("projectSourcesPrevious")}
            </button>
            <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
              {t("projectSourcesPage", { page, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || query.isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {t("projectSourcesNext")}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
