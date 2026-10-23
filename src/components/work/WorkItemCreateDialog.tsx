"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from"react";
import { useTranslations } from"next-intl";
import { CloseLineIcon } from"@/icons";
import Button from"@/components/ui/button/Button";
import { Modal } from"@/components/ui/modal";
import { PREVIEW_PEOPLE } from"./work-preview-data";
import { MonoIcon, MonoIssueTypeIcon } from"./WorkMonoIcons";
import type {
  CreatePreviewWorkItem,
  WorkItemType,
  WorkPerson,
  WorkPriority,
} from"./work-types";

const UNASSIGNED_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "UN",
};

export default function WorkItemCreateDialog({
  isOpen,
  people,
  onClose,
  onCreate,
  isPreview = false,
}: {
  isOpen: boolean;
  people?: readonly WorkPerson[];
  onClose: () => void;
  onCreate: (item: CreatePreviewWorkItem) => void | boolean | Promise<void | boolean>;
  isPreview?: boolean;
}) {
  const t = useTranslations("work");
  const availablePeople = people ?? PREVIEW_PEOPLE;
  const assigneeChoices =
    people !== undefined
      ? [
          UNASSIGNED_PERSON,
          ...availablePeople.filter((p) => p.id !== UNASSIGNED_PERSON.id),
        ]
      : availablePeople;
  const defaultAssignee = availablePeople[0] ?? UNASSIGNED_PERSON;
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<WorkItemType>("TASK");
  const [priority, setPriority] = useState<WorkPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState(defaultAssignee.id);
  const [dueDate, setDueDate] = useState("");
  const [createAnother, setCreateAnother] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const effectiveAssigneeId = assigneeChoices.some(
    (person) => person.id === assigneeId,
  )
    ? assigneeId
    : defaultAssignee.id;

  useEffect(() => {
    if (isOpen) titleRef.current?.focus();
  }, [isOpen]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !=="Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setValidationError(t("titleRequired"));
      titleRef.current?.focus();
      return;
    }

    const assignee =
      assigneeChoices.find((person) => person.id === effectiveAssigneeId) ??
      defaultAssignee;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await onCreate({
        title: normalizedTitle,
        type,
        priority,
        assignee,
        dueDate: dueDate || null,
        description: description.trim() || undefined,
      });
      if (result === false) {
        setSubmitError("Could not create the work item. Your entries are still here; please retry.");
        return;
      }
    } catch {
      setSubmitError("Could not create the work item. Your entries are still here; please retry.");
      return;
    } finally {
      setSubmitting(false);
    }
    setTitle("");
    setDescription("");
    setType("TASK");
    setPriority("MEDIUM");
    setAssigneeId(defaultAssignee.id);
    setDueDate("");
    setValidationError("");
    if (createAnother) {
      titleRef.current?.focus();
    } else {
      onClose();
    }
  }

  const selectedAssignee =
    assigneeChoices.find((p) => p.id === effectiveAssigneeId) ??
    defaultAssignee;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25"
      showCloseButton={false}
      className="mx-4 max-w-xl p-0 shadow-theme-lg !rounded-none [&_*]:!rounded-none"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-create-title"
        aria-describedby="work-create-description"
        onKeyDown={trapDialogFocus}
        className="relative"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 pe-24 sm:px-6 dark:border-gray-800">
          <div>
            <h2
              id="work-create-title"
              className="text-lg font-semibold text-gray-900 dark:text-white/90"
            >
              {t("createDialogTitle")}
            </h2>
            <p
              id="work-create-description"
              className="mt-1 text-sm text-gray-500 dark:text-gray-400"
            >
              {t(isPreview ? "createDialogHint" : "createDialogHintLive")}
            </p>
          </div>
          <div className="absolute end-4 top-4 flex items-center gap-1.5">
            {/* Jira Cloud Compact / Expanded Full Mode Toggle (`22` vs `48-global-create-modal-expanded-full.png`) */}
            <button
              type="button"
              onClick={() => setIsCompactMode((prev) => !prev)}
              title={
                isCompactMode
                  ?"Expand full create form"
                  :"Switch to compact quick-create"
              }
              aria-pressed={isCompactMode}
              className="flex h-9 cursor-pointer items-center justify-center border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {isCompactMode ?"↙↗ Full":"↘↖ Compact"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("closeDialog")}
              className="flex h-9 w-9 cursor-pointer items-center justify-center text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <CloseLineIcon className="h-5 w-5"aria-hidden="true"/>
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
          {isPreview && (
            <div className="border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              {t("createPreviewNotice")}
            </div>
          )}

          <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("summaryLabel")} <span className="text-error-600">*</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (event.target.value.trim()) setValidationError("");
              }}
              maxLength={160}
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                validationError ?"work-title-error": undefined
              }
              placeholder={t("summaryPlaceholder")}
              className="h-11 border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
            {validationError && (
              <span
                id="work-title-error"
                className="text-xs font-normal text-error-600 dark:text-error-400"
              >
                {validationError}
              </span>
            )}
          </label>

          {/* Jira Cloud Quick Pill Selectors Bar (`22-global-create-modal.png`) */}
          <div
            aria-label="Quick field pills"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="inline-flex items-center gap-1.5 border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <MonoIcon
                name="user"
                className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
              />
              <span>{selectedAssignee.name}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <MonoIssueTypeIcon
                type="EPIC"
                className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400"
              />
              <span>Epic 1: Core Workspace UI</span>
            </span>
            <span className="inline-flex items-center gap-1.5 border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <MonoIcon
                name="sync"
                className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
              />
              <span>SCRUM Sprint 1</span>
            </span>
            <span className="inline-flex items-center gap-1 border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <span>=</span>
              <span>{t(`priorities.${priority}`)}</span>
            </span>
          </div>

          {!isCompactMode && (
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("description")}
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add acceptance criteria or engineering context…"
                className="border border-gray-200 bg-white px-3.5 py-2 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              />
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("type")}
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as WorkItemType)
                }
                className="h-11 cursor-pointer border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <option value="TASK">{t("types.TASK")}</option>
                <option value="BUG">{t("types.BUG")}</option>
                <option value="STORY">{t("types.STORY")}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("priority")}
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as WorkPriority)
                }
                className="h-11 cursor-pointer border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <option value="HIGH">{t("priorities.HIGH")}</option>
                <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                <option value="LOW">{t("priorities.LOW")}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("assignee")}
              <select
                value={effectiveAssigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="h-11 cursor-pointer border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                {assigneeChoices.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("dueDate")}
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                aria-describedby="work-due-date-hint"
                className="h-11 cursor-pointer border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              />
              <span
                id="work-due-date-hint"
                className="text-xs font-normal text-gray-500 dark:text-gray-400"
              >
                {t("dueDateHint")}
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={createAnother}
                onChange={(e) => setCreateAnother(e.target.checked)}
                className="h-4 w-4 border-gray-300 text-brand-600"
              />
              <span>Create another</span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {submitting ? t("creatingTask") : t(isPreview ? "addToPreview" : "addTask")}
              </Button>
            </div>
            {submitError && (
              <p role="alert" className="text-sm text-error-600 dark:text-error-400">
                {submitError}
              </p>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}
