"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  BoltIcon,
  CheckCircleIcon,
  DocsIcon,
  PlusIcon,
  ShootingStarIcon,
  TaskIcon,
  TrashBinIcon,
} from "@/icons";
import { workNotesApi } from "@/lib/queries/work-notes/useWorkNotes";
import { fetchProjectTasks, taskKeys } from "@/lib/queries/tasks/useTasks";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import {
  handoverKeys,
  useGenerateHandoverDraftMutation,
  useHandoverCandidatesQuery,
  useHandoverDraftQuery,
  useHandoverJobQuery,
  useProposeHandoverSourcesMutation,
  useReplaceHandoverDraftMutation,
  useRetryHandoverJobMutation,
} from "@/lib/queries/handovers/useHandovers";
import type {
  CitationLocatorKind,
  DraftItemInputDto,
  RevisionProjectionDto,
  SourceRefDto,
  SourceRefKind,
} from "@/lib/queries/handovers/handover.types";
import HandoverPublishModal from "./HandoverPublishModal";
import {
  extractHandoverErrorMessage,
  formatShortId,
  jobBadgeColor,
} from "./handover-ui.utils";

interface EditableDraftItem extends DraftItemInputDto {
  localKey: string;
}

const LOCATOR_KINDS: readonly CitationLocatorKind[] = [
  "SECTION",
  "PAGE",
  "LINE",
  "CHUNK",
];

function sourceKey(ref: SourceRefDto): string {
  return `${ref.kind}:${ref.id}:${ref.version}`;
}

