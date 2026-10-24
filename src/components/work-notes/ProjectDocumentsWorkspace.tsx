"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import {
  DOCUMENT_TYPES,
  useDocumentQuery,
  useDocumentsQuery,
  useWorkNotesMutation,
  workNoteKeys,
  workNotesApi,
  type DocumentStatus,
  type DocumentType,
  type ProjectDocumentInput,
  type ProjectDocumentSummary,
} from "@/lib/queries/work-notes/useWorkNotes";

const STATUSES: readonly (DocumentStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "ARCHIVED",
];
const FIELD_CLASS =
  "w-full min-w-0 border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";
const EMPTY_DOCUMENT: ProjectDocumentInput = {
  title: "",
  description: "",
  type: "OTHER",
  content: "",
};

function DocumentEditor({
  initial,
  hasExistingFile,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  initial: ProjectDocumentInput;
  hasExistingFile: boolean;
  isPending: boolean;
  error: string;
  onSubmit: (input: ProjectDocumentInput, file: File | null) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("workNotes.documents");
  const common = useTranslations("workNotes");
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || (!content && !file && !hasExistingFile)) {
      setValidationError(common("validationRequired"));
      return;
    }
    setValidationError("");
    if (
      file &&
      (file.size > 20 * 1024 * 1024 ||
        ![
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(file.type))
    ) {
      setValidationError(t("fileInvalid"));
      return;
    }
    await onSubmit(
      { ...form, title, content, description: form.description?.trim() ?? "" },
      file,
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-4 px-5 py-5 sm:px-6"
    >
      <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("titleLabel")}
        <input
          required
          maxLength={240}
          autoFocus
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
          className={FIELD_CLASS}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("descriptionLabel")}
        <textarea
          maxLength={2000}
          rows={2}
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          className={`${FIELD_CLASS} resize-y`}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("typeLabel")}
        <select
          value={form.type}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              type: event.target.value as DocumentType,
            }))
          }
          className={FIELD_CLASS}
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("contentLabel")}
        <textarea
          maxLength={200000}
          rows={12}
          value={form.content}
          onChange={(event) =>
            setForm((current) => ({ ...current, content: event.target.value }))
          }
          className={`${FIELD_CLASS} font-mono min-h-64 resize-y text-xs leading-5`}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("fileLabel")}
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className={FIELD_CLASS}
        />
      </label>
      {validationError && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {validationError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("close")}
        </Button>
        <Button type="submit" size="sm" isLoading={isPending}>
          {t("saveDraft")}
        </Button>
      </div>
    </form>
  );
}

