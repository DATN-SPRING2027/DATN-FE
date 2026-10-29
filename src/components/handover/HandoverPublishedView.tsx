"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import {
  AlertIcon,
  CheckCircleIcon,
  DocsIcon,
  LockIcon,
} from "@/icons";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import type {
  AvailableItemDto,
  HandoverCapability,
  HandoverSummaryDto,
  RevisionProjectionDto,
} from "@/lib/queries/handovers/handover.types";
import {
  useAcceptHandoverPackageMutation,
  useAcceptOptionalHandoverGapMutation,
  useAcknowledgeHandoverItemMutation,
  useHandoverItemEvidenceQuery,
  useReviewHandoverEvidenceMutation,
  useSubmitHandoverEvidenceMutation,
} from "@/lib/queries/handovers/useHandovers";
import {
  buildSourceWorkspaceHref,
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
  formatShortId,
  formatUtcDateTime,
} from "./handover-ui.utils";

function AvailableItemCard({
  projectId,
  handover,
  revision,
  item,
  etag,
  capabilities,
  currentUserId,
  members,
}: {
  projectId: string;
  handover: HandoverSummaryDto;
  revision: RevisionProjectionDto;
  item: AvailableItemDto;
  etag: string;
  capabilities: readonly HandoverCapability[];
  currentUserId: string;
  members: readonly ProjectMembership[];
}) {
  const t = useTranslations("handover.published");
  const canReceive =
    capabilities.includes("RECEIVE") && handover.status === "OPEN";
  const canReview =
    capabilities.includes("REVIEW") && handover.status === "OPEN";
  const canManage =
    capabilities.includes("MANAGE") && handover.status === "OPEN";

  const ackMutation = useAcknowledgeHandoverItemMutation(
    projectId,
    handover.id,
  );
  const submitEvMutation = useSubmitHandoverEvidenceMutation(
    projectId,
    handover.id,
  );
  const reviewEvMutation = useReviewHandoverEvidenceMutation(
    projectId,
    handover.id,
  );
  const exceptionMutation = useAcceptOptionalHandoverGapMutation(
    projectId,
    handover.id,
  );

  const [ackNote, setAckNote] = useState("");
  const [showEvidenceList, setShowEvidenceList] = useState(
    item.evidenceRequired || item.evidenceReview !== "NOT_REQUIRED",
  );
  const [evResultText, setEvResultText] = useState("");
  const [evLinksRaw, setEvLinksRaw] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Optional Exception Modal
  const [isExcModalOpen, setIsExcModalOpen] = useState(false);
  const [excOwnerId, setExcOwnerId] = useState(currentUserId);
  const [excDueDate, setExcDueDate] = useState(() =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [excReason, setExcReason] = useState("");

  const evidenceQuery = useHandoverItemEvidenceQuery(
    projectId,
    handover.id,
    showEvidenceList ? item.itemId : null,
  );

  const handleAcknowledge = async (
    decision: "UNDERSTOOD" | "NEEDS_CLARIFICATION",
  ) => {
    setLocalError(null);
    try {
      await ackMutation.mutateAsync({
        itemId: item.itemId,
        etag,
        input: {
          revisionId: revision.id,
          contentVersion: item.contentVersion,
          assignmentVersion: handover.assignmentVersion,
          decision,
          note:
            ackNote.trim() ||
            (decision === "UNDERSTOOD"
              ? "Confirmed understanding of item and sources."
              : "Clarification requested."),
        },
      });
      setAckNote("");
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not record acknowledgement."),
      );
    }
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const links = evLinksRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const url of links) {
      if (!url.startsWith("https://")) {
        setLocalError(t("evidenceHttpsError"));
        return;
      }
    }
    if (!evResultText.trim()) {
      setLocalError("Enter a verification result summary.");
      return;
    }

    try {
      await submitEvMutation.mutateAsync({
        itemId: item.itemId,
        etag,
        input: {
          revisionId: revision.id,
          contentVersion: item.contentVersion,
          assignmentVersion: handover.assignmentVersion,
          resultText: evResultText.trim(),
          links,
        },
      });
      setEvResultText("");
      setEvLinksRaw("");
      setShowEvidenceList(true);
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not submit evidence."),
      );
    }
  };

  const handleReviewEvidence = async (
    evidenceId: string,
    outcome: "ACCEPTED" | "CHANGES_REQUESTED",
  ) => {
    setLocalError(null);
    try {
      await reviewEvMutation.mutateAsync({
        itemId: item.itemId,
        evidenceId,
        etag,
        input: {
          revisionId: revision.id,
          evidenceId,
          outcome,
          note:
            reviewNotes[evidenceId]?.trim() ||
            (outcome === "ACCEPTED"
              ? "Evidence verified."
              : "Additional proof requested."),
        },
      });
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not review evidence."),
      );
    }
  };

  const handleCreateException = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const parsedDue = new Date(`${excDueDate}T00:00:00.000Z`);
    if (
      !excOwnerId.trim() ||
      !excReason.trim() ||
      Number.isNaN(parsedDue.getTime())
    ) {
      setLocalError("Provide owner, valid due date, and reason.");
      return;
    }
    try {
      await exceptionMutation.mutateAsync({
        itemId: item.itemId,
        etag,
        input: {
          revisionId: revision.id,
          contentVersion: item.contentVersion,
          ownerUserId: excOwnerId.trim(),
          dueAt: parsedDue.toISOString(),
          reason: excReason.trim(),
        },
      });
      setIsExcModalOpen(false);
      setExcReason("");
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not create exception."),
      );
    }
  };

  return (
    <article className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      {/* Item Header & Status Badges */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={item.isRequired ? "error" : "light"} size="sm">
            {item.isRequired ? t("requiredBadge") : t("optionalBadge")}
          </Badge>
          {item.evidenceRequired && (
            <Badge color="info" size="sm">
              {t("evidenceReqBadge")}
            </Badge>
          )}
          {item.contentReview === "GAP_REMAINS" && (
            <Badge color="warning" size="sm">
              {t("gapWarningBadge")}
            </Badge>
          )}
          {item.sourceState === "CHANGED" && (
            <Badge color="warning" size="sm">
              {t("sourceDriftBadge")}
            </Badge>
          )}
          {item.optionalExceptionAccepted && (
            <Badge color="primary" size="sm">
              {t("exceptionAcceptedBadge")}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
          <Badge
            color={
              item.acknowledgement === "UNDERSTOOD"
                ? "success"
                : item.acknowledgement === "NEEDS_CLARIFICATION"
                  ? "error"
                  : "warning"
            }
            size="sm"
          >
            {t(`ackStatus_${item.acknowledgement}`)}
          </Badge>
          {item.evidenceRequired && (
            <Badge
              color={
                item.evidenceReview === "ACCEPTED"
                  ? "success"
                  : item.evidenceReview === "CHANGES_REQUESTED"
                    ? "error"
                    : "warning"
              }
              size="sm"
            >
              {t(`evStatus_${item.evidenceReview}`)}
            </Badge>
          )}
          <span className="text-gray-400">v{item.contentVersion}</span>
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
        {item.title}
      </h3>

      {item.body && (
        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-gray-700 [overflow-wrap:anywhere] dark:text-gray-300">
          {item.body}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-800/50">
        <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t("requirementHeading")}
        </h4>
        <p className="mt-1 text-sm text-gray-800 [overflow-wrap:anywhere] dark:text-gray-200">
          {item.requirement}
        </p>
      </div>

      {/* Pinned Sources & Citations */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {t("citationsHeading")}
        </h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {item.citations.map((cit, idx) => {
            const href = buildSourceWorkspaceHref(
              projectId,
              cit.source.kind,
              cit.source.id,
            );
            const label = `${cit.source.kind} ${formatShortId(cit.source.id)} (v${cit.source.version}) · ${cit.locator.kind}: ${cit.locator.value}`;
            return href ? (
              <Link
                key={`${idx}-${cit.source.id}`}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 [overflow-wrap:anywhere] dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
              >
                <DocsIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ) : (
              <span
                key={`${idx}-${cit.source.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 [overflow-wrap:anywhere] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <DocsIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </span>
            );
          })}
        </div>
      </div>

      {localError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          {localError}
        </div>
      )}

      {/* Successor (B) Acknowledgement Controls */}
      {canReceive && (
        <div className="mt-5 space-y-2.5 border-t border-gray-200 pt-4 dark:border-gray-800">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t("ackSectionHeading")}
          </h4>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={ackNote}
              onChange={(e) => setAckNote(e.target.value)}
              placeholder={t("ackNotePlaceholder")}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={ackMutation.isPending}
                onClick={() => void handleAcknowledge("UNDERSTOOD")}
              >
                {t("markUnderstoodCta")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={ackMutation.isPending}
                onClick={() => void handleAcknowledge("NEEDS_CLARIFICATION")}
              >
                {t("markClarifyCta")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Submission & Review */}
      {(item.evidenceRequired || canReceive || canReview) && (
        <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t("evidenceSectionHeading")}
            </h4>
            {!showEvidenceList && (
              <button
                type="button"
                onClick={() => setShowEvidenceList(true)}
                className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                {t("loadEvidenceCta")}
              </button>
            )}
          </div>

          {canReceive && (
            <form onSubmit={handleSubmitEvidence} className="space-y-2.5">
              <textarea
                rows={2}
                value={evResultText}
                onChange={(e) => setEvResultText(e.target.value)}
                placeholder={t("evidenceResultPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <textarea
                rows={2}
                value={evLinksRaw}
                onChange={(e) => setEvLinksRaw(e.target.value)}
                placeholder={t("evidenceLinksPlaceholder")}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  isLoading={submitEvMutation.isPending}
                >
                  {t("submitEvidenceCta")}
                </Button>
              </div>
            </form>
          )}

          {showEvidenceList && evidenceQuery.data && (
            <div className="space-y-2.5">
              {evidenceQuery.data.data.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-800/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="tabular-nums text-gray-500 dark:text-gray-400">
                      {formatUtcDateTime(ev.createdAt)} · Epoch #
                      {ev.assignmentVersion}
                    </span>
                    <Badge
                      color={
                        ev.review === "ACCEPTED"
                          ? "success"
                          : ev.review === "CHANGES_REQUESTED"
                            ? "error"
                            : "warning"
                      }
                      size="sm"
                    >
                      {ev.review}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                    {ev.resultText}
                  </p>
                  {ev.links.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {ev.links.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-brand-600 underline [overflow-wrap:anywhere] dark:text-brand-400"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {ev.reviewNote && (
                    <p className="mt-1.5 italic text-gray-600 [overflow-wrap:anywhere] dark:text-gray-300">
                      Review: {ev.reviewNote}
                    </p>
                  )}

                  {canReview && ev.review === "PENDING" && (
                    <div className="mt-2.5 flex flex-col gap-2 border-t border-gray-200 pt-2.5 sm:flex-row dark:border-gray-700">
                      <input
                        type="text"
                        value={reviewNotes[ev.id] ?? ""}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({
                            ...prev,
                            [ev.id]: e.target.value,
                          }))
                        }
                        placeholder={t("reviewNotePlaceholder")}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={reviewEvMutation.isPending}
                          onClick={() =>
                            void handleReviewEvidence(ev.id, "ACCEPTED")
                          }
                        >
                          {t("reviewApproveCta")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={reviewEvMutation.isPending}
                          onClick={() =>
                            void handleReviewEvidence(
                              ev.id,
                              "CHANGES_REQUESTED",
                            )
                          }
                        >
                          {t("reviewChangesCta")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coordinator Optional Gap Exception Trigger */}
      {canManage && !item.isRequired && !item.optionalExceptionAccepted && (
        <div className="mt-4 flex justify-end border-t border-gray-100 pt-3 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExcModalOpen(true)}
          >
            {t("optionalExceptionCta")}
          </Button>
        </div>
      )}

      <Modal
        isOpen={isExcModalOpen}
        onClose={() => setIsExcModalOpen(false)}
        className="max-w-lg p-6 sm:p-8"
      >
        <div className="pe-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("exceptionModalTitle")}
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
            {t("exceptionModalDesc")}
          </p>
        </div>
        <form onSubmit={handleCreateException} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Follow-up Owner *
            </label>
            {members.length > 0 ? (
              <select
                value={excOwnerId}
                onChange={(e) => setExcOwnerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {members
                  .filter((m) => m.status === "ACTIVE")
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {formatMemberOptionLabel(m)}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                value={excOwnerId}
                onChange={(e) => setExcOwnerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Due Date *
            </label>
            <input
              type="date"
              value={excDueDate}
              onChange={(e) => setExcDueDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Documented Exception Reason *
            </label>
            <textarea
              rows={3}
              value={excReason}
              onChange={(e) => setExcReason(e.target.value)}
              placeholder="Explain why this optional item is deferred to post-handover follow-up…"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExcModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={exceptionMutation.isPending}
            >
              {t("confirmExceptionCta")}
            </Button>
          </div>
        </form>
      </Modal>
    </article>
  );
}

export default function HandoverPublishedView({
  projectId,
  handover,
  publishedRevision,
  etag,
  capabilities,
  currentUserId,
  members,
}: {
  projectId: string;
  handover: HandoverSummaryDto;
  publishedRevision: RevisionProjectionDto | null;
  etag: string;
  capabilities: readonly HandoverCapability[];
  currentUserId: string;
  members: readonly ProjectMembership[];
}) {
  const t = useTranslations("handover.published");
  const tDetail = useTranslations("handover.detail");
  const acceptMutation = useAcceptHandoverPackageMutation(
    projectId,
    handover.id,
  );
  const [acceptBanner, setAcceptBanner] = useState(false);

  if (!publishedRevision) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300">
          <AlertIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
          {t("noPublishedTitle")}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-400">
          {t("noPublishedBody")}
        </p>
      </section>
    );
  }

  const canReceive =
    capabilities.includes("RECEIVE") && handover.status === "OPEN";

  return (
    <div className="space-y-5">
      {/* Snapshot Banner & Package Acceptance */}
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-200/80 bg-brand-50/40 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/30 dark:bg-brand-500/10">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
              {t("revisionHeader", {
                number: String(publishedRevision.number),
              })}
            </h2>
            <Badge color="primary" size="sm">
              Immutable Snapshot
            </Badge>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {t("publishedAtMeta", {
              date: formatUtcDateTime(publishedRevision.publishedAt),
            })}{" "}
            · {tDetail("packageAcceptedNote")}
          </p>
          {acceptMutation.isError && (
            <p
              role="alert"
              className="text-xs font-medium text-error-600 dark:text-error-400"
            >
              {extractHandoverErrorMessage(
                acceptMutation.error,
                "Could not accept revision package.",
              )}
            </p>
          )}
          {acceptBanner && (
            <p
              role="status"
              className="inline-flex items-center gap-1 text-xs font-medium text-success-700 dark:text-success-300"
            >
              <CheckCircleIcon className="h-3.5 w-3.5" />
              <span>Package receipt recorded for current epoch.</span>
            </p>
          )}
        </div>

        {canReceive && (
          acceptBanner ? (
            <Badge color="success" size="sm">
              {tDetail("packageAcceptedBadge")}
            </Badge>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={acceptMutation.isPending}
              onClick={async () => {
                try {
                  await acceptMutation.mutateAsync({
                    etag,
                    input: { revisionId: publishedRevision.id },
                  });
                  setAcceptBanner(true);
                } catch {
                  // Displayed above
                }
              }}
            >
              {tDetail("acceptPackageCta", {
                number: String(publishedRevision.number),
              })}
            </Button>
          )
        )}
      </div>

      {/* Checklist Items (Strict ACL Fail-Closed Rendering for UNAVAILABLE) */}
      <div className="space-y-4">
        {publishedRevision.items.map((item) => {
          if (item.access === "UNAVAILABLE") {
            return (
              <article
                key={item.itemId}
                data-testid={`unavailable-item-${item.itemId}`}
                className="flex items-start gap-3.5 rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-gray-900/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  <LockIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {t("unavailableItemTitle")}
                    </h3>
                    <span className="font-mono text-xs text-gray-400">
                      {formatShortId(item.itemId)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                    {t("unavailableItemBody")}
                  </p>
                </div>
              </article>
            );
          }

          return (
            <AvailableItemCard
              key={item.itemId}
              projectId={projectId}
              handover={handover}
              revision={publishedRevision}
              item={item}
              etag={etag}
              capabilities={capabilities}
              currentUserId={currentUserId}
              members={members}
            />
          );
        })}
      </div>
    </div>
  );
}

