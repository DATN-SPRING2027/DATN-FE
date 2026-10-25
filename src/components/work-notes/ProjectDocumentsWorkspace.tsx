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
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import { Modal } from "@/components/ui/modal";
import {
  AlertIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckLineIcon,
  CloseLineIcon,
  DocsIcon,
  DownloadIcon,
  EyeIcon,
  InfoIcon,
  MoreDotIcon,
  PaperPlaneIcon,
  TrashBinIcon,
  UploadIcon,
  UserCircleIcon,
} from "@/icons";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import {
  useProjectMembersQuery,
  type ProjectMemberPage,
} from "@/lib/queries/projects/useProjectMembers";
import type { ProjectList } from "@/lib/queries/projects/useProjects";
import DocumentFilePreviewModal from "./DocumentFilePreviewModal";
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
const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".drawio",
  ".sql",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "application/xml",
  "text/xml",
  "application/sql",
  "text/x-sql",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const FILE_INPUT_ACCEPT = [
  ...SUPPORTED_EXTENSIONS,
  ...ACCEPTED_FILE_TYPES,
].join(",");

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileTypeBadge(name: string, contentType?: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".markdown") || lower.endsWith(".md")) return "MD";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "YAML";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "JPG";
  const matchedExt = SUPPORTED_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (matchedExt) return matchedExt.slice(1).toUpperCase();
  if (contentType === "application/pdf") return "PDF";
  if (contentType?.startsWith("text/")) return "TXT";
  return "FILE";
}

