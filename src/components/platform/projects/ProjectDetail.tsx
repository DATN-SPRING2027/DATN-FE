"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/icons";
import styles from "./ProjectDetail.module.css";
import dialogStyles from "../ui/platformDialog.module.css";
import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";
import {
  ErrorState,
  Loading,
  QueryRefreshStatus,
  TextField,
  input,
  isReadAccessLost,
} from "../PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";

export default function ProjectDetail({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformProjectDirectory");
  const roleLabels = useTranslations("roleLabels");
  const {
    selectedId,
    setSelectedId,
    selectedProject,
    canManageProjects,
    setFormMessage,
    handleSubmit,
    changeProject,
    formMessage,
  } = model;
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, [selectedId]);
  return (
    <>
      {selectedId && (
        <dialog
          ref={dialogRef}
          aria-labelledby="project-detail-title"
          onCancel={() => setSelectedId("")}
          className={`${dialogStyles.surface} ${dialogStyles.native} ${styles.detail}`}
        >
          <section className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="project-detail-title" className="text-sm font-bold">
                Project detail
              </h2>
              <button
                type="button"
                aria-label={t("close")}
                className={styles.close}
                onClick={() => setSelectedId("")}
              >
                <CloseIcon aria-hidden="true" />
              </button>
            </div>
            {selectedProject.data !== undefined &&
              !isReadAccessLost(selectedProject.error) &&
              (selectedProject.isFetching ||
                selectedProject.isRefetchError) && (
                <div className="mb-4">
                  <QueryRefreshStatus
                    hasData
                    isFetching={selectedProject.isFetching}
                    isRefetchError={selectedProject.isRefetchError}
                    onRetry={() => void selectedProject.refetch()}
                  />
                </div>
              )}
            {selectedProject.isPending && !selectedProject.data ? (
              <Loading columns={3} />
            ) : selectedProject.isError &&
              (!selectedProject.data ||
                isReadAccessLost(selectedProject.error)) ? (
              <ErrorState retry={() => void selectedProject.refetch()} />
            ) : (
              <>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Project"
                    value={selectedProject.data.name}
                  />
                  <TextField
                    label="Organization"
                    value={`${selectedProject.data.organization.name} · ${selectedProject.data.organization.slug}`}
                  />
                  <TextField
                    label="Visibility"
                    value={selectedProject.data.visibility}
                  />
                  <TextField
                    label="Status and members"
                    value={`${selectedProject.data.status} · ${selectedProject.data.memberCount}`}
                  />
                </dl>
                <div className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  <p>{roleLabels("teamLeaders")}:</p>
                  {selectedProject.data.leaders.length ? (
                    <ul className="mt-1 space-y-1">
                      {selectedProject.data.leaders.map((leader) => (
                        <li key={leader.id} className="break-words">
                          {leader.fullName} ({leader.email})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1">None</p>
                  )}
                  {selectedProject.data.leadersTruncated && (
                    <p className="mt-1">list truncated</p>
                  )}
                </div>
                {canManageProjects && (
                  <form
                    className="mt-5 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"
                    onSubmit={(e) => {
                      const visibility = (
                        e.currentTarget.elements.namedItem(
                          "visibility",
                        ) as HTMLSelectElement
                      ).value as "PUBLIC" | "PRIVATE";
                      if (visibility === selectedProject.data!.visibility) {
                        e.preventDefault();
                        setFormMessage("No project metadata changes to save.");
                        return;
                      }
                      if (
                        !window.confirm(
                          `Change project visibility to ${visibility}?`,
                        )
                      ) {
                        e.preventDefault();
                        return;
                      }
                      void handleSubmit(e, () =>
                        changeProject.mutateAsync({
                          projectId: selectedProject.data!.id,
                          visibility,
                          expectedUpdatedAt: selectedProject.data!.updatedAt,
                          reasonCode: "ACCESS_REVIEW",
                        }),
                      );
                    }}
                  >
                    <label className="grid gap-1 text-xs">
                      Visibility
                      <select
                        name="visibility"
                        defaultValue={selectedProject.data.visibility}
                        className={input}
                      >
                        <option value="PRIVATE">Private</option>
                        <option value="PUBLIC">Public</option>
                      </select>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={changeProject.isPending}
                    >
                      Save metadata
                    </Button>
                  </form>
                )}
                {formMessage && (
                  <p className="mt-3 text-xs" role="status">
                    {formMessage}
                  </p>
                )}
              </>
            )}
          </section>
        </dialog>
      )}
    </>
  );
}
