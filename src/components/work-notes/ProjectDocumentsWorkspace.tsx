"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import {
  AlertIcon,
  CloseLineIcon,
  DownloadIcon,
  TrashBinIcon,
  UploadIcon,
} from "@/icons";
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
  "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";
const EMPTY_DOCUMENT: ProjectDocumentInput = {
  title: "",
  description: "",
  type: "OTHER",
  content: "",
};
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileTypeBadge(name: string, contentType?: string): "PDF" | "DOCX" {
  const lower = name.toLowerCase();
  if (contentType === "application/pdf" || lower.endsWith(".pdf")) return "PDF";
  return "DOCX";
}

function isSupportedDocumentFile(candidate: File): boolean {
  const lower = candidate.name.toLowerCase();
  const validType =
    ACCEPTED_FILE_TYPES.includes(candidate.type) ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".docx");
  return validType && candidate.size > 0 && candidate.size <= 20 * 1024 * 1024;
}

function DocumentEditor({
  initial,
  file,
  onFileChange,
  existingFile,
  isPending,
  isUploading,
  hasUploadError,
  error,
  onDirtyChange,
  confirmingDiscard,
  onKeepEditing,
  onConfirmDiscard,
  onSubmit,
  onClose,
}: {
  initial: ProjectDocumentInput;
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingFile?: { name: string; contentType: string; size: number } | null;
  isPending: boolean;
  isUploading: boolean;
  hasUploadError: boolean;
  error: string;
  onDirtyChange: (dirty: boolean) => void;
  confirmingDiscard: boolean;
  onKeepEditing: () => void;
  onConfirmDiscard: () => void;
  onSubmit: (input: ProjectDocumentInput, file: File | null) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("workNotes.documents");
  const common = useTranslations("workNotes");
  const [form, setForm] = useState(initial);
  const [titleError, setTitleError] = useState("");
  const [contentError, setContentError] = useState("");
  const [fileError, setFileError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dirty =
      form.title !== initial.title ||
      (form.description ?? "") !== (initial.description ?? "") ||
      form.type !== initial.type ||
      form.content !== initial.content ||
      Boolean(file);
    onDirtyChange(dirty);
  }, [file, form, initial, onDirtyChange]);

  function handleFileSelection(nextFile: File | null) {
    setFileError("");
    setContentError("");
    setValidationError("");
    if (nextFile && !isSupportedDocumentFile(nextFile)) {
      setFileError(t("fileInvalid"));
      setValidationError(t("fileInvalid"));
      onFileChange(nextFile);
      return;
    }
    onFileChange(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped) handleFileSelection(dropped);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    const missingTitle = !title;
    const missingContentAndFile = !content && !file && !existingFile;

    setTitleError(missingTitle ? t("titleRequiredError") : "");
    setContentError(
      missingContentAndFile ? t("contentOrFileRequiredError") : "",
    );

    if (missingTitle || missingContentAndFile) {
      setValidationError(common("validationRequired"));
      return;
    }
    if (file && !isSupportedDocumentFile(file)) {
      setFileError(t("fileInvalid"));
      setValidationError(t("fileInvalid"));
      return;
    }
    setFileError("");
    setValidationError("");
    await onSubmit(
      { ...form, title, content, description: form.description?.trim() ?? "" },
      file,
    );
  }

  const activeAlert = validationError || error;

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
        {activeAlert && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 fill-current" />
            <span>{activeAlert}</span>
          </div>
        )}

        <section
          aria-labelledby="doc-basic-info-heading"
          className="space-y-3"
        >
          <h3
            id="doc-basic-info-heading"
            className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
          >
            {t("basicInfoSection")}
          </h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="doc-title-input"
                className="flex items-center justify-between gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <span>
                  {t("titleLabel")}
                  <span
                    className="ms-1 text-error-600 dark:text-error-400"
                    aria-hidden="true"
                  >
                    *
                  </span>
                </span>
                <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                  {t("required")}
                </span>
              </label>
              <input
                id="doc-title-input"
                aria-label={t("titleLabel")}
                aria-invalid={Boolean(titleError)}
                required
                maxLength={240}
                autoFocus
                placeholder={t("titlePlaceholder")}
                value={form.title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setForm((current) => ({ ...current, title: nextTitle }));
                  if (titleError && nextTitle.trim()) setTitleError("");
                  if (validationError) setValidationError("");
                }}
                className={`${FIELD_CLASS} ${
                  titleError
                    ? "border-error-400 focus:border-error-500 dark:border-error-500"
                    : ""
                }`}
              />
              {titleError && (
                <p className="text-xs text-error-600 dark:text-error-400">
                  {titleError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="doc-type-select"
                className="flex items-center justify-between gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <span>
                  {t("typeLabel")}
                  <span
                    className="ms-1 text-error-600 dark:text-error-400"
                    aria-hidden="true"
                  >
                    *
                  </span>
                </span>
                <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                  {t("required")}
                </span>
              </label>
              <select
                id="doc-type-select"
                aria-label={t("typeLabel")}
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
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="doc-description-input"
              className="flex items-center justify-between gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <span>{t("descriptionLabel")}</span>
              <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                {t("optional")}
              </span>
            </label>
            <textarea
              id="doc-description-input"
              aria-label={t("descriptionLabel")}
              maxLength={2000}
              rows={2}
              placeholder={t("descriptionPlaceholder")}
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className={`${FIELD_CLASS} resize-y`}
            />
          </div>
        </section>

        <section
          aria-labelledby="doc-content-attachments-heading"
          className="space-y-3 border-t border-gray-100 pt-3.5 dark:border-gray-800"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <h3
              id="doc-content-attachments-heading"
              className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
            >
              {t("contentAndAttachmentsSection")}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("contentAndAttachmentsHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="doc-content-input"
              className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <span>
                {t("contentLabel")}{" "}
                <span className="ms-1 text-xs font-normal text-gray-400 dark:text-gray-500">
                  ({file || existingFile ? t("optional") : t("requiredIfNoFile")})
                </span>
              </span>
              <span className="text-xs font-normal text-gray-400 tabular-nums dark:text-gray-500">
                {form.content.length.toLocaleString()} / 200,000
              </span>
            </label>
            <textarea
              id="doc-content-input"
              aria-label={t("contentLabel")}
              aria-invalid={Boolean(contentError)}
              maxLength={200000}
              rows={3}
              placeholder={t("contentPlaceholder")}
              value={form.content}
              onChange={(event) => {
                const nextContent = event.target.value;
                setForm((current) => ({ ...current, content: nextContent }));
                if (contentError && nextContent.trim()) setContentError("");
                if (validationError) setValidationError("");
              }}
              className={`${FIELD_CLASS} min-h-24 max-h-56 resize-y text-sm leading-6 ${
                contentError
                  ? "border-error-400 focus:border-error-500 dark:border-error-500"
                  : ""
              }`}
            />
            {contentError && (
              <p className="text-xs text-error-600 dark:text-error-400">
                {contentError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="doc-file-input"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("fileLabel")}
              </label>
              <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                {t("optional")}
              </span>
            </div>

            <input
              ref={fileInputRef}
              id="doc-file-input"
              type="file"
              aria-label={t("fileLabel")}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) =>
                handleFileSelection(event.target.files?.[0] ?? null)
              }
              className="sr-only"
            />

            {file ? (
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-3 ${
                  fileError || hasUploadError
                    ? "border-error-300 bg-error-50/50 dark:border-error-500/40 dark:bg-error-500/10"
                    : "border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/60"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    {getFileTypeBadge(file.name, file.type)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                      {file.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                      <span>{formatFileSize(file.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          hasUploadError
                            ? "font-medium text-error-600 dark:text-error-400"
                            : "text-brand-700 dark:text-brand-300"
                        }
                      >
                        {isUploading
                          ? t("fileUploadingBadge")
                          : hasUploadError
                            ? t("fileRetryBadge")
                            : t("fileReadyBadge")}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t("replaceFile")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      handleFileSelection(null);
                    }}
                    aria-label={t("removeFile")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-error-600 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-error-400"
                  >
                    <TrashBinIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3.5 transition sm:flex-row ${
                  isDragging
                    ? "border-brand-500 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-500/10"
                    : "border-gray-300 bg-gray-50/50 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3 text-center sm:text-start">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                    <UploadIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t("fileDropzoneTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {existingFile
                        ? `${existingFile.name} (${formatFileSize(existingFile.size)}) · ${t("existingFileBadge")}`
                        : t("fileDropzoneHint")}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {existingFile ? t("replaceFile") : t("browseFiles")}
                </Button>
              </div>
            )}

            {fileError && (
              <p className="text-xs text-error-600 dark:text-error-400">
                {fileError}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900/90">
        {confirmingDiscard ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-warning-800 dark:text-warning-300">
              {t("unsavedChangesPrompt")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onKeepEditing}
              >
                {t("keepEditing")}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onConfirmDiscard}
              >
                {t("discardChanges")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("draftWorkflowHint")}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" isLoading={isPending}>
                {t("saveDraft")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

const STATUS_BADGE_CLASSES: Record<DocumentStatus, string> = {
  DRAFT:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING_REVIEW:
    "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300",
  CHANGES_REQUESTED:
    "border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300",
  APPROVED:
    "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300",
  REJECTED:
    "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300",
  ARCHIVED:
    "border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadRetryInput, setUploadRetryInput] =
    useState<ProjectDocumentInput | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
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
          }
        : EMPTY_DOCUMENT),
    [current, uploadRetryInput],
  );

  async function saveDocument(input: ProjectDocumentInput, file: File | null) {
    create.reset();
    update.reset();
    upload.reset();
    action.reset();
    setConfirmingDiscard(false);
    try {
      if (isCreating) {
        const created = await create.mutateAsync(input);
        setSelected(created);
        setIsCreating(false);
        if (file) {
          setUploadRetryInput(input);
          setIsEditing(true);
          setSelected(await upload.mutateAsync({ id: created.id, file }));
          setPendingFile(null);
          setUploadRetryInput(null);
          setIsEditing(false);
        }
        setIsEditorDirty(false);
      } else {
        await update.mutateAsync(input);
        if (file) {
          setUploadRetryInput(input);
          setSelected(await upload.mutateAsync({ id: documentId, file }));
          setPendingFile(null);
          setUploadRetryInput(null);
        }
        setIsEditing(false);
        setIsEditorDirty(false);
      }
    } catch {
      // Keep the editor open so the user can retry without losing the draft.
    }
  }

  async function runAction(
    actionName: "submit" | "approve" | "request-changes" | "reject" | "archive",
  ) {
    action.reset();
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
    setPendingFile(null);
    setUploadRetryInput(null);
    setReviewComment("");
    setValidationError("");
    setIsEditorDirty(false);
    setConfirmingDiscard(false);
  }

  function closeModal() {
    create.reset();
    update.reset();
    upload.reset();
    action.reset();
    setSelected(null);
    setIsCreating(false);
    setIsEditing(false);
    setPendingFile(null);
    setUploadRetryInput(null);
    setIsEditorDirty(false);
    setConfirmingDiscard(false);
  }

  function requestCloseModal() {
    if ((isCreating || isEditing) && isEditorDirty && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    closeModal();
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
          "input:not([disabled]):not(.sr-only), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
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
      "button:not([disabled]), input:not([disabled]):not(.sr-only), select:not([disabled]), textarea:not([disabled])",
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
                className="h-10 min-w-44 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950"
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
                  setPendingFile(null);
                  setUploadRetryInput(null);
                  setIsEditorDirty(false);
                  setConfirmingDiscard(false);
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
                className="h-16 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : list.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
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
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[document.status]}`}
                      >
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
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
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
        onClose={requestCloseModal}
        onBackdropClick={requestCloseModal}
        backdropClassName="bg-gray-900/35 backdrop-blur-[2px] dark:bg-gray-950/60"
        showCloseButton={false}
        className={`mx-3 overflow-hidden rounded-xl border border-gray-200 shadow-theme-lg dark:border-gray-800 ${
          isCreating || isEditing ? "max-w-2xl" : "max-w-3xl"
        }`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-dialog-title"
          onKeyDown={trapDialogFocus}
          className="flex max-h-[min(88vh,48rem)] flex-col overflow-hidden"
        >
          <div className="shrink-0 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
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
              {isCreating ? (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("formSubtitleNew")}
                </p>
              ) : isEditing ? (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t("formSubtitleEdit")}
                </p>
              ) : current ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t(`status.${current.status}`)} ·{" "}
                  {t("version", { version: current.version })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={requestCloseModal}
              aria-label={t("close")}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <CloseLineIcon className="h-4 w-4 fill-current" />
            </button>
          </div>
          {isCreating || isEditing ? (
            <DocumentEditor
              key={`${documentId}-${current?.version ?? 0}-${isCreating ? "new" : "edit"}-${uploadRetryInput ? "retry" : ""}`}
              initial={isCreating ? EMPTY_DOCUMENT : editingInitial}
              file={pendingFile}
              onFileChange={setPendingFile}
              existingFile={current?.file ?? null}
              isPending={
                create.isPending || update.isPending || upload.isPending
              }
              isUploading={upload.isPending}
              hasUploadError={Boolean(upload.error)}
              error={
                upload.error instanceof Error
                  ? upload.error.message
                  : create.error instanceof Error
                    ? create.error.message
                    : update.error instanceof Error
                      ? update.error.message
                      : ""
              }
              onDirtyChange={setIsEditorDirty}
              confirmingDiscard={confirmingDiscard}
              onKeepEditing={() => setConfirmingDiscard(false)}
              onConfirmDiscard={closeModal}
              onSubmit={saveDocument}
              onClose={requestCloseModal}
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
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <p className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                  {t("created", {
                    date: format.dateTime(new Date(current.createdAt), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }),
                  })}
                </p>
                {current.status === "DRAFT" && current.permissions.canSubmit && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                    <p className="font-semibold">{t("draftBannerTitle")}</p>
                    <p className="mt-0.5 text-brand-800 dark:text-brand-300">
                      {t("draftBannerDescription")}
                    </p>
                  </div>
                )}
                {current.status === "CHANGES_REQUESTED" &&
                  current.permissions.canSubmit && (
                    <div className="rounded-lg border border-warning-200 bg-warning-50/80 px-3.5 py-2.5 text-xs text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                      <p className="font-semibold">
                        {t("changesRequestedBannerTitle")}
                      </p>
                      <p className="mt-0.5 text-warning-800 dark:text-warning-300">
                        {t("changesRequestedBannerDescription")}
                      </p>
                    </div>
                  )}
                {current.reviewComment && (
                  <div className="rounded-e-lg border-s-2 border-warning-500 bg-warning-50 px-3.5 py-2.5 text-sm text-warning-900 dark:bg-warning-500/10 dark:text-warning-200">
                    <strong>{t("reviewComment")}:</strong>{" "}
                    {current.reviewComment}
                  </div>
                )}
                {current.content && (
                  <div className="text-sm leading-7 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {current.content}
                  </div>
                )}
                {current.file && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand-700 uppercase dark:bg-brand-500/15 dark:text-brand-300">
                        {getFileTypeBadge(
                          current.file.name,
                          current.file.contentType,
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                          {current.file.name}
                        </p>
                        <p className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                          {formatFileSize(current.file.size)}
                        </p>
                      </div>
                    </div>
                    <a
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline hover:text-brand-800 dark:text-brand-300"
                      href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                      {t("downloadFile", { name: current.file.name })}
                    </a>
                  </div>
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
                          className="flex flex-wrap justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
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
                            className="rounded-lg border border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
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
                      placeholder={t("reviewCommentPlaceholder")}
                      rows={3}
                      maxLength={5000}
                      className={`${FIELD_CLASS} resize-y`}
                    />
                  </label>
                )}
              </div>
              <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900/90">
                {current.permissions.canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      create.reset();
                      update.reset();
                      upload.reset();
                      action.reset();
                      setValidationError("");
                      setIsEditorDirty(false);
                      setConfirmingDiscard(false);
                      setIsEditing(true);
                    }}
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
                  current.status !== "ARCHIVED" &&
                  (current.status === "APPROVED" ||
                    current.versions.some((v) => v.status === "APPROVED")) && (
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
            </>
          ) : null}
        </div>
      </Modal>
    </main>
  );
}