function isSupportedDocumentFile(candidate: File): boolean {
  const lower = candidate.name.toLowerCase();
  const baseType = candidate.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const validExt = SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const validType =
    baseType === "" ||
    baseType === "application/octet-stream" ||
    ACCEPTED_FILE_TYPES.includes(baseType);
  return (
    validExt &&
    validType &&
    candidate.size > 0 &&
    candidate.size <= 20 * 1024 * 1024
  );
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
  const [previewingLocalFile, setPreviewingLocalFile] = useState(false);
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
              accept={FILE_INPUT_ACCEPT}
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
                    onClick={() => setPreviewingLocalFile(true)}
                  >
                    <EyeIcon className="me-1 h-3.5 w-3.5" />
                    {t("previewAction")}
                  </Button>
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
                {file && (
                  <DocumentFilePreviewModal
                    isOpen={previewingLocalFile}
                    onClose={() => setPreviewingLocalFile(false)}
                    fileName={file.name}
                    contentType={file.type}
                    fileSize={file.size}
                    fetchBlob={() => Promise.resolve(file)}
                  />
                )}
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

const STATUS_DOT_CLASSES: Record<DocumentStatus, string> = {
  DRAFT: "bg-gray-400 dark:bg-gray-500",
  PENDING_REVIEW: "bg-brand-500 dark:bg-brand-400",
  CHANGES_REQUESTED: "bg-warning-500 dark:bg-warning-400",
  APPROVED: "bg-success-500 dark:bg-success-400",
  REJECTED: "bg-error-500 dark:bg-error-400",
  ARCHIVED: "bg-gray-400 dark:bg-gray-500",
};

export default function ProjectDocumentsWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes.documents");
  const common = useTranslations("workNotes");
  const format = useFormatter();
  const queryClient = useQueryClient();
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
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<
    number | null
  >(null);
  const [showActionSuccess, setShowActionSuccess] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    loading: boolean;
    mode: "text" | "pdf" | "image" | "binary";
    text?: string;
    url?: string;
    error?: string;
  }>({ open: false, loading: false, mode: "binary" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasModalOpenRef = useRef(false);
  const cachedCurrentUser = queryClient.getQueryData<CurrentUserResponse>(
    authKeys.currentUser(),
  );
  const activeOrganizationId =
    cachedCurrentUser && "organizationId" in cachedCurrentUser
      ? (cachedCurrentUser.organizationId ?? "")
      : "";
  const projectMembers = useProjectMembersQuery(
    activeOrganizationId,
    projectId,
    { page: 1, pageSize: 100 },
  );
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
        action:
          | "submit"
          | "comment"
          | "approve"
          | "request-changes"
          | "reject"
          | "archive";
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
  const listAccessLost = isAccessOrResourceUnavailableError(list.error);
  const detailAccessLost = isAccessOrResourceUnavailableError(detail.error);
  const visibleList = listAccessLost ? undefined : list.data;
  const current = detailAccessLost ? undefined : detail.data;
  const reviewableDocuments = useMemo(
    () => (visibleList?.data ?? []).filter((doc) => doc.permissions.canReview),
    [visibleList?.data],
  );
  const userLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (cachedCurrentUser?.id) {
      map.set(
        cachedCurrentUser.id.toLowerCase(),
        cachedCurrentUser.name || cachedCurrentUser.email,
      );
    }
    for (const member of projectMembers.data?.data ?? []) {
      const label = member.user?.fullName || member.user?.email;
      if (member.userId && label) {
        map.set(member.userId.toLowerCase(), label);
      }
    }
    const projectQueries = queryClient.getQueriesData<ProjectList>({
      queryKey: ["projects"],
    });
    for (const [, data] of projectQueries) {
      for (const proj of data?.data ?? []) {
        for (const leader of proj.leaders ?? []) {
          if (leader.userId && (leader.fullName || leader.email)) {
            map.set(
              leader.userId.toLowerCase(),
              leader.fullName || leader.email,
            );
          }
        }
        for (const preview of proj.memberPreviews ?? []) {
          if (preview.userId && (preview.fullName || preview.email)) {
            map.set(
              preview.userId.toLowerCase(),
              preview.fullName || preview.email,
            );
          }
        }
      }
    }
    const memberQueries = queryClient.getQueriesData<ProjectMemberPage>({
      queryKey: ["project-members"],
    });
    for (const [, pageData] of memberQueries) {
      for (const member of pageData?.data ?? []) {
        const label = member.user?.fullName || member.user?.email;
        if (member.userId && label) {
          map.set(member.userId.toLowerCase(), label);
        }
      }
    }
    return map;
  }, [cachedCurrentUser, projectMembers.data?.data, queryClient]);

  function resolveActorLabel(
    actorId: string | undefined,
    roleHint: "author" | "reviewer",
  ): string {
    if (!actorId) {
      return roleHint === "author" ? t("authorActor") : t("reviewerActor");
    }
    const normalized = actorId.trim();
    const mapped = userLookup.get(normalized.toLowerCase());
    if (mapped) {
      if (
        cachedCurrentUser?.id &&
        cachedCurrentUser.id.toLowerCase() === normalized.toLowerCase()
      ) {
        return t("youSuffix", { name: mapped });
      }
      return mapped;
    }
    if (!/^[a-f0-9]{24}$/i.test(normalized)) {
      return normalized;
    }
    if (current && normalized === current.createdBy) {
      return t("authorActor");
    }
    return roleHint === "author" ? t("authorActor") : t("reviewerActor");
  }

  const sortedVersions = useMemo(
    () =>
      current
        ? [...current.versions].sort((a, b) => b.version - a.version)
        : [],
    [current],
  );
  const latestApprovedVersion = useMemo(
    () =>
      current?.versions
        .filter((v) => v.status === "APPROVED")
        .reduce((max, v) => Math.max(max, v.version), 0) ?? 0,
    [current?.versions],
  );
  const viewedVersion = useMemo(() => {
    if (!current) return null;
    const targetVersion = selectedVersionNumber ?? current.version;
    return (
      current.versions.find((v) => v.version === targetVersion) ??
      current.versions.find((v) => v.version === current.version) ??
      current.versions.at(-1) ??
      null
    );
  }, [current, selectedVersionNumber]);
  const isViewingHistoricalVersion = Boolean(
    current && viewedVersion && viewedVersion.version !== current.version,
  );
  const activeFile = useMemo(() => {
    if (!current) return undefined;
    if (viewedVersion) {
      if (viewedVersion.file) return viewedVersion.file;
      if (viewedVersion.version === current.version) return current.file;
      return undefined;
    }
    return current.file;
  }, [current, viewedVersion]);
  const activeContent = useMemo(() => {
    if (!current) return "";
    if (viewedVersion && typeof viewedVersion.content === "string") {
      return viewedVersion.content;
    }
    return current.content;
  }, [current, viewedVersion]);
  const canArchiveDocument = Boolean(
    current &&
      current.permissions.canConfigure &&
      current.status !== "ARCHIVED" &&
      (current.status === "APPROVED" ||
        current.versions.some((v) => v.status === "APPROVED")),
  );

  useEffect(() => {
    if (!showActionSuccess) return;
    const timer = window.setTimeout(() => {
      setShowActionSuccess(false);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [showActionSuccess]);

  useEffect(() => {
    return () => {
      if (previewState.url) {
        URL.revokeObjectURL(previewState.url);
      }
    };
  }, [previewState.url]);

  function resetPreview() {
    setPreviewState((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { open: false, loading: false, mode: "binary" };
    });
  }

  function toggleFilePreview() {
    if (!current || !activeFile) return;
    if (previewState.open) {
      resetPreview();
      return;
    }
    setPreviewState({ open: true, loading: false, mode: "binary" });
  }
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
    setShowActionSuccess(false);
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
    actionName:
      | "submit"
      | "comment"
      | "approve"
      | "request-changes"
      | "reject"
      | "archive",
  ) {
    action.reset();
    setShowActionSuccess(false);
    const comment = reviewComment.trim();
    const effectiveComment =
      comment ||
      ((actionName === "request-changes" || actionName === "reject") &&
      current?.reviewComment?.trim()
        ? current.reviewComment.trim()
        : "");
    if (
      (actionName === "comment" && !comment) ||
      ((actionName === "request-changes" || actionName === "reject") &&
        !effectiveComment)
    ) {
      setValidationError(t("reviewCommentRequired"));
      return;
    }
    setValidationError("");
    try {
      const result = await action.mutateAsync({
        action: actionName,
        ...(effectiveComment ? { comment: effectiveComment } : {}),
      });
      setSelected(result);
      setReviewComment("");
      setConfirmingArchive(false);
      setMoreActionsOpen(false);
      setShowActionSuccess(true);
    } catch {
      // Mutation error is displayed in the modal.
    }
  }

  function openDocument(document: ProjectDocumentSummary) {
    create.reset();
    update.reset();
    upload.reset();
    action.reset();
    resetPreview();
    setSelected(document);
    setSelectedVersionNumber(null);
    setShowActionSuccess(false);
    setMoreActionsOpen(false);
    setConfirmingArchive(false);
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
    resetPreview();
    setSelected(null);
    setSelectedVersionNumber(null);
    setShowActionSuccess(false);
    setMoreActionsOpen(false);
    setConfirmingArchive(false);
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
            {visibleList !== undefined && (
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

        {visibleList !== undefined && !listAccessLost && (list.isFetching || list.isRefetchError) && (
          <div>
            {list.isFetching && <UpdatingStatus>{common("loading")}</UpdatingStatus>}
            {list.isRefetchError && (
              <BackgroundRefreshError
                retryLabel={common("retry")}
                onRetry={() => void list.refetch()}
              >
                {common("updateFailed")}
              </BackgroundRefreshError>
            )}
          </div>
        )}
        {list.isPending && !visibleList ? (
          <div
            role="status"
            aria-label={common("loading")}
            className="space-y-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-16 motion-safe:animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : list.isError && !visibleList ? (
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
        ) : visibleList?.data.length ? (
          <div className="space-y-4">
            {reviewableDocuments.length > 0 && (
              <div
                role="region"
                aria-label={t("reviewQueueBannerLabel")}
                className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50/75 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/30 dark:bg-brand-500/10"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-brand-900 dark:text-brand-200">
                    {t("reviewQueueTitle", {
                      count: reviewableDocuments.length,
                    })}
                  </p>
                  <p className="text-xs text-brand-800 dark:text-brand-300">
                    {t("reviewQueueDescription")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {filter !== "PENDING_REVIEW" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilter("PENDING_REVIEW");
                        setPage(1);
                      }}
                    >
                      {t("filterPendingReview")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openDocument(reviewableDocuments[0])}
                  >
                    {t("reviewNextDocument")}
                  </Button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full min-w-[44rem] border-collapse text-start text-sm">
                <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {t("titleLabel")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("typeLabel")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("statusLabel")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("versionLabel")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("updatedLabel")}
                    </th>
                    <th className="px-4 py-3 text-end font-semibold">
                      {t("actionsLabel")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                  {visibleList.data.map((document) => (
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
                      <td className="px-4 py-3 text-end">
                        {document.permissions.canReview ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openDocument(document)}
                          >
                            {t("reviewAction")}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openDocument(document)}
                          >
                            {t("viewAction")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        {visibleList && visibleList.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
            <span className="text-gray-500 tabular-nums dark:text-gray-400">
              {common("pagination.total", {
                count: visibleList.pagination.totalItems,
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
                disabled={page >= visibleList.pagination.totalPages}
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
        className={`overflow-hidden border border-gray-200 shadow-theme-lg dark:border-gray-800 ${
          isCreating || isEditing
            ? "mx-3 max-w-2xl rounded-xl"
            : "max-md:mx-0 max-md:h-dvh max-md:w-full max-md:rounded-none md:mx-4 md:max-w-5xl md:rounded-2xl"
        }`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-dialog-title"
          onKeyDown={trapDialogFocus}
          className={`flex flex-col overflow-hidden ${
            isCreating || isEditing
              ? "max-h-[min(90vh,54rem)]"
              : "max-md:h-dvh md:max-h-[min(90vh,54rem)]"
          }`}
        >
          <div className="shrink-0 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0 flex-1">
              {!isCreating && !isEditing && (current || (!detailAccessLost && selected)) && (
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("documentEyebrow", {
                    type: t(`type.${(current ?? selected)!.type}`),
                  })}
                </p>
              )}
              <h2
                id="document-dialog-title"
                className="text-lg sm:text-xl font-semibold tracking-tight break-words text-gray-900 dark:text-white/95"
              >
                {isCreating
                  ? t("formTitleNew")
                  : isEditing
                    ? t("formTitleEdit")
                    : (current?.title ?? (detailAccessLost ? undefined : selected?.title) ?? t("open"))}
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[viewedVersion?.status ?? current.status]}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[viewedVersion?.status ?? current.status]}`}
                    />
                    {t(`status.${viewedVersion?.status ?? current.status}`)}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    v{viewedVersion?.version ?? current.version}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-gray-200/80 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {t(`type.${current.type}`)}
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                    {t("created", {
                      date: format.dateTime(
                        new Date(viewedVersion?.createdAt ?? current.createdAt),
                        {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        },
                      ),
                    })}
                  </span>
                </div>
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
          ) : detail.isPending && !current ? (
            <div
              role="status"
              className="p-6 text-sm text-gray-500 dark:text-gray-400"
            >
              {common("loading")}
            </div>
          ) : detail.isError && !current ? (
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
              {!detailAccessLost && detail.isFetching && <UpdatingStatus>{common("loading")}</UpdatingStatus>}
              {!detailAccessLost && detail.isRefetchError && (
                <BackgroundRefreshError
                  retryLabel={common("retry")}
                  onRetry={() => void detail.refetch()}
                >
                  {common("updateFailed")}
                </BackgroundRefreshError>
              )}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                {showActionSuccess && action.isSuccess && (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50/90 px-4 py-2.5 text-sm text-success-800 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400" />
                      <span className="font-medium">{t("actionSuccess")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowActionSuccess(false)}
                      aria-label={t("close")}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-success-700 hover:bg-success-100 dark:text-success-300 dark:hover:bg-success-500/20"
                    >
                      <CloseLineIcon className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                )}
                {validationError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                  >
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
                {action.isError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                  >
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span>
                      {action.error instanceof Error
                        ? action.error.message
                        : t("permissionDenied")}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                  {/* Left Column (~60%): Document Content, Attachment, Description, Leader Review Decision */}
                  <div className="space-y-5 lg:col-span-7">
                    {isViewingHistoricalVersion && viewedVersion && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50/75 px-3.5 py-2.5 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                        <span className="font-semibold">
                          {t("viewingHistoricalVersion", {
                            version: viewedVersion.version,
                            status: t(`status.${viewedVersion.status}`),
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            resetPreview();
                            setSelectedVersionNumber(null);
                          }}
                        >
                          {t("returnToLatestVersion", {
                            version: current.version,
                          })}
                        </Button>
                      </div>
                    )}

                    {current.status === "DRAFT" &&
                      current.permissions.canSubmit && (
                        <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                          <p className="font-semibold">
                            {t("draftBannerTitle")}
                          </p>
                          <p className="mt-0.5 text-brand-800 dark:text-brand-300">
                            {t("draftBannerDescription")}
                          </p>
                        </div>
                      )}

                    {current.status === "CHANGES_REQUESTED" && (
                      <div className="space-y-2 rounded-xl border border-warning-200 bg-warning-50/80 px-4 py-3 text-xs text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                        <div>
                          <p className="font-semibold">
                            {t("changesRequestedBannerTitle")}
                          </p>
                          <p className="mt-0.5 text-warning-800 dark:text-warning-300">
                            {t("changesRequestedBannerDescription")}
                          </p>
                        </div>
                        {current.reviewComment && (
                          <div className="rounded-lg border border-warning-200/80 bg-white/80 px-3 py-2 text-xs text-warning-950 dark:border-warning-500/20 dark:bg-gray-950/60 dark:text-warning-100">
                            <span className="font-semibold">
                              {t("reviewComment")}:
                            </span>{" "}
                            {current.reviewComment}
                          </div>
                        )}
                      </div>
                    )}

                    {current.status === "REJECTED" && (
                      <div className="space-y-2 rounded-xl border border-error-200 bg-error-50/80 px-4 py-3 text-xs text-error-900 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-200">
                        <div>
                          <p className="font-semibold">
                            {t("rejectedBannerTitle")}
                          </p>
                          <p className="mt-0.5 text-error-800 dark:text-error-300">
                            {t("rejectedBannerDescription")}
                          </p>
                        </div>
                        {current.reviewComment && (
                          <div className="rounded-lg border border-error-200/80 bg-white/80 px-3 py-2 text-xs text-error-950 dark:border-error-500/20 dark:bg-gray-950/60 dark:text-error-100">
                            <span className="font-semibold">
                              {t("reviewComment")}:
                            </span>{" "}
                            {current.reviewComment}
                          </div>
                        )}
                      </div>
                    )}

                    {current.status === "PENDING_REVIEW" &&
                      !current.permissions.canReview && (
                        <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                          <p className="font-semibold">
                            {current.permissions.canConfigure
                              ? t("selfReviewRestrictedTitle")
                              : t("pendingLeaderReviewTitle")}
                          </p>
                          <p className="mt-0.5 text-brand-800 dark:text-brand-300">
                            {current.permissions.canConfigure
                              ? t("selfReviewRestrictedDescription")
                              : t("pendingLeaderReviewDescription")}
                          </p>
                        </div>
                      )}

                    {/* Document Content Section */}
                    <section
                      aria-labelledby="detail-document-content-heading"
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          id="detail-document-content-heading"
                          className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                          <DocsIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                          {t("contentLabel")}
                        </h3>
                        <span className="text-xs font-medium text-gray-400 tabular-nums dark:text-gray-500">
                          v{viewedVersion?.version ?? current.version}
                        </span>
                      </div>
                      <div className="rounded-xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/70">
                        {activeContent ? (
                          <div className="text-sm leading-7 break-words whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                            {activeContent}
                          </div>
                        ) : (
                          <p className="text-xs italic text-gray-500 dark:text-gray-400">
                            {t("noTextContent")}
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Attachment Section */}
                    <section
                      aria-labelledby="detail-attachment-heading"
                      className="space-y-2"
                    >
                      <h3
                        id="detail-attachment-heading"
                        className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {t("attachmentHeading")}
                      </h3>
                      {activeFile ? (
                        <div className="space-y-3 rounded-xl border border-gray-200/90 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/60">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 uppercase ring-1 ring-brand-600/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/20">
                                {getFileTypeBadge(
                                  activeFile.name,
                                  activeFile.contentType,
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                                  {activeFile.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                  {getFileTypeBadge(
                                    activeFile.name,
                                    activeFile.contentType,
                                  )}{" "}
                                  · {formatFileSize(activeFile.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={toggleFilePreview}
                                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/80 px-3 text-xs font-semibold text-brand-700 shadow-theme-xs transition-colors hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                {previewState.open
                                  ? t("hidePreviewAction")
                                  : t("previewAction")}
                              </button>
                              <a
                                aria-label={t("downloadFile", {
                                  name: activeFile.name,
                                })}
                                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file${isViewingHistoricalVersion && viewedVersion ? `?version=${viewedVersion.version}` : ""}`}
                              >
                                <DownloadIcon className="h-3.5 w-3.5" />
                                {t("downloadAction")}
                              </a>
                            </div>
                          </div>

                          <DocumentFilePreviewModal
                            isOpen={previewState.open}
                            onClose={resetPreview}
                            fileName={activeFile.name}
                            contentType={activeFile.contentType}
                            fileSize={activeFile.size}
                            fetchBlob={() =>
                              workNotesApi.downloadDocumentFile(
                                projectId,
                                current.id,
                                isViewingHistoricalVersion && viewedVersion
                                  ? viewedVersion.version
                                  : undefined,
                              )
                            }
                            downloadUrl={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file${isViewingHistoricalVersion && viewedVersion ? `?version=${viewedVersion.version}` : ""}`}
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                          {t("noAttachment")}
                        </div>
                      )}
                    </section>

                    {/* Description Section */}
                    <section
                      aria-labelledby="detail-description-heading"
                      className="space-y-2"
                    >
                      <h3
                        id="detail-description-heading"
                        className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {t("descriptionLabel")}
                      </h3>
                      <div className="rounded-xl border border-gray-200/80 bg-gray-50/40 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
                        {current.description?.trim() ? (
                          <p className="break-words whitespace-pre-wrap">
                            {current.description}
                          </p>
                        ) : (
                          <p className="text-xs italic text-gray-500 dark:text-gray-400">
                            {t("noDescription")}
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Leader Review Decision Panel (only when canReview is true) */}
                    {current.permissions.canReview &&
                      !isViewingHistoricalVersion && (
                        <section
                          aria-labelledby="leader-review-panel-heading"
                          className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3
                                id="leader-review-panel-heading"
                                className="text-sm font-semibold text-gray-900 dark:text-white/90"
                              >
                                {t("leaderReviewPanelTitle")}
                              </h3>
                              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                                {t("leaderReviewPanelDescription")}
                              </p>
                            </div>
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[current.status]}`}
                            >
                              {t(`status.${current.status}`)}
                            </span>
                          </div>
                          <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <span className="flex flex-wrap items-center justify-between gap-1">
                              <span>{t("reviewComment")}</span>
                              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                {t("reviewCommentHint")}
                              </span>
                            </span>
                            <textarea
                              value={reviewComment}
                              onChange={(event) => {
                                setReviewComment(event.target.value);
                                setValidationError("");
                              }}
                              placeholder={t("reviewCommentPlaceholder")}
                              rows={3}
                              maxLength={5000}
                              className={`${FIELD_CLASS} resize-y bg-white dark:bg-gray-950`}
                            />
                          </label>
                          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t("sendCommentHint")}
                            </p>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                disabled={!reviewComment.trim()}
                                isLoading={action.isPending}
                                onClick={() => void runAction("comment")}
                              >
                                {t("sendComment")}
                              </Button>
                            </div>
                          </div>
                        </section>
                      )}
                  </div>

                  {/* Right Column (~40%): Document Information, Interactive Version History, Review Activity Timeline */}
                  <aside className="space-y-5 lg:col-span-5">
                    {/* Document Information Card */}
                    <section
                      aria-labelledby="detail-doc-info-heading"
                      className="rounded-xl border border-gray-200/90 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/50"
                    >
                      <h3
                        id="detail-doc-info-heading"
                        className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {t("documentInfoHeading")}
                      </h3>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <div>
                          <dt className="text-gray-500 dark:text-gray-400">
                            {t("statusLabel")}
                          </dt>
                          <dd className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[viewedVersion?.status ?? current.status]}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[viewedVersion?.status ?? current.status]}`}
                              />
                              {t(
                                `status.${viewedVersion?.status ?? current.status}`,
                              )}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 dark:text-gray-400">
                            {t("versionLabel")}
                          </dt>
                          <dd className="mt-1 font-semibold text-gray-900 tabular-nums dark:text-white/90">
                            v{viewedVersion?.version ?? current.version}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 dark:text-gray-400">
                            {t("typeLabel")}
                          </dt>
                          <dd className="mt-1 font-medium text-gray-800 dark:text-gray-200">
                            {t(`type.${current.type}`)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 dark:text-gray-400">
                            {t("createdDateLabel")}
                          </dt>
                          <dd className="mt-1 font-medium text-gray-800 tabular-nums dark:text-gray-200">
                            {format.dateTime(new Date(current.createdAt), {
                              dateStyle: "medium",
                              timeZone: "UTC",
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 dark:text-gray-400">
                            {t("createdByLabel")}
                          </dt>
                          <dd className="mt-1 flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                            <UserCircleIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">
                              {resolveActorLabel(current.createdBy, "author")}
                            </span>
                          </dd>
                        </div>
                        {current.reviewedBy && (
                          <div>
                            <dt className="text-gray-500 dark:text-gray-400">
                              {t("reviewedByLabel")}
                            </dt>
                            <dd className="mt-1 flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                              <UserCircleIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                              <span className="truncate">
                                {resolveActorLabel(
                                  current.reviewedBy,
                                  "reviewer",
                                )}
                              </span>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    {/* Interactive Version History */}
                    <section
                      aria-labelledby="detail-version-history-heading"
                      className="rounded-xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          id="detail-version-history-heading"
                          className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                          {t("history")}
                        </h3>
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                          {current.versions.length}
                        </span>
                      </div>
                      <ol className="mt-3 space-y-2">
                        {sortedVersions.map((version) => {
                          const isSelected =
                            (viewedVersion?.version ?? current.version) ===
                            version.version;
                          const lifecycleLabel =
                            version.version === latestApprovedVersion
                              ? t("latestApprovedVersion")
                              : version.version === current.version &&
                                  version.status === "DRAFT"
                                ? t("currentDraftVersion")
                                : version.version === current.version &&
                                    version.status === "PENDING_REVIEW"
                                  ? t("currentPendingVersion")
                                  : version.version === current.version
                                    ? t("currentVersionBadge")
                                    : version.status === "APPROVED"
                                      ? t("supersededApprovedVersion")
                                      : t("previousVersionBadge");
                          return (
                            <li key={version.version}>
                              <div
                                className={`rounded-xl border p-3 transition-colors ${
                                  isSelected
                                    ? "border-brand-300 bg-brand-50/50 ring-1 ring-brand-500/15 dark:border-brand-500/40 dark:bg-brand-500/10"
                                    : "border-gray-100 bg-gray-50/40 hover:border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:border-gray-700"
                                }`}
                              >
                                <button
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => {
                                    resetPreview();
                                    setSelectedVersionNumber(
                                      version.version === current.version
                                        ? null
                                        : version.version,
                                    );
                                  }}
                                  className="w-full text-start focus-visible:outline-2 focus-visible:outline-brand-500"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-gray-900 dark:text-white/90">
                                      {t("version", {
                                        version: version.version,
                                      })}{" "}
                                      · {t(`status.${version.status}`)}
                                    </span>
                                    <time className="text-gray-500 tabular-nums dark:text-gray-400">
                                      {format.dateTime(
                                        new Date(version.createdAt),
                                        {
                                          dateStyle: "medium",
                                          timeZone: "UTC",
                                        },
                                      )}
                                    </time>
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span
                                      className={
                                        version.version ===
                                        latestApprovedVersion
                                          ? "font-medium text-success-700 dark:text-success-400"
                                          : "font-medium text-gray-600 dark:text-gray-300"
                                      }
                                    >
                                      {lifecycleLabel}
                                    </span>
                                    <span>
                                      {t("editedByActor", {
                                        actor: resolveActorLabel(
                                          version.editedBy,
                                          "author",
                                        ),
                                      })}
                                    </span>
                                  </div>
                                </button>
                                {version.file &&
                                  version.version !== current.version && (
                                    <div className="mt-2 border-t border-gray-200/70 pt-2 dark:border-gray-800">
                                      <a
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 underline hover:text-brand-800 dark:text-brand-300"
                                        href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file?version=${version.version}`}
                                      >
                                        <DownloadIcon className="h-3 w-3" />
                                        {t("downloadVersion", {
                                          version: version.version,
                                          name: version.file.name,
                                        })}
                                      </a>
                                    </div>
                                  )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </section>

                    {/* Review Activity Timeline */}
                    <section
                      aria-labelledby="detail-review-activity-heading"
                      className="rounded-xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60"
                    >
                      <h3
                        id="detail-review-activity-heading"
                        className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {t("reviewActivityHeading")}
                      </h3>
                      {current.reviewHistory.length > 0 ||
                      Boolean(current.submittedAt) ? (
                        <ol className="relative ms-2 mt-3 space-y-4 border-s border-gray-200 ps-4 dark:border-gray-700">
                          {current.submittedAt &&
                            !current.reviewHistory.some(
                              (e) =>
                                e.action === "PENDING_REVIEW" && !e.comment,
                            ) && (
                              <li className="relative text-xs">
                                <span className="absolute -start-[21px] top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-2 ring-white dark:bg-brand-500/20 dark:text-brand-300 dark:ring-gray-900">
                                  <PaperPlaneIcon className="h-2.5 w-2.5" />
                                </span>
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white/90">
                                    <span>{t("timelineSubmitted")}</span>
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                                      v{viewedVersion?.version ?? current.version}
                                    </span>
                                  </span>
                                  <time className="text-gray-500 tabular-nums dark:text-gray-400">
                                    {format.dateTime(
                                      new Date(current.submittedAt),
                                      {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                        timeZone: "UTC",
                                      },
                                    )}
                                  </time>
                                </div>
                                <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                                  {t("submittedByActor", {
                                    actor: resolveActorLabel(
                                      current.createdBy,
                                      "author",
                                    ),
                                  })}
                                </p>
                              </li>
                            )}
                          {current.reviewHistory.map((event, index) => {
                            const nodeColor =
                              event.action === "APPROVED"
                                ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300"
                                : event.action === "CHANGES_REQUESTED"
                                  ? "bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-300"
                                  : event.action === "REJECTED"
                                    ? "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300"
                                    : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300";
                            return (
                              <li
                                key={`${event.at}-${index}`}
                                className="relative text-xs"
                              >
                                <span
                                  className={`absolute -start-[21px] top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-900 ${nodeColor}`}
                                >
                                  {event.action === "APPROVED" ? (
                                    <CheckLineIcon className="h-2.5 w-2.5" />
                                  ) : event.action === "PENDING_REVIEW" ? (
                                    <ChatIcon className="h-2.5 w-2.5" />
                                  ) : (
                                    <InfoIcon className="h-2.5 w-2.5" />
                                  )}
                                </span>
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white/90">
                                    <span>
                                      {event.action === "PENDING_REVIEW" &&
                                      event.comment
                                        ? t("timelineReviewComment")
                                        : t(`status.${event.action}`)}
                                    </span>
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                                      v{viewedVersion?.version ?? current.version}
                                    </span>
                                  </span>
                                  <time className="text-gray-500 tabular-nums dark:text-gray-400">
                                    {format.dateTime(new Date(event.at), {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                      timeZone: "UTC",
                                    })}
                                  </time>
                                </div>
                                <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                                  {t("reviewedByActor", {
                                    actor: resolveActorLabel(
                                      event.reviewerId,
                                      "reviewer",
                                    ),
                                  })}
                                </p>
                                {event.comment && (
                                  <div className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2 text-xs break-words whitespace-pre-wrap text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
                                    {event.comment}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="mt-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                          {t("noReviewActivity")}
                        </p>
                      )}
                    </section>
                  </aside>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900/90">
                {confirmingArchive ? (
                  <div
                    role="alertdialog"
                    aria-label={t("archiveConfirmTitle")}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white/90">
                        {t("archiveConfirmTitle")}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {t("archiveConfirmDescription")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingArchive(false)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        isLoading={action.isPending}
                        onClick={() => void runAction("archive")}
                      >
                        {t("confirmArchive")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex flex-wrap items-center gap-2.5">
                      <span className="hidden text-xs font-medium text-gray-500 sm:inline dark:text-gray-400">
                        {current.permissions.canReview
                          ? t("reviewDecisionMode")
                          : current.permissions.canEdit ||
                              current.permissions.canSubmit
                            ? t("authorDraftMode")
                            : t("readOnlyViewMode")}
                      </span>
                      {canArchiveDocument && (
                        <div className="relative">
                          <button
                            type="button"
                            aria-expanded={moreActionsOpen}
                            onClick={() =>
                              setMoreActionsOpen((prev) => !prev)
                            }
                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 shadow-theme-xs transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <MoreDotIcon className="h-4 w-4 text-gray-400" />
                            {t("moreActions")}
                          </button>
                          {moreActionsOpen && (
                            <div className="absolute bottom-full start-0 z-20 mb-2 min-w-40 rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
                              <button
                                type="button"
                                onClick={() => {
                                  setMoreActionsOpen(false);
                                  setConfirmingArchive(true);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-medium text-error-600 transition-colors hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                              >
                                <TrashBinIcon className="h-3.5 w-3.5" />
                                {t("archive")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
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
                            setShowActionSuccess(false);
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
                      {current.permissions.canReview &&
                        !isViewingHistoricalVersion && (
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
                      {!current.permissions.canReview &&
                        !current.permissions.canSubmit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={requestCloseModal}
                          >
                            {t("close")}
                          </Button>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </main>
  );
}
