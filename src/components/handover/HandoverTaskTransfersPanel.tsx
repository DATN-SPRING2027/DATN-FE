"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { AlertIcon, TaskIcon } from "@/icons";
import { fetchProjectTasks, taskKeys } from "@/lib/queries/tasks/useTasks";
import type {
  HandoverCapability,
  HandoverSummaryDto,
} from "@/lib/queries/handovers/handover.types";
import {
  useHandoverTransfersQuery,
  useReconcileHandoverTaskTransferMutation,
  useStartHandoverTaskTransferMutation,
} from "@/lib/queries/handovers/useHandovers";
import {
  extractHandoverErrorMessage,
  formatShortId,
  transferBadgeColor,
} from "./handover-ui.utils";

export default function HandoverTaskTransfersPanel({
  projectId,
  handover,
  etag,
  capabilities,
}: {
  projectId: string;
  handover: HandoverSummaryDto;
  etag: string;
  capabilities: readonly HandoverCapability[];
}) {
  const t = useTranslations("handover.transfers");
  const canTransfer =
    capabilities.includes("TRANSFER") &&
    handover.status === "OPEN" &&
    Boolean(handover.publishedRevisionId && handover.successorUserId);
  const canManage =
    capabilities.includes("MANAGE") && handover.status === "OPEN";

  const transfersQuery = useHandoverTransfersQuery(projectId, handover.id);
  const tasksQuery = useQuery({
    queryKey: taskKeys.projectList(projectId, { scope: "handover-transfer" }),
    queryFn: ({ signal }) => fetchProjectTasks(projectId, undefined, signal),
    retry: false,
    staleTime: 10_000,
  });

  const startTransferMutation = useStartHandoverTaskTransferMutation(
    projectId,
    handover.id,
  );
  const reconcileMutation = useReconcileHandoverTaskTransferMutation(
    projectId,
    handover.id,
  );

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const transfers = useMemo(
    () => transfersQuery.data?.data ?? [],
    [transfersQuery.data],
  );
  const projectTasks = useMemo(
    () => tasksQuery.data?.items ?? [],
    [tasksQuery.data],
  );
  const tasksById = useMemo(
    () => new Map(projectTasks.map((task) => [task.id, task])),
    [projectTasks],
  );

  const hasUnresolvedFence = useMemo(
    () =>
      transfers.some(
        (tr) =>
          tr.state === "PENDING" ||
          tr.state === "UNKNOWN" ||
          tr.tasks.some(
            (child) => child.state === "PENDING" || child.state === "UNKNOWN",
          ),
      ),
    [transfers],
  );

  const handleDispatchTransfer = async () => {
    setLocalError(null);
    if (!handover.publishedRevisionId) return;
    const payloadTasks = selectedTaskIds
      .map((id) => {
        const task = tasksById.get(id);
        return task
          ? { taskId: task.id, expectedTaskVersion: task.version }
          : null;
      })
      .filter((entry): entry is { taskId: string; expectedTaskVersion: number } =>
        Boolean(entry),
      );

    if (payloadTasks.length === 0) {
      setLocalError("Select at least one task to transfer.");
      return;
    }

    try {
      await startTransferMutation.mutateAsync({
        etag,
        input: {
          revisionId: handover.publishedRevisionId,
          assignmentVersion: handover.assignmentVersion,
          tasks: payloadTasks,
        },
      });
      setSelectedTaskIds([]);
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not dispatch task transfer."),
      );
    }
  };

  return (
    <div className="space-y-6">
      {hasUnresolvedFence && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 sm:p-5 dark:border-warning-500/30 dark:bg-warning-500/10"
        >
          <AlertIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-warning-700 dark:text-warning-300"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-warning-900 dark:text-warning-200">
              {t("fenceWarningTitle")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-warning-800 dark:text-warning-300">
              {t("fenceWarningBody")}
            </p>
          </div>
        </div>
      )}

      {localError && (
        <div
          role="alert"
          className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          {localError}
        </div>
      )}

      {/* Dispatch Batch Section */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {t("selectTasksTitle")}
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
          {t("subtitle")}
        </p>

        {!canTransfer ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
            {t("notReadyNotice")}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {projectTasks
                .filter(
                  (task) =>
                    task.status !== "CANCELLED" &&
                    task.assigneeId !== handover.successorUserId,
                )
                .map((task) => {
                  const checked = selectedTaskIds.includes(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs ${
                        checked
                          ? "border-brand-300 bg-brand-50/40 dark:border-brand-500/40 dark:bg-brand-500/10"
                          : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedTaskIds((prev) =>
                            e.target.checked
                              ? [...prev, task.id]
                              : prev.filter((id) => id !== task.id),
                          )
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                          <TaskIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                          <span className="tabular-nums">{task.key}</span>
                          <span>·</span>
                          <span className="truncate">{task.title}</span>
                        </div>
                        <p className="mt-0.5 tabular-nums text-gray-500 dark:text-gray-400">
                          {task.status} · v{task.version}
                        </p>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedTaskIds.length === 0}
                isLoading={startTransferMutation.isPending}
                onClick={() => void handleDispatchTransfer()}
              >
                {t("dispatchCta")}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Transfer Batches & Reconciliation */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {t("historyTitle")}
        </h2>

        {transfersQuery.isPending ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        ) : transfers.length === 0 ? (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {t("emptyHistory")}
          </p>
        ) : (
          <div className="mt-4 space-y-3.5">
            {transfers.map((tr) => {
              const needsReconcile =
                canManage &&
                (tr.state === "UNKNOWN" ||
                  tr.state === "PENDING" ||
                  tr.tasks.some(
                    (c) => c.state === "UNKNOWN" || c.state === "PENDING",
                  ));
              return (
                <div
                  key={tr.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                        Batch {formatShortId(tr.id)}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Epoch #{tr.assignmentVersion}
                      </span>
                      <Badge color={transferBadgeColor(tr.state)} size="sm">
                        {t(`state_${tr.state}`)}
                      </Badge>
                    </div>

                    {needsReconcile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={reconcileMutation.isPending}
                        onClick={async () => {
                          setLocalError(null);
                          try {
                            await reconcileMutation.mutateAsync({
                              transferId: tr.id,
                              etag,
                              input: { transferId: tr.id },
                            });
                          } catch (err) {
                            setLocalError(
                              extractHandoverErrorMessage(
                                err,
                                "Reconciliation failed.",
                              ),
                            );
                          }
                        }}
                      >
                        {t("reconcileCta")}
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 divide-y divide-gray-200/80 dark:divide-gray-800">
                    {tr.tasks.map((child) => {
                      const taskMeta = tasksById.get(child.taskId);
                      return (
                        <div
                          key={child.intentId}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {taskMeta
                                ? `${taskMeta.key} · ${taskMeta.title}`
                                : `Task ${formatShortId(child.taskId)}`}
                            </span>
                            <span className="ms-2 tabular-nums text-gray-500 dark:text-gray-400">
                              {t("expectedVer", {
                                version: String(child.expectedTaskVersion),
                              })}
                              {child.committedTaskVersion !== null
                                ? ` → ${t("committedVer", {
                                    version: String(child.committedTaskVersion),
                                  })}`
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {child.safeErrorCode && (
                              <span className="font-mono text-error-600 dark:text-error-400">
                                {child.safeErrorCode}
                              </span>
                            )}
                            <Badge
                              color={transferBadgeColor(child.state)}
                              size="sm"
                            >
                              {child.state}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

