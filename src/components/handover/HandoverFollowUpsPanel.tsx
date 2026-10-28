"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import type {
  FollowUpDto,
  HandoverCapability,
} from "@/lib/queries/handovers/handover.types";
import { formatFollowUpEtag } from "@/lib/queries/handovers/handover.service";
import {
  useHandoverFollowUpsQuery,
  useResolveHandoverFollowUpMutation,
} from "@/lib/queries/handovers/useHandovers";
import {
  extractHandoverErrorMessage,
  formatUtcDate,
  formatUtcDateTime,
  resolveMemberName,
} from "./handover-ui.utils";

export default function HandoverFollowUpsPanel({
  projectId,
  handoverId,
  capabilities,
  currentUserId,
  membersById,
}: {
  projectId: string;
  handoverId: string;
  capabilities: readonly HandoverCapability[];
  currentUserId: string;
  membersById: ReadonlyMap<string, ProjectMembership>;
}) {
  const t = useTranslations("handover.followUps");
  const followUpsQuery = useHandoverFollowUpsQuery(projectId, handoverId);
  const resolveMutation = useResolveHandoverFollowUpMutation(
    projectId,
    handoverId,
  );

  const [resolvingTarget, setResolvingTarget] = useState<FollowUpDto | null>(
    null,
  );
  const [resolutionNote, setResolutionNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const canResolveFollowUp = (fu: FollowUpDto) =>
    fu.status === "OPEN" &&
    (capabilities.includes("FOLLOW_UP") ||
      capabilities.includes("MANAGE") ||
      fu.ownerUserId === currentUserId);

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTarget) return;
    setLocalError(null);
    if (!resolutionNote.trim()) {
      setLocalError("Enter a resolution summary note.");
      return;
    }

    try {
      await resolveMutation.mutateAsync({
        followupId: resolvingTarget.id,
        followupEtag: formatFollowUpEtag(
          resolvingTarget.id,
          resolvingTarget.version,
        ),
        input: {
          resolutionNote: resolutionNote.trim(),
          references: [],
        },
      });
      setResolvingTarget(null);
      setResolutionNote("");
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not resolve follow-up."),
      );
    }
  };

  const items = followUpsQuery.data?.data ?? [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {t("title")}
      </h2>
      <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {followUpsQuery.isPending ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((fu) => (
            <article
              key={fu.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-800/40"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    color={fu.status === "RESOLVED" ? "success" : "warning"}
                    size="sm"
                  >
                    {fu.status === "RESOLVED"
                      ? t("statusResolved")
                      : t("statusOpen")}
                  </Badge>
                  <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    v{fu.version} · {t("duePrefix")} {formatUtcDate(fu.dueAt)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                  {fu.reason}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {t("ownerPrefix")}{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {resolveMemberName(fu.ownerUserId, membersById, "—")}
                  </span>
                  {fu.resolvedAt
                    ? ` · Resolved ${formatUtcDateTime(fu.resolvedAt)}`
                    : ""}
                </p>
              </div>

              {canResolveFollowUp(fu) && (
                <div className="shrink-0">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setLocalError(null);
                      setResolutionNote("");
                      setResolvingTarget(fu);
                    }}
                  >
                    {t("resolveCta")}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(resolvingTarget)}
        onClose={() => setResolvingTarget(null)}
        className="max-w-lg p-6 sm:p-8"
      >
        <div className="pe-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("resolveModalTitle")}
          </h3>
        </div>
        <form onSubmit={handleConfirmResolve} className="mt-5 space-y-4">
          {localError && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              {localError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("resolutionNoteLabel")} *
            </label>
            <textarea
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder={t("resolutionNotePlaceholder")}
              className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolvingTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={resolveMutation.isPending}
            >
              {t("confirmResolveCta")}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

