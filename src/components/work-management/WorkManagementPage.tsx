"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import {
  useArchiveWorkItemMutation,
  useCreateWorkItemMutation,
  useUpdateWorkItemMutation,
  useWorkItemsQuery,
} from "@/lib/queries/work-management/useWorkManagement";
import type {
  CreateWorkItemInput,
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
} from "@/lib/queries/work-management/work-management.types";
import { useClientStateStore } from "@/stores/client-state";
import WorkError from "./WorkError";
import CreateWorkItemForm from "./CreateWorkItemForm";
import WorkItemFilters from "./WorkItemFilters";
import WorkItemCard from "./WorkItemCard";
import WorkItemDetails from "./WorkItemDetails";
import WorkItemsPagination from "./WorkItemsPagination";
import WorkProjectSelector from "./WorkProjectSelector";
import {
  isAuthUnavailable,
  isResourceId,
} from "./work-management-ui";

const pageSize = 20;

export default function WorkManagementPage() {
  const t = useTranslations("workManagement");
  const locale = useLocale();
  const activeProjectId = useClientStateStore((state) => state.activeProjectId);
  const setActiveProjectId = useClientStateStore(
    (state) => state.setActiveProjectId,
  );
  const [projectDraft, setProjectDraft] = useState(activeProjectId ?? "");
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | "ALL">(
    "ALL",
  );
  const [priorityFilter, setPriorityFilter] = useState<
    WorkItemPriority | "ALL"
  >("ALL");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const projectId =
    activeProjectId && isResourceId(activeProjectId) ? activeProjectId : null;
  const listQuery = useWorkItemsQuery(projectId, {
    page,
    pageSize,
    ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
    ...(priorityFilter === "ALL" ? {} : { priority: priorityFilter }),
    includeArchived,
  });
  const createMutation = useCreateWorkItemMutation(projectId, {
    onSuccess: () => {
      setNotice(t("createdSuccessfully"));
      setShowCreateForm(false);
      setPage(1);
    },
  });
  const updateMutation = useUpdateWorkItemMutation(projectId);
  const archiveMutation = useArchiveWorkItemMutation(projectId, {
    onSuccess: () => {
      setNotice(null);
      setSelectedWorkItemId(null);
      if (listQuery.data?.data.length === 1) {
        setPage((current) => Math.max(1, current - 1));
      }
    },
  });

  const selectedWorkItem =
    listQuery.data?.data.find((item) => item.id === selectedWorkItemId) ?? null;
  const totalPages = Math.max(1, listQuery.data?.pagination.totalPages ?? 1);

  function selectProject(normalizedId: string) {
    setActiveProjectId(normalizedId);
    setPage(1);
    setSelectedWorkItemId(null);
    setNotice(null);
  }

  function createWorkItem(input: CreateWorkItemInput) {
    createMutation.mutate(input);
  }

  function archiveWorkItem(item: WorkItem) {
    if (!window.confirm(t("archiveConfirm"))) return;
    archiveMutation.mutate({ workItemId: item.id });
  }

  const mutationError =
    createMutation.error ?? updateMutation.error ?? archiveMutation.error;

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={t("title")} />

      <WorkProjectSelector
        activeProjectId={activeProjectId}
        projectDraft={projectDraft}
        canCreate={Boolean(projectId)}
        showCreateForm={showCreateForm}
        onProjectDraftChange={setProjectDraft}
        onToggleCreateForm={() => setShowCreateForm((value) => !value)}
        onSelectProject={selectProject}
        onClearProject={() => {
          setActiveProjectId(null);
          setPage(1);
          setProjectDraft("");
          setSelectedWorkItemId(null);
        }}
      />

      {projectId ? (
        <>
          <WorkItemFilters
            status={statusFilter}
            priority={priorityFilter}
            includeArchived={includeArchived}
            onStatusChange={(status) => {
              setPage(1);
              setStatusFilter(status);
            }}
            onPriorityChange={(priority) => {
              setPage(1);
              setPriorityFilter(priority);
            }}
            onIncludeArchivedChange={(checked) => {
              setPage(1);
              setIncludeArchived(checked);
            }}
          />

          {showCreateForm && (
            <CreateWorkItemForm
              isPending={createMutation.isPending}
              onCancel={() => setShowCreateForm(false)}
              onCreate={createWorkItem}
            />
          )}

          {notice && (
            <p
              className="rounded-lg border border-success-500/30 bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-500/10 dark:text-success-400"
              role="status"
            >
              {notice}
            </p>
          )}

          {mutationError && (
            <WorkError
              title={
                isAuthUnavailable(mutationError)
                  ? t("authPendingTitle")
                  : undefined
              }
              message={
                isAuthUnavailable(mutationError)
                  ? t("authPending")
                  : t("requestFailed")
              }
            />
          )}

          <section className="space-y-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                {t("itemCount", {
                  count: listQuery.data?.pagination.totalItems ?? 0,
                })}
              </h2>
              {listQuery.isFetching && !listQuery.isPending && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t("loading")}
                </span>
              )}
            </div>

            {listQuery.isPending && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                {t("loading")}
              </div>
            )}

            {listQuery.error && (
              <WorkError
                title={
                  isAuthUnavailable(listQuery.error)
                    ? t("authPendingTitle")
                    : t("loadFailed")
                }
                message={
                  isAuthUnavailable(listQuery.error)
                    ? t("authPending")
                    : t("loadFailed")
                }
                onRetry={() => void listQuery.refetch()}
                retryLabel={t("retry")}
              />
            )}

            {!listQuery.isPending &&
              !listQuery.error &&
              listQuery.data?.data.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900">
                  <h3 className="font-semibold text-gray-900 dark:text-white/90">
                    {t("noItems")}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("noItemsHint")}
                  </p>
                </div>
              )}

            <div className="grid gap-4 xl:grid-cols-2">
              {listQuery.data?.data.map((item) => (
                <WorkItemCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  selected={selectedWorkItemId === item.id}
                  onOpen={() =>
                    setSelectedWorkItemId((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                  onStatusChange={(status) =>
                    updateMutation.mutate({
                      workItemId: item.id,
                      input: { status },
                    })
                  }
                  onPriorityChange={(priority) =>
                    updateMutation.mutate({
                      workItemId: item.id,
                      input: { priority },
                    })
                  }
                  onArchive={() => archiveWorkItem(item)}
                />
              ))}
            </div>

            <WorkItemsPagination
              page={page}
              totalPages={totalPages}
              isFetching={listQuery.isFetching}
              onPageChange={setPage}
            />
          </section>

          {selectedWorkItem && projectId && (
            <WorkItemDetails
              item={selectedWorkItem}
              projectId={projectId}
              onClose={() => setSelectedWorkItemId(null)}
              locale={locale}
            />
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-white/90">
            {t("selectProjectPrompt")}
          </h2>
          {activeProjectId && !isResourceId(activeProjectId) && (
            <p className="mt-2 text-sm text-error-500">
              {t("invalidProjectId")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