export default function ProjectDocumentsWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes.documents");
  const common = useTranslations("workNotes");
  const format = useFormatter();
  const [filter, setFilter] = useState<DocumentStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProjectDocumentSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadRetryInput, setUploadRetryInput] =
    useState<ProjectDocumentInput | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [validationError, setValidationError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasModalOpenRef = useRef(false);
  const list = useDocumentsQuery(projectId, filter, page);
  const documentId = selected?.id ?? "";
  const detail = useDocumentQuery(projectId, documentId);
  const create = useWorkNotesMutation(
    workNotesApi.createDocument.bind(null, projectId),
    [workNoteKeys.project(projectId)],
  );
  const update = useWorkNotesMutation(
    (input: ProjectDocumentInput) =>
      workNotesApi.updateDocument(projectId, documentId, input),
    [workNoteKeys.project(projectId)],
  );
  const upload = useWorkNotesMutation(
    ({ id, file }: { id: string; file: File }) =>
      workNotesApi.uploadDocumentFile(projectId, id, file),
    [workNoteKeys.project(projectId)],
  );
  const action = useWorkNotesMutation(
    (
      input: Readonly<{
        action: "submit" | "approve" | "request-changes" | "reject" | "archive";
        comment?: string;
      }>,
    ) =>
      workNotesApi.documentAction(
        projectId,
        documentId,
        input.action,
        input.comment,
      ),
    [workNoteKeys.project(projectId)],
  );
  const current = detail.data;
  const editingInitial = useMemo<ProjectDocumentInput>(
    () =>
      uploadRetryInput ??
      (current
        ? {
            title: current.title,
            description: current.description ?? "",
            type: current.type,
            content: current.content,
            ...(current.taskId ? { taskId: current.taskId } : {}),
          }
        : EMPTY_DOCUMENT),
    [current, uploadRetryInput],
  );

  async function saveDocument(input: ProjectDocumentInput, file: File | null) {
    try {
      if (isCreating) {
        const created = await create.mutateAsync(input);
        setSelected(created);
        setIsCreating(false);
        if (file) {
          setUploadRetryInput(input);
          setIsEditing(true);
          setSelected(await upload.mutateAsync({ id: created.id, file }));
          setUploadRetryInput(null);
          setIsEditing(false);
        }
      } else {
        await update.mutateAsync(input);
        if (file)
          setSelected(await upload.mutateAsync({ id: documentId, file }));
        setIsEditing(false);
      }
    } catch {
      // Keep the editor open so the user can retry without losing the draft.
    }
  }

  async function runAction(
    actionName: "submit" | "approve" | "request-changes" | "reject" | "archive",
  ) {
    const comment = reviewComment.trim();
    if (
      (actionName === "request-changes" || actionName === "reject") &&
      !comment
    ) {
      setValidationError(t("reviewCommentRequired"));
      return;
    }
    setValidationError("");
    try {
      const result = await action.mutateAsync({
        action: actionName,
        ...(comment ? { comment } : {}),
      });
      setSelected(result);
      setReviewComment("");
    } catch {
      // Mutation error is displayed in the modal.
    }
  }

  function openDocument(document: ProjectDocumentSummary) {
    create.reset();
    update.reset();
    upload.reset();
    action.reset();
    setSelected(document);
    setIsCreating(false);
    setIsEditing(false);
    setUploadRetryInput(null);
    setReviewComment("");
    setValidationError("");
  }

  function closeModal() {
    create.reset();
    update.reset();
    upload.reset();
    action.reset();
    setSelected(null);
    setIsCreating(false);
    setIsEditing(false);
    setUploadRetryInput(null);
  }

  const modalOpen = isCreating || Boolean(selected);

  useEffect(() => {
    if (modalOpen) {
      if (!wasModalOpenRef.current) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
      dialogRef.current
        ?.querySelector<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        )
        ?.focus();
    } else if (wasModalOpenRef.current) {
      returnFocusRef.current?.focus();
    }
    wasModalOpenRef.current = modalOpen;
  }, [modalOpen, isCreating, isEditing, current?.id]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="documents" />
      <section
        aria-labelledby="project-documents-heading"
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="project-documents-heading"
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("description")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("filterLabel")}
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as DocumentStatus | "ALL");
                  setPage(1);
                }}
                className="h-10 min-w-44 border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "ALL"
                      ? t("allStatuses")
                      : t(`status.${status}`)}
                  </option>
                ))}
              </select>
            </label>
            {list.isSuccess && (
              <Button
                size="sm"
                onClick={() => {
                  create.reset();
                  update.reset();
                  upload.reset();
                  action.reset();
                  setUploadRetryInput(null);
                  setIsEditing(false);
                  setIsCreating(true);
                  setSelected(null);
                }}
              >
                {t("create")}
              </Button>
            )}
          </div>
        </div>

        {list.isPending ? (
          <div
            role="status"
            aria-label={common("loading")}
            className="space-y-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-16 animate-pulse border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : list.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <span>
              {list.error instanceof Error
                ? list.error.message
                : common("saveFailed")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void list.refetch()}
            >
              {common("retry")}
            </Button>
          </div>
        ) : list.data?.data.length ? (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[40rem] border-collapse text-start text-sm">
              <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("titleLabel")}</th>
                  <th className="px-4 py-3 font-semibold">{t("typeLabel")}</th>
                  <th className="px-4 py-3 font-semibold">
                    {t("statusLabel")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("versionLabel")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("updatedLabel")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {list.data.data.map((document) => (
                  <tr
                    key={document.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDocument(document)}
                        className="max-w-md text-start font-medium break-words text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                      >
                        {document.title}
                      </button>
                      {document.description && (
                        <p className="mt-1 max-w-lg text-xs break-words text-gray-500 dark:text-gray-400">
                          {document.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {t(`type.${document.type}`)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                        {t(`status.${document.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums dark:text-gray-400">
                      v{document.version}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 tabular-nums dark:text-gray-400">
                      {format.dateTime(new Date(document.updatedAt), {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {t("empty")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("description")}
            </p>
          </div>
        )}

        {list.data && list.data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
            <span className="text-gray-500 tabular-nums dark:text-gray-400">
              {common("pagination.total", {
                count: list.data.pagination.totalItems,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                {common("pagination.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= list.data.pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                {common("pagination.next")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        backdropClassName="bg-gray-900/25 backdrop-blur-[1px] dark:bg-gray-950/45"
        showCloseButton={false}
        className="mx-3 max-h-[min(92vh,56rem)] max-w-4xl overflow-y-auto border border-gray-200 shadow-theme-lg dark:border-gray-800"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-dialog-title"
          onKeyDown={trapDialogFocus}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0">
              <h2
                id="document-dialog-title"
                className="text-lg font-semibold break-words text-gray-900 dark:text-white/90"
              >
                {isCreating
                  ? t("formTitleNew")
                  : isEditing
                    ? t("formTitleEdit")
                    : (current?.title ?? selected?.title ?? t("open"))}
              </h2>
              {current && !isEditing && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t(`status.${current.status}`)} ·{" "}
                  {t("version", { version: current.version })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label={t("close")}
              className="shrink-0 border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("close")}
            </button>
          </div>
          {current && !isEditing && (
            <p className="px-5 pt-3 text-xs text-gray-500 tabular-nums sm:px-6 dark:text-gray-400">
              {t("created", {
                date: format.dateTime(new Date(current.createdAt), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </p>
          )}
          {isCreating || isEditing ? (
            <DocumentEditor
              key={`${documentId}-${current?.version ?? 0}-${isCreating ? "new" : "edit"}-${uploadRetryInput ? "retry" : ""}`}
              initial={isCreating ? EMPTY_DOCUMENT : editingInitial}
              hasExistingFile={Boolean(current?.file)}
              isPending={
                create.isPending || update.isPending || upload.isPending
              }
              error={
                upload.error instanceof Error
                  ? upload.error.message
                  : create.error instanceof Error
                    ? create.error.message
                    : update.error instanceof Error
                      ? update.error.message
                      : ""
              }
              onSubmit={saveDocument}
              onClose={closeModal}
            />
          ) : detail.isPending ? (
            <div
              role="status"
              className="p-6 text-sm text-gray-500 dark:text-gray-400"
            >
              {common("loading")}
            </div>
          ) : detail.isError ? (
            <div
              role="alert"
              className="p-6 text-sm text-error-700 dark:text-error-300"
            >
              {detail.error instanceof Error
                ? detail.error.message
                : common("saveFailed")}{" "}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void detail.refetch()}
              >
                {common("retry")}
              </Button>
            </div>
          ) : current ? (
            <div className="space-y-5 px-5 py-5 sm:px-6">
              {current.reviewComment && (
                <div className="border-s-2 border-warning-500 bg-warning-50 px-3 py-2 text-sm text-warning-900 dark:bg-warning-500/10 dark:text-warning-200">
                  <strong>{t("reviewComment")}:</strong> {current.reviewComment}
                </div>
              )}
              <div className="text-sm leading-7 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {current.content}
              </div>
              {current.file && (
                <a
                  className="text-sm font-medium text-brand-700 underline dark:text-brand-300"
                  href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file`}
                >
                  {t("downloadFile", { name: current.file.name })}
                </a>
              )}
              {current.versions.some(
                (version) =>
                  version.file && version.version !== current.version,
              ) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {current.versions
                    .filter(
                      (version) =>
                        version.file && version.version !== current.version,
                    )
                    .map((version) => (
                      <a
                        key={version.version}
                        className="text-brand-700 underline dark:text-brand-300"
                        href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file?version=${version.version}`}
                      >
                        {t("downloadVersion", {
                          version: version.version,
                          name: version.file!.name,
                        })}
                      </a>
                    ))}
                </div>
              )}
              <div className="grid gap-5 border-t border-gray-100 pt-4 sm:grid-cols-2 dark:border-gray-800">
                <section>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {t("history")}
                  </h3>
                  <ol className="mt-2 space-y-2">
                    {current.versions.map((version) => (
                      <li
                        key={version.version}
                        className="flex flex-wrap justify-between gap-2 border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
                      >
                        <span>
                          {t("version", { version: version.version })} ·{" "}
                          {t(`status.${version.status}`)}
                        </span>
                        <time className="text-gray-500 tabular-nums dark:text-gray-400">
                          {format.dateTime(new Date(version.createdAt), {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          })}
                        </time>
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {t("reviewHistory")}
                  </h3>
                  {current.reviewHistory.length ? (
                    <ol className="mt-2 space-y-2">
                      {current.reviewHistory.map((event, index) => (
                        <li
                          key={`${event.at}-${index}`}
                          className="border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
                        >
                          <span className="font-medium">
                            {t(`status.${event.action}`)}
                          </span>
                          <time className="ms-2 text-gray-500 tabular-nums dark:text-gray-400">
                            {format.dateTime(new Date(event.at), {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "UTC",
                            })}
                          </time>
                          {event.comment && (
                            <p className="mt-1 break-words whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                              {event.comment}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {common("noData")}
                    </p>
                  )}
                </section>
              </div>
              {validationError && (
                <p
                  role="alert"
                  className="text-sm text-error-600 dark:text-error-400"
                >
                  {validationError}
                </p>
              )}
              {action.isError && (
                <p
                  role="alert"
                  className="text-sm text-error-600 dark:text-error-400"
                >
                  {action.error instanceof Error
                    ? action.error.message
                    : t("permissionDenied")}
                </p>
              )}
              {action.isSuccess && (
                <p
                  role="status"
                  className="text-sm text-success-700 dark:text-success-400"
                >
                  {t("actionSuccess")}
                </p>
              )}
              {current.permissions.canReview && (
                <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("reviewComment")}
                  <textarea
                    value={reviewComment}
                    onChange={(event) => {
                      setReviewComment(event.target.value);
                      setValidationError("");
                    }}
                    rows={3}
                    maxLength={5000}
                    className={`${FIELD_CLASS} resize-y`}
                  />
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                {current.permissions.canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    {t("edit")}
                  </Button>
                )}
                {current.permissions.canSubmit && (
                  <Button
                    size="sm"
                    isLoading={action.isPending}
                    onClick={() => void runAction("submit")}
                  >
                    {t("submit")}
                  </Button>
                )}
                {current.permissions.canReview && (
                  <>
                    <Button
                      size="sm"
                      isLoading={action.isPending}
                      onClick={() => void runAction("approve")}
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={action.isPending}
                      onClick={() => void runAction("request-changes")}
                    >
                      {t("requestChanges")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      isLoading={action.isPending}
                      onClick={() => void runAction("reject")}
                    >
                      {t("reject")}
                    </Button>
                  </>
                )}
                {current.permissions.canConfigure &&
                  current.status === "APPROVED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={action.isPending}
                      onClick={() => void runAction("archive")}
                    >
                      {t("archive")}
                    </Button>
                  )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </main>
  );
}
