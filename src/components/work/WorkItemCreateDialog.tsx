"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { CloseLineIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { PREVIEW_PEOPLE } from "./work-preview-data";
import type { CreatePreviewWorkItem, WorkItemType, WorkPriority } from "./work-types";

export default function WorkItemCreateDialog({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (item: CreatePreviewWorkItem) => void;
}) {
  const t = useTranslations("work");
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkItemType>("TASK");
  const [priority, setPriority] = useState<WorkPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState(PREVIEW_PEOPLE[0].id);
  const [dueDate, setDueDate] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (isOpen) titleRef.current?.focus();
  }, [isOpen]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setValidationError(t("titleRequired"));
      titleRef.current?.focus();
      return;
    }

    const assignee = PREVIEW_PEOPLE.find((person) => person.id === assigneeId);
    if (!assignee) return;
    onCreate({ title: normalizedTitle, type, priority, assignee, dueDate: dueDate || null });
    setTitle("");
    setType("TASK");
    setPriority("MEDIUM");
    setAssigneeId(PREVIEW_PEOPLE[0].id);
    setDueDate("");
    setValidationError("");
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25"
      showCloseButton={false}
      className="mx-4 max-w-xl p-0 shadow-theme-lg"
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
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 pe-14 sm:px-6 dark:border-gray-800">
          <div>
            <h2 id="work-create-title" className="text-lg font-semibold text-gray-900 dark:text-white/90">
              {t("createDialogTitle")}
            </h2>
            <p id="work-create-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("createDialogHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeDialog")}
            className="absolute end-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <CloseLineIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-6">
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
            {t("createPreviewNotice")}
          </div>

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
              aria-describedby={validationError ? "work-title-error" : undefined}
              placeholder={t("summaryPlaceholder")}
              className="h-11 rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
            {validationError && (
              <span id="work-title-error" className="text-xs font-normal text-error-600 dark:text-error-400">
                {validationError}
              </span>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("type")}
              <select value={type} onChange={(event) => setType(event.target.value as WorkItemType)} className="h-11 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                <option value="TASK">{t("types.TASK")}</option>
                <option value="BUG">{t("types.BUG")}</option>
                <option value="STORY">{t("types.STORY")}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("priority")}
              <select value={priority} onChange={(event) => setPriority(event.target.value as WorkPriority)} className="h-11 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                <option value="HIGH">{t("priorities.HIGH")}</option>
                <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                <option value="LOW">{t("priorities.LOW")}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("assignee")}
              <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="h-11 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                {PREVIEW_PEOPLE.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
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
                className="h-11 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              />
              <span id="work-due-date-hint" className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {t("dueDateHint")}
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
            <Button type="button" variant="outline" onClick={onClose} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
              {t("cancel")}
            </Button>
            <Button type="submit" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
              {t("addToPreview")}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
