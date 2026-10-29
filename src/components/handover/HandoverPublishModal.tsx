"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import type {
  AvailableItemDto,
  DraftItemDto,
  PublishImpact,
  PublishReviewDecision,
  RevisionProjectionDto,
} from "@/lib/queries/handovers/handover.types";
import { usePublishHandoverRevisionMutation } from "@/lib/queries/handovers/useHandovers";
import {
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
} from "./handover-ui.utils";

interface ItemReviewState {
  itemId: string;
  contentVersion: number;
  decision: PublishReviewDecision;
  impact: PublishImpact;
  reason: string;
  gapOwnerUserId: string;
  gapDueDate: string;
  gapReason: string;
}

function defaultGapDate(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function isSameDraftAsPublished(
  draft: DraftItemDto,
  pub: AvailableItemDto,
): boolean {
  return (
    draft.title.trim() === pub.title.trim() &&
    draft.body === pub.body &&
    draft.requirement.trim() === pub.requirement.trim() &&
    draft.isRequired === pub.isRequired &&
    draft.evidenceRequired === pub.evidenceRequired &&
    JSON.stringify(draft.sources) === JSON.stringify(pub.sources) &&
    JSON.stringify(draft.citations) === JSON.stringify(pub.citations)
  );
}

function buildInitialReviews(
  draftItems: readonly DraftItemDto[],
  publishedRevision: RevisionProjectionDto | null,
  defaultOwnerUserId: string,
): Record<string, ItemReviewState> {
  const pubMap = new Map<string, AvailableItemDto>();
  for (const item of publishedRevision?.items ?? []) {
    if (item.access === "AVAILABLE") {
      pubMap.set(item.itemId, item);
    }
  }

  const initial: Record<string, ItemReviewState> = {};
  for (const d of draftItems) {
    const prev = pubMap.get(d.itemId);
    const serverContentVersion =
      typeof d.contentVersion === "number" && d.contentVersion >= 1
        ? d.contentVersion
        : 1;
    const unchanged = Boolean(
      prev &&
        prev.contentVersion === serverContentVersion &&
        isSameDraftAsPublished(d, prev),
    );
    initial[d.itemId] = {
      itemId: d.itemId,
      contentVersion: serverContentVersion,
      decision: "CONTENT_APPROVED",
      impact: unchanged ? "UNCHANGED" : "CHANGED",
      reason: unchanged
        ? "Unchanged from previous snapshot."
        : "Verified source citations and readiness requirement.",
      gapOwnerUserId: defaultOwnerUserId,
      gapDueDate: defaultGapDate(),
      gapReason: "",
    };
  }
  return initial;
}

function PublishModalForm({
  onClose,
  projectId,
  handoverId,
  etag,
  draftVersion,
  draftItems,
  publishedRevision,
  defaultOwnerUserId,
  members,
  onPublished,
}: {
  onClose: () => void;
  projectId: string;
  handoverId: string;
  etag: string;
  draftVersion: number;
  draftItems: readonly DraftItemDto[];
  publishedRevision: RevisionProjectionDto | null;
  defaultOwnerUserId: string;
  members: readonly ProjectMembership[];
  onPublished: (revisionId: string | null) => void;
}) {
  const t = useTranslations("handover.publishModal");
  const publishMutation = usePublishHandoverRevisionMutation(
    projectId,
    handoverId,
  );

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "ACTIVE"),
    [members],
  );

  const [reviewNote, setReviewNote] = useState(() =>
    publishedRevision
      ? `Published Revision #${publishedRevision.number + 1} snapshot.`
      : "Initial published handover package snapshot.",
  );
  const [reviews, setReviews] = useState<Record<string, ItemReviewState>>(() =>
    buildInitialReviews(draftItems, publishedRevision, defaultOwnerUserId),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateItemReview = (
    itemId: string,
    patch: Partial<ItemReviewState>,
  ) => {
    setReviews((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!reviewNote.trim()) {
      setValidationError(t("validationMissingReviewNote"));
      return;
    }

    const itemReviews = [];
    const gapAssignments = [];

    for (const d of draftItems) {
      const state = reviews[d.itemId];
      if (!state || !state.reason.trim()) {
        setValidationError(t("validationMissingReviewNote"));
        return;
      }
      const serverContentVersion =
        typeof d.contentVersion === "number" && d.contentVersion >= 1
          ? d.contentVersion
          : Math.max(1, Math.floor(state.contentVersion));
      itemReviews.push({
        itemId: d.itemId,
        contentVersion: serverContentVersion,
        decision: state.decision,
        impact: state.impact,
        reason: state.reason.trim(),
      });

      if (state.decision === "GAP_REMAINS") {
        const parsedDue = new Date(`${state.gapDueDate}T00:00:00.000Z`);
        if (
          !state.gapOwnerUserId.trim() ||
          !state.gapReason.trim() ||
          !state.gapDueDate ||
          Number.isNaN(parsedDue.getTime())
        ) {
          setValidationError(t("validationMissingGapFields"));
          return;
        }
        gapAssignments.push({
          itemId: d.itemId,
          ownerUserId: state.gapOwnerUserId.trim(),
          dueAt: parsedDue.toISOString(),
          reason: state.gapReason.trim(),
        });
      }
    }

    try {
      const result = await publishMutation.mutateAsync({
        etag,
        input: {
          expectedDraftVersion: draftVersion,
          reviewNote: reviewNote.trim(),
          itemReviews,
          gapAssignments,
        },
      });
      onPublished(result.data.revisionId);
    } catch {
      // Displayed below
    }
  };

  const serverError = publishMutation.isError
    ? extractHandoverErrorMessage(
        publishMutation.error,
        "Could not publish handover revision.",
      )
    : null;

  return (
    <>
      <div className="pe-8">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">
          {t("title")}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {(validationError || serverError) && (
          <div
            role="alert"
            className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            {validationError ?? serverError}
          </div>
        )}

        <div>
          <label
            htmlFor="publish-review-note"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("reviewNoteLabel")} <span className="text-error-600">*</span>
          </label>
          <textarea
            id="publish-review-note"
            rows={2}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder={t("reviewNotePlaceholder")}
            className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="space-y-4">
          {draftItems.map((item, idx) => {
            const state = reviews[item.itemId];
            if (!state) return null;
            return (
              <div
                key={item.itemId}
                className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                    <span className="me-1.5 text-gray-500 tabular-nums">
                      #{idx + 1}
                    </span>
                    {item.title}
                  </h3>
                  <Badge
                    color={item.isRequired ? "warning" : "light"}
                    size="sm"
                  >
                    {item.isRequired ? "Required" : "Optional"}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("decisionLabel")}
                    </label>
                    <select
                      value={state.decision}
                      onChange={(e) =>
                        updateItemReview(item.itemId, {
                          decision: e.target.value as PublishReviewDecision,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="CONTENT_APPROVED">
                        {t("decisionApproved")}
                      </option>
                      <option value="GAP_REMAINS">{t("decisionGap")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("impactLabel")}
                    </label>
                    <select
                      value={state.impact}
                      onChange={(e) =>
                        updateItemReview(item.itemId, {
                          impact: e.target.value as PublishImpact,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="CHANGED">{t("impactChanged")}</option>
                      <option value="UNCHANGED">{t("impactUnchanged")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("contentVersionLabel")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      readOnly
                      value={state.contentVersion}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-xs text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("itemReasonLabel")}
                  </label>
                  <input
                    type="text"
                    value={state.reason}
                    onChange={(e) =>
                      updateItemReview(item.itemId, { reason: e.target.value })
                    }
                    placeholder={t("itemReasonPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                {state.decision === "GAP_REMAINS" && (
                  <div className="mt-3 space-y-3 rounded-xl border border-warning-200 bg-warning-50/60 p-3.5 dark:border-warning-500/30 dark:bg-warning-500/10">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-warning-800 dark:text-warning-300">
                          {t("gapOwnerLabel")} *
                        </label>
                        {activeMembers.length > 0 ? (
                          <select
                            value={state.gapOwnerUserId}
                            onChange={(e) =>
                              updateItemReview(item.itemId, {
                                gapOwnerUserId: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-warning-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-warning-500/40 dark:bg-gray-900 dark:text-white"
                          >
                            <option value="">Select owner…</option>
                            {activeMembers.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {formatMemberOptionLabel(m)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={state.gapOwnerUserId}
                            onChange={(e) =>
                              updateItemReview(item.itemId, {
                                gapOwnerUserId: e.target.value,
                              })
                            }
                            placeholder="24-char user ID"
                            className="mt-1 w-full rounded-xl border border-warning-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:bg-gray-900 dark:text-white"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-warning-800 dark:text-warning-300">
                          {t("gapDueLabel")} *
                        </label>
                        <input
                          type="date"
                          value={state.gapDueDate}
                          onChange={(e) =>
                            updateItemReview(item.itemId, {
                              gapDueDate: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-warning-300 bg-white px-3 py-2 text-xs text-gray-900 tabular-nums dark:border-warning-500/40 dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-warning-800 dark:text-warning-300">
                        {t("gapReasonLabel")} *
                      </label>
                      <input
                        type="text"
                        value={state.gapReason}
                        onChange={(e) =>
                          updateItemReview(item.itemId, {
                            gapReason: e.target.value,
                          })
                        }
                        placeholder={t("gapReasonPlaceholder")}
                        className="mt-1 w-full rounded-xl border border-warning-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-warning-500/40 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={publishMutation.isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={publishMutation.isPending}
          >
            {publishMutation.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </>
  );
}

export default function HandoverPublishModal({
  isOpen,
  onClose,
  projectId,
  handoverId,
  etag,
  draftVersion,
  draftItems,
  publishedRevision,
  defaultOwnerUserId,
  members,
  onPublished,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  handoverId: string;
  etag: string;
  draftVersion: number;
  draftItems: readonly DraftItemDto[];
  publishedRevision: RevisionProjectionDto | null;
  defaultOwnerUserId: string;
  members: readonly ProjectMembership[];
  onPublished: (revisionId: string | null) => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-h-[90vh] max-w-3xl overflow-y-auto p-6 sm:p-8"
    >
      {isOpen && (
        <PublishModalForm
          key={`${handoverId}:${draftVersion}`}
          onClose={onClose}
          projectId={projectId}
          handoverId={handoverId}
          etag={etag}
          draftVersion={draftVersion}
          draftItems={draftItems}
          publishedRevision={publishedRevision}
          defaultOwnerUserId={defaultOwnerUserId}
          members={members}
          onPublished={onPublished}
        />
      )}
    </Modal>
  );
}