export default function HandoverDraftEditor({
  projectId,
  handoverId,
  handoverEtag,
  isOpenStatus,
  publishedRevision,
  currentUserId,
  members,
  onRevisionPublished,
}: {
  projectId: string;
  handoverId: string;
  handoverEtag: string;
  isOpenStatus: boolean;
  publishedRevision: RevisionProjectionDto | null;
  currentUserId: string;
  members: readonly ProjectMembership[];
  onRevisionPublished: () => void;
}) {
  const t = useTranslations("handover.draft");
  const queryClient = useQueryClient();

  const draftQuery = useHandoverDraftQuery(projectId, handoverId);
  const saveDraftMutation = useReplaceHandoverDraftMutation(
    projectId,
    handoverId,
  );
  const proposeMutation = useProposeHandoverSourcesMutation(
    projectId,
    handoverId,
  );
  const generateMutation = useGenerateHandoverDraftMutation(
    projectId,
    handoverId,
  );
  const retryJobMutation = useRetryHandoverJobMutation(projectId, handoverId);

  // Workspace pickers (graceful optional lookup)
  const docsQuery = useQuery({
    queryKey: ["handover-picker-docs", projectId],
    queryFn: ({ signal }) =>
      workNotesApi.listDocuments(projectId, "APPROVED", 1, signal),
    retry: false,
    staleTime: 30_000,
  });
  const notesQuery = useQuery({
    queryKey: ["handover-picker-notes", projectId],
    queryFn: ({ signal }) =>
      workNotesApi.listProjectTaskNotes(projectId, 1, signal),
    retry: false,
    staleTime: 30_000,
  });
  const tasksQuery = useQuery({
    queryKey: taskKeys.projectList(projectId, { scope: "handover-picker" }),
    queryFn: ({ signal }) => fetchProjectTasks(projectId, undefined, signal),
    retry: false,
    staleTime: 20_000,
  });

  const effectiveEtag = draftQuery.data?.etag || handoverEtag;
  const currentDraftVersion = draftQuery.data?.draft.draftVersion ?? 0;

  const serverDraftState = useMemo(() => {
    const d = draftQuery.data?.draft;
    if (!d) {
      return {
        selectedSources: [] as SourceRefDto[],
        selectedTaskIds: [] as string[],
        items: [] as EditableDraftItem[],
      };
    }
    return {
      selectedSources: d.selectedSources,
      selectedTaskIds: d.taskIds,
      items: d.items.map((item) => ({
        localKey: item.itemId,
        itemId: item.itemId,
        title: item.title,
        body: item.body,
        requirement: item.requirement,
        isRequired: item.isRequired,
        evidenceRequired: item.evidenceRequired,
        sources: item.sources,
        citations: item.citations.map((c) => ({
          source: c.source,
          locator: {
            kind: c.locator.kind,
            value: c.locator.value,
          },
        })),
      })),
    };
  }, [draftQuery.data]);

  const [draftEdits, setDraftEdits] = useState<{
    baseVersion: number;
    selectedSources: SourceRefDto[];
    selectedTaskIds: string[];
    items: EditableDraftItem[];
  } | null>(null);

  const activeEdits =
    draftEdits && draftEdits.baseVersion === currentDraftVersion
      ? draftEdits
      : null;

  const dirty = activeEdits !== null;
  const selectedSources =
    activeEdits?.selectedSources ?? serverDraftState.selectedSources;
  const selectedTaskIds =
    activeEdits?.selectedTaskIds ?? serverDraftState.selectedTaskIds;
  const items = activeEdits?.items ?? serverDraftState.items;

  const setSelectedSources = (
    updater: (prev: SourceRefDto[]) => SourceRefDto[],
  ) => {
    setDraftEdits((prev) => {
      const base =
        prev && prev.baseVersion === currentDraftVersion
          ? prev
          : { baseVersion: currentDraftVersion, ...serverDraftState };
      return {
        ...base,
        selectedSources: updater(base.selectedSources),
      };
    });
  };

  const setSelectedTaskIds = (updater: (prev: string[]) => string[]) => {
    setDraftEdits((prev) => {
      const base =
        prev && prev.baseVersion === currentDraftVersion
          ? prev
          : { baseVersion: currentDraftVersion, ...serverDraftState };
      return {
        ...base,
        selectedTaskIds: updater(base.selectedTaskIds),
      };
    });
  };

  const setItems = (
    updater: (prev: EditableDraftItem[]) => EditableDraftItem[],
  ) => {
    setDraftEdits((prev) => {
      const base =
        prev && prev.baseVersion === currentDraftVersion
          ? prev
          : { baseVersion: currentDraftVersion, ...serverDraftState };
      return {
        ...base,
        items: updater(base.items),
      };
    });
  };

  const setDirty = (nextDirty: boolean) => {
    if (!nextDirty) {
      setDraftEdits(null);
    }
  };

  // Add official source state
  const [newSourceKind, setNewSourceKind] =
    useState<SourceRefKind>("PROJECT_DOCUMENT");
  const [newSourceId, setNewSourceId] = useState("");
  const [newSourceVer, setNewSourceVer] = useState("1");

  // AI assist state
  const [proposeQuery, setProposeQuery] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  const jobQuery = useHandoverJobQuery(projectId, handoverId, activeJobId);
  const candidatesQuery = useHandoverCandidatesQuery(
    projectId,
    handoverId,
    activeJobId &&
      jobQuery.data?.kind === "SOURCE_PROPOSAL" &&
      jobQuery.data.state === "SUCCEEDED"
      ? activeJobId
      : null,
  );

  // Refresh external React Query cache when an AI GENERATION job finishes SUCCEEDED
  useEffect(() => {
    if (
      jobQuery.data?.kind === "GENERATION" &&
      jobQuery.data.state === "SUCCEEDED"
    ) {
      void queryClient.invalidateQueries({
        queryKey: handoverKeys.project(projectId),
      });
    }
  }, [jobQuery.data?.kind, jobQuery.data?.state, projectId, queryClient]);

  const pickerOptions = useMemo(() => {
    if (newSourceKind === "PROJECT_DOCUMENT") {
      return (docsQuery.data?.data ?? []).map((doc) => ({
        id: doc.id,
        version: String(doc.version ?? 1),
        label: `${doc.title} (v${doc.version ?? 1})`,
      }));
    }
    if (newSourceKind === "TASK_NOTE") {
      return (notesQuery.data?.data ?? []).map((note) => ({
        id: note.id,
        version: "1",
        label: `${note.title} — ${note.authorName}`,
      }));
    }
    return [];
  }, [newSourceKind, docsQuery.data, notesQuery.data]);

  const addOfficialSource = (ref: SourceRefDto) => {
    const clean: SourceRefDto = {
      kind: ref.kind,
      id: ref.id.trim(),
      version: ref.version.trim() || "1",
    };
    if (!clean.id) return;
    setSelectedSources((prev) => {
      if (prev.some((s) => sourceKey(s) === sourceKey(clean))) return prev;
      return [...prev, clean];
    });
    setDirty(true);
  };

  const removeOfficialSource = (target: SourceRefDto) => {
    const k = sourceKey(target);
    setSelectedSources((prev) => prev.filter((s) => sourceKey(s) !== k));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        sources: item.sources.filter((s) => sourceKey(s) !== k),
        citations: item.citations.filter((c) => sourceKey(c.source) !== k),
      })),
    );
    setDirty(true);
  };

  const handleAddChecklistItem = () => {
    const defaultSrc = selectedSources[0];
    setItems((prev) => [
      ...prev,
      {
        localKey: `new-${Date.now()}-${prev.length}`,
        itemId: null,
        title: "",
        body: "",
        requirement: "",
        isRequired: true,
        evidenceRequired: false,
        sources: defaultSrc ? [defaultSrc] : [],
        citations: defaultSrc
          ? [{ source: defaultSrc, locator: { kind: "SECTION", value: "" } }]
          : [],
      },
    ]);
    setDirty(true);
  };

  const handleSaveDraft = async () => {
    setLocalError(null);
    setStatusBanner(null);

    for (const item of items) {
      if (!item.title.trim() || !item.requirement.trim()) {
        setLocalError(
          "Every checklist item must have a non-empty title and readiness requirement.",
        );
        return;
      }
      const linkedKeys = new Set(item.sources.map(sourceKey));
      for (const cit of item.citations) {
        if (!cit.locator.value.trim() || !linkedKeys.has(sourceKey(cit.source))) {
          setLocalError(t("validationCitationLocator"));
          return;
        }
      }
      if (item.sources.length > 0) {
        const citedKeys = new Set(
          item.citations.map((cit) => sourceKey(cit.source)),
        );
        for (const srcKey of linkedKeys) {
          if (!citedKeys.has(srcKey)) {
            setLocalError(t("validationCitationLocator"));
            return;
          }
        }
      }
    }

    const payloadItems: DraftItemInputDto[] = items.map((item) => {
      const seenCitations = new Set<string>();
      const normalizedCitations = [];
      for (const cit of item.citations) {
        const cleanVal = cit.locator.value.trim();
        const dedupKey = `${sourceKey(cit.source)}:${cit.locator.kind}:${cleanVal}`;
        if (!seenCitations.has(dedupKey)) {
          seenCitations.add(dedupKey);
          normalizedCitations.push({
            source: cit.source,
            locator: {
              kind: cit.locator.kind,
              value: cleanVal,
            },
          });
        }
      }
      return {
        itemId: item.itemId,
        title: item.title.trim(),
        body: item.body,
        requirement: item.requirement.trim(),
        isRequired: item.isRequired,
        evidenceRequired: item.evidenceRequired,
        sources: item.sources,
        citations: normalizedCitations,
      };
    });

    try {
      await saveDraftMutation.mutateAsync({
        etag: effectiveEtag,
        input: {
          expectedDraftVersion: currentDraftVersion,
          selectedSources,
          taskIds: selectedTaskIds,
          items: payloadItems,
        },
      });
      setDirty(false);
      setStatusBanner(t("draftSavedSuccess"));
    } catch (err) {
      setLocalError(extractHandoverErrorMessage(err, "Could not save draft."));
    }
  };

  const handleProposeSources = async () => {
    setLocalError(null);
    const q = proposeQuery.trim();
    if (!q) {
      setLocalError("Enter a discovery topic query first.");
      return;
    }
    try {
      const res = await proposeMutation.mutateAsync({
        etag: effectiveEtag,
        input: {
          query: q,
          expectedDraftVersion: currentDraftVersion,
        },
      });
      setActiveJobId(res.data.id);
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not start source proposal."),
      );
    }
  };

  const handleGenerateDraft = async () => {
    setLocalError(null);
    if (currentDraftVersion < 1 || dirty) {
      setLocalError(
        "Save your selected official sources to the draft first before running AI draft synthesis.",
      );
      return;
    }
    try {
      const res = await generateMutation.mutateAsync({
        etag: effectiveEtag,
        input: {
          expectedDraftVersion: currentDraftVersion,
        },
      });
      setActiveJobId(res.data.id);
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not start AI draft synthesis."),
      );
    }
  };

  const handleRetryJob = async () => {
    if (!activeJobId) return;
    setLocalError(null);
    try {
      const res = await retryJobMutation.mutateAsync({
        jobId: activeJobId,
        etag: effectiveEtag,
        input: {
          expectedDraftVersion: Math.max(1, currentDraftVersion),
        },
      });
      setActiveJobId(res.data.id);
    } catch (err) {
      setLocalError(
        extractHandoverErrorMessage(err, "Could not retry AI job."),
      );
    }
  };

  if (draftQuery.isPending) {
    return (
      <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900" />
    );
  }

  if (draftQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-error-200 bg-error-50/70 p-6 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
      >
        {extractHandoverErrorMessage(
          draftQuery.error,
          "Unable to load handover draft.",
        )}
      </div>
    );
  }

  const savedDraftItems = draftQuery.data.draft.items;
  const canOpenPublish =
    isOpenStatus &&
    !dirty &&
    currentDraftVersion >= 1 &&
    savedDraftItems.length > 0 &&
    savedDraftItems.every(
      (i) => i.sources.length > 0 && i.citations.length > 0,
    );

  return (
    <div className="space-y-6">
      {!isOpenStatus && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
          {t("readOnlyNotice")}
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

      {statusBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* 1. Official Selected Sources */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("selectedSourcesTitle", {
                count: String(selectedSources.length),
              })}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("selectedSourcesHint")}
            </p>
          </div>
          <Badge color="primary" size="sm">
            Draft v{currentDraftVersion}
          </Badge>
        </div>

        {isOpenStatus && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <h3 className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300">
              {t("addSourceHeading")}
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("sourceKindLabel")}
                </label>
                <select
                  value={newSourceKind}
                  onChange={(e) => {
                    setNewSourceKind(e.target.value as SourceRefKind);
                    setNewSourceId("");
                    setNewSourceVer("1");
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="PROJECT_DOCUMENT">
                    {t("kindProjectDocument")}
                  </option>
                  <option value="WORK_REPORT">{t("kindWorkReport")}</option>
                  <option value="KNOWLEDGE_OBJECT">
                    {t("kindKnowledgeObject")}
                  </option>
                  <option value="TASK_NOTE">{t("kindTaskNote")}</option>
                </select>
              </div>

              {pickerOptions.length > 0 ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("pickExistingSource")}
                  </label>
                  <select
                    value={newSourceId}
                    onChange={(e) => {
                      const chosen = pickerOptions.find(
                        (o) => o.id === e.target.value,
                      );
                      setNewSourceId(e.target.value);
                      if (chosen) setNewSourceVer(chosen.version);
                    }}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Select record…</option>
                    {pickerOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("manualSourceIdLabel")}
                    </label>
                    <input
                      type="text"
                      value={newSourceId}
                      onChange={(e) => setNewSourceId(e.target.value)}
                      placeholder="24-char ObjectId"
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t("manualSourceVersionLabel")}
                    </label>
                    <input
                      type="text"
                      value={newSourceVer}
                      onChange={(e) => setNewSourceVer(e.target.value)}
                      placeholder="1"
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 tabular-nums dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    addOfficialSource({
                      kind: newSourceKind,
                      id: newSourceId,
                      version: newSourceVer,
                    });
                    setNewSourceId("");
                  }}
                  disabled={!newSourceId.trim()}
                >
                  {t("addSourceButton")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          {selectedSources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              {t("noSourcesSelected")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {selectedSources.map((src) => (
                <li
                  key={sourceKey(src)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-xs dark:border-gray-800 dark:bg-gray-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <DocsIcon
                      className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {src.kind}
                      </span>
                      <span className="ms-1.5 font-mono text-gray-500 dark:text-gray-400">
                        {formatShortId(src.id)} · v{src.version}
                      </span>
                    </div>
                  </div>
                  {isOpenStatus && (
                    <button
                      type="button"
                      onClick={() => removeOfficialSource(src)}
                      className="shrink-0 text-xs font-medium text-error-600 hover:underline dark:text-error-400"
                    >
                      {t("removeSource")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 2. Bounded AI Assistance */}
      {isOpenStatus && (
        <section className="rounded-2xl border border-brand-200/80 bg-brand-50/30 p-5 shadow-theme-xs sm:p-6 dark:border-brand-500/25 dark:bg-brand-500/5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              <ShootingStarIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("aiAssistTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                {t("aiAssistSubtitle")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              aria-label={t("proposeQueryLabel")}
              value={proposeQuery}
              onChange={(e) => setProposeQuery(e.target.value)}
              placeholder={t("proposeQueryPlaceholder")}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={proposeMutation.isPending}
                onClick={() => void handleProposeSources()}
              >
                {t("runProposeCta")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                startIcon={<BoltIcon className="h-3.5 w-3.5" />}
                isLoading={generateMutation.isPending}
                onClick={() => void handleGenerateDraft()}
              >
                {t("runGenerateCta")}
              </Button>
            </div>
          </div>

          {jobQuery.data && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {t("jobStateLabel", {
                    kind: jobQuery.data.kind,
                    state: jobQuery.data.state,
                  })}
                </span>
                <Badge color={jobBadgeColor(jobQuery.data.state)} size="sm">
                  {jobQuery.data.state}
                </Badge>
              </div>

              {jobQuery.data.state === "SUPERSEDED" && (
                <p className="mt-2 text-xs text-warning-700 dark:text-warning-300">
                  {t("jobSupersededHint")}
                </p>
              )}

              {jobQuery.data.state === "FAILED" && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-error-600 dark:text-error-400">
                    {t("jobFailedHint", {
                      code: jobQuery.data.safeErrorCode ?? "AI_ERROR",
                    })}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={retryJobMutation.isPending}
                    onClick={() => void handleRetryJob()}
                  >
                    {t("retryJobCta")}
                  </Button>
                </div>
              )}

              {candidatesQuery.data && candidatesQuery.data.data.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("candidatesTitle")}
                  </h3>
                  {candidatesQuery.data.data.map((cand) => {
                    const already = selectedSources.some(
                      (s) => sourceKey(s) === sourceKey(cand.source),
                    );
                    return (
                      <div
                        key={sourceKey(cand.source)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 [overflow-wrap:anywhere] dark:text-white">
                            {cand.title}
                          </p>
                          <p className="text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400">
                            {cand.source.kind} · v{cand.source.version} —{" "}
                            {cand.reason}
                          </p>
                        </div>
                        {already ? (
                          <Badge color="success" size="sm">
                            {t("alreadySelectedBadge")}
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOfficialSource(cand.source)}
                          >
                            {t("acceptCandidateCta")}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 3. Candidate Tasks Scope */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {t("tasksScopeTitle", { count: String(selectedTaskIds.length) })}
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
          {t("tasksScopeHint")}
        </p>

        <div className="mt-3">
          {(tasksQuery.data?.items ?? []).length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("noProjectTasks")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(tasksQuery.data?.items ?? []).map((task) => {
                const checked = selectedTaskIds.includes(task.id);
                return (
                  <label
                    key={task.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-colors ${
                      checked
                        ? "border-brand-300 bg-brand-50/40 dark:border-brand-500/40 dark:bg-brand-500/10"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!isOpenStatus}
                      onChange={(e) => {
                        setSelectedTaskIds((prev) =>
                          e.target.checked
                            ? [...prev, task.id]
                            : prev.filter((id) => id !== task.id),
                        );
                        setDirty(true);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                        <TaskIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                        <span className="tabular-nums">{task.key}</span>
                        <span>·</span>
                        <span className="truncate">{task.title}</span>
                      </div>
                      <p className="mt-0.5 text-gray-500 tabular-nums dark:text-gray-400">
                        {task.status} · v{task.version}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. Structured Checklist Items */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("itemsTitle", { count: String(items.length) })}
          </h2>
          {isOpenStatus && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              startIcon={<PlusIcon className="h-3.5 w-3.5" />}
              onClick={handleAddChecklistItem}
            >
              {t("addItemCta")}
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {t("emptyItems")}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {items.map((item, idx) => (
              <div
                key={item.localKey}
                className="rounded-2xl border border-gray-200 bg-gray-50/40 p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-800/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-brand-600 tabular-nums dark:text-brand-400">
                    Item #{idx + 1}
                  </span>
                  {isOpenStatus && (
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) =>
                          prev.filter((i) => i.localKey !== item.localKey),
                        );
                        setDirty(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-error-600 hover:underline dark:text-error-400"
                    >
                      <TrashBinIcon className="h-3.5 w-3.5" />
                      <span>{t("removeItemCta")}</span>
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t("itemTitleLabel")} *
                    </label>
                    <input
                      type="text"
                      disabled={!isOpenStatus}
                      value={item.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((i) =>
                            i.localKey === item.localKey
                              ? { ...i, title: val }
                              : i,
                          ),
                        );
                        setDirty(true);
                      }}
                      placeholder={t("itemTitlePlaceholder")}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t("itemBodyLabel")}
                    </label>
                    <textarea
                      rows={3}
                      disabled={!isOpenStatus}
                      value={item.body}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((i) =>
                            i.localKey === item.localKey
                              ? { ...i, body: val }
                              : i,
                          ),
                        );
                        setDirty(true);
                      }}
                      placeholder={t("itemBodyPlaceholder")}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t("itemRequirementLabel")} *
                    </label>
                    <input
                      type="text"
                      disabled={!isOpenStatus}
                      value={item.requirement}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((i) =>
                            i.localKey === item.localKey
                              ? { ...i, requirement: val }
                              : i,
                          ),
                        );
                        setDirty(true);
                      }}
                      placeholder={t("itemRequirementPlaceholder")}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-wrap gap-5 pt-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        disabled={!isOpenStatus}
                        checked={item.isRequired}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setItems((prev) =>
                            prev.map((i) =>
                              i.localKey === item.localKey
                                ? { ...i, isRequired: checked }
                                : i,
                            ),
                          );
                          setDirty(true);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                      <span>{t("isRequiredToggle")}</span>
                    </label>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        disabled={!isOpenStatus}
                        checked={item.evidenceRequired}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setItems((prev) =>
                            prev.map((i) =>
                              i.localKey === item.localKey
                                ? { ...i, evidenceRequired: checked }
                                : i,
                            ),
                          );
                          setDirty(true);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                      <span>{t("evidenceRequiredToggle")}</span>
                    </label>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t("itemSourcesLabel")}
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {selectedSources.map((src) => {
                          const k = sourceKey(src);
                          const linked = item.sources.some(
                            (s) => sourceKey(s) === k,
                          );
                          return (
                            <label
                              key={k}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                            >
                              <input
                                type="checkbox"
                                disabled={!isOpenStatus}
                                checked={linked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setItems((prev) =>
                                    prev.map((i) => {
                                      if (i.localKey !== item.localKey) {
                                        return i;
                                      }
                                      if (checked) {
                                        const hasCitForSource =
                                          i.citations.some(
                                            (c) => sourceKey(c.source) === k,
                                          );
                                        return {
                                          ...i,
                                          sources: [...i.sources, src],
                                          citations: hasCitForSource
                                            ? i.citations
                                            : [
                                                ...i.citations,
                                                {
                                                  source: src,
                                                  locator: {
                                                    kind: "SECTION",
                                                    value: "",
                                                  },
                                                },
                                              ],
                                        };
                                      }
                                      return {
                                        ...i,
                                        sources: i.sources.filter(
                                          (s) => sourceKey(s) !== k,
                                        ),
                                        citations: i.citations.filter(
                                          (c) => sourceKey(c.source) !== k,
                                        ),
                                      };
                                    }),
                                  );
                                  setDirty(true);
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                              <span className="font-mono text-gray-700 dark:text-gray-300">
                                {src.kind}:{formatShortId(src.id)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-gray-700/70 dark:bg-gray-900/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {t("citationsLabel")}
                        </span>
                        {isOpenStatus && item.sources.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const fallbackSrc = item.sources[0];
                              if (!fallbackSrc) return;
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.localKey === item.localKey
                                    ? {
                                        ...i,
                                        citations: [
                                          ...i.citations,
                                          {
                                            source: fallbackSrc,
                                            locator: {
                                              kind: "SECTION",
                                              value: "",
                                            },
                                          },
                                        ],
                                      }
                                    : i,
                                ),
                              );
                              setDirty(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            <PlusIcon className="h-3 w-3" />
                            <span>{t("addCitationCta")}</span>
                          </button>
                        )}
                      </div>

                      {item.citations.length === 0 ? (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {t("noCitationsHint")}
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {item.citations.map((cit, citIdx) => (
                            <div
                              key={`${sourceKey(cit.source)}-${citIdx}`}
                              className="grid grid-cols-1 gap-2 sm:grid-cols-12"
                            >
                              <div className="sm:col-span-5">
                                <select
                                  aria-label={t("citationSourceAria", {
                                    index: String(citIdx + 1),
                                  })}
                                  disabled={!isOpenStatus}
                                  value={sourceKey(cit.source)}
                                  onChange={(e) => {
                                    const chosen = item.sources.find(
                                      (s) => sourceKey(s) === e.target.value,
                                    );
                                    if (!chosen) return;
                                    setItems((prev) =>
                                      prev.map((i) =>
                                        i.localKey === item.localKey
                                          ? {
                                              ...i,
                                              citations: i.citations.map(
                                                (entry, entryIdx) =>
                                                  entryIdx === citIdx
                                                    ? {
                                                        ...entry,
                                                        source: chosen,
                                                      }
                                                    : entry,
                                              ),
                                            }
                                          : i,
                                      ),
                                    );
                                    setDirty(true);
                                  }}
                                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                  {item.sources.map((src) => (
                                    <option
                                      key={sourceKey(src)}
                                      value={sourceKey(src)}
                                    >
                                      {src.kind}:{formatShortId(src.id)} · v
                                      {src.version}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-3">
                                <select
                                  aria-label={t("citationKindAria", {
                                    index: String(citIdx + 1),
                                  })}
                                  disabled={!isOpenStatus}
                                  value={cit.locator.kind}
                                  onChange={(e) => {
                                    const nextKind = e.target
                                      .value as CitationLocatorKind;
                                    setItems((prev) =>
                                      prev.map((i) =>
                                        i.localKey === item.localKey
                                          ? {
                                              ...i,
                                              citations: i.citations.map(
                                                (entry, entryIdx) =>
                                                  entryIdx === citIdx
                                                    ? {
                                                        ...entry,
                                                        locator: {
                                                          ...entry.locator,
                                                          kind: nextKind,
                                                        },
                                                      }
                                                    : entry,
                                              ),
                                            }
                                          : i,
                                      ),
                                    );
                                    setDirty(true);
                                  }}
                                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                  {LOCATOR_KINDS.map((kind) => (
                                    <option key={kind} value={kind}>
                                      {kind}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-1.5 sm:col-span-4">
                                <input
                                  type="text"
                                  aria-label={t("citationValueAria", {
                                    index: String(citIdx + 1),
                                  })}
                                  disabled={!isOpenStatus}
                                  value={cit.locator.value}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItems((prev) =>
                                      prev.map((i) =>
                                        i.localKey === item.localKey
                                          ? {
                                              ...i,
                                              citations: i.citations.map(
                                                (entry, entryIdx) =>
                                                  entryIdx === citIdx
                                                    ? {
                                                        ...entry,
                                                        locator: {
                                                          ...entry.locator,
                                                          value: val,
                                                        },
                                                      }
                                                    : entry,
                                              ),
                                            }
                                          : i,
                                      ),
                                    );
                                    setDirty(true);
                                  }}
                                  placeholder={t("citationSectionPlaceholder")}
                                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                                {isOpenStatus && (
                                  <button
                                    type="button"
                                    aria-label={t("removeCitationAria", {
                                      index: String(citIdx + 1),
                                    })}
                                    onClick={() => {
                                      setItems((prev) =>
                                        prev.map((i) =>
                                          i.localKey === item.localKey
                                            ? {
                                                ...i,
                                                citations: i.citations.filter(
                                                  (_, entryIdx) =>
                                                    entryIdx !== citIdx,
                                                ),
                                              }
                                            : i,
                                        ),
                                      );
                                      setDirty(true);
                                    }}
                                    className="rounded-lg p-1 text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                                  >
                                    <TrashBinIcon className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOpenStatus && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={saveDraftMutation.isPending}
              onClick={() => void handleSaveDraft()}
            >
              {saveDraftMutation.isPending
                ? t("savingDraft")
                : t("saveDraftCta", {
                    nextVersion: String(currentDraftVersion + 1),
                  })}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canOpenPublish}
              title={
                !canOpenPublish ? t("publishValidationNoItems") : undefined
              }
              onClick={() => setIsPublishOpen(true)}
            >
              {t("openPublishModalCta")}
            </Button>
          </div>
        )}
      </section>

      <HandoverPublishModal
        isOpen={isPublishOpen}
        onClose={() => setIsPublishOpen(false)}
        projectId={projectId}
        handoverId={handoverId}
        etag={effectiveEtag}
        draftVersion={currentDraftVersion}
        draftItems={savedDraftItems}
        publishedRevision={publishedRevision}
        defaultOwnerUserId={currentUserId}
        members={members}
        onPublished={() => {
          setIsPublishOpen(false);
          onRevisionPublished();
        }}
      />
    </div>
  );
}
