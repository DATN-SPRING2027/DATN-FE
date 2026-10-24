"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from"react";
import { useTranslations } from"next-intl";
import { CloseLineIcon } from"@/icons";
import Button from"@/components/ui/button/Button";
import { Modal } from"@/components/ui/modal";
import { PREVIEW_TASKS } from"./work-notes-preview-data";
import type {
  CreateWorkNoteInput,
  WorkNoteKind,
  WorkNoteMentionCandidate,
  WorkNotesIdentity,
} from"./work-notes-types";

const FIELD_CLASS ="w-full border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

export default function WorkNoteCreateDialog({
  isOpen,
  initialKind,
  currentUser,
  mentionCandidates = [],
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  initialKind: WorkNoteKind;
  currentUser: WorkNotesIdentity;
  mentionCandidates?: readonly WorkNoteMentionCandidate[];
  onClose: () => void;
  onCreate: (note: CreateWorkNoteInput) => void;
}) {
  const t = useTranslations("workNotes");
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [kind, setKind] = useState<WorkNoteKind>(initialKind);
  const [previousInitialKind, setPreviousInitialKind] = useState(initialKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [secondary, setSecondary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [taskKey, setTaskKey] = useState("");
  const [tags, setTags] = useState("");
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  if (initialKind !== previousInitialKind) {
    setPreviousInitialKind(initialKind);
    setKind(initialKind);
  }

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      titleRef.current?.focus();
    } else if (!isOpen && wasOpenRef.current) {
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [initialKind, isOpen]);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !=="Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
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

  function reset() {
    setKind(initialKind);
    setTitle("");
    setBody("");
    setSecondary("");
    setNextStep("");
    setTaskKey("");
    setTags("");
    setSelectedMentionIds([]);
    setError("");
  }

  function toggleMention(userId: string) {
    setSelectedMentionIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function close() {
    reset();
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !body.trim()) {
      setError(t(!cleanTitle ?"validation.titleRequired":"validation.bodyRequired"));
      (!cleanTitle ? titleRef : null)?.current?.focus();
      return;
    }
    const selectedTask = PREVIEW_TASKS.find((task) => task.key === taskKey);
    const isKnowledge = kind ==="KNOWLEDGE";
    onCreate({
      author: currentUser.name,
      initials: currentUser.initials,
      kind,
      title: cleanTitle,
      body: body.trim(),
      ...(selectedTask ? { taskKey: selectedTask.key } : {}),
      ...(kind ==="WORK_UPDATE"&& secondary.trim() ? { blocker: secondary.trim() } : {}),
      ...(kind ==="WEEKLY_SUMMARY"&& secondary.trim() ? { unfinished: secondary.trim() } : {}),
      ...((kind ==="WORK_UPDATE"|| kind ==="WEEKLY_SUMMARY") && nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
      ...(kind ==="DECISION"&& secondary.trim() ? { nextStep: `${t("decisionImpact")}: ${secondary.trim()}` } : {}),
      ...(isKnowledge
        ? {
            tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            knowledgeStatus:"PENDING"as const,
          }
        : {}),
      ...(selectedMentionIds.length > 0 ? { mentionUserIds: selectedMentionIds } : {}),
    });
    reset();
  }

  const bodyLabel =
    kind ==="WORK_UPDATE"? t("form.updateDetails") :
    kind ==="WEEKLY_SUMMARY"? t("form.weeklyHighlights") :
    kind ==="KNOWLEDGE"? t("form.knowledgeContext") : t("form.decisionDetails");
  const bodyHint =
    kind ==="WORK_UPDATE"? t("form.updateHint") :
    kind ==="WEEKLY_SUMMARY"? t("form.weeklyHint") :
    kind ==="KNOWLEDGE"? t("form.knowledgeHint") : t("form.decisionHint");

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25"
      showCloseButton={false}
      className="mx-4 max-h-[min(90vh,48rem)] max-w-2xl overflow-y-auto border border-gray-200 shadow-theme-lg !rounded-none [&_*]:!rounded-none dark:border-gray-800"
    >
      <div ref={dialogRef} role="dialog"aria-modal="true"aria-labelledby="work-note-create-title"onKeyDown={trapFocus}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 pe-14 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 id="work-note-create-title"className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("form.title")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("form.description")}</p>
          </div>
          <button type="button"onClick={close} aria-label={t("closeDialog")} className="absolute end-4 top-3 flex size-9 items-center justify-center text-gray-500 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800">
            <CloseLineIcon aria-hidden="true"className="size-5"/>
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
          <p className="border border-warning-200 bg-warning-50 px-3 py-2.5 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">{t("previewNotice")}</p>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("form.noteType")}
            <select value={kind} onChange={(event) => { setKind(event.target.value as WorkNoteKind); setSecondary(""); setError(""); }} className={FIELD_CLASS}>
              {(["WORK_UPDATE","WEEKLY_SUMMARY","KNOWLEDGE","DECISION"] as const).map((value) => <option key={value} value={value}>{t(`kinds.${value}`)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("form.titleLabel")} <span className="text-error-600">*</span>
            <input ref={titleRef} value={title} maxLength={160} onChange={(event) => { setTitle(event.target.value); setError(""); }} placeholder={t("form.titlePlaceholder")} aria-invalid={Boolean(error && !title.trim())} className={FIELD_CLASS} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {bodyLabel} <span className="text-error-600">*</span>
            <textarea value={body} onChange={(event) => { setBody(event.target.value); setError(""); }} rows={4} placeholder={bodyHint} aria-invalid={Boolean(error && !body.trim())} className={`${FIELD_CLASS} min-h-28 resize-y`} />
            {error && <span role="alert"className="text-xs font-normal text-error-600 dark:text-error-400">{error}</span>}
          </label>

          {kind ==="WORK_UPDATE"&& (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("form.blockerLabel")}<textarea rows={2} value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder={t("form.blockerPlaceholder")} className={`${FIELD_CLASS} resize-y`} /></label>
              <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("form.nextStepLabel")}<textarea rows={2} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder={t("form.nextStepPlaceholder")} className={`${FIELD_CLASS} resize-y`} /></label>
            </div>
          )}
          {kind ==="WEEKLY_SUMMARY"&& (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("form.unfinishedLabel")}<textarea rows={3} value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder={t("form.blockerPlaceholder")} className={`${FIELD_CLASS} resize-y`} /></label>
              <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("form.nextStepLabel")}<textarea rows={3} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder={t("form.nextStepPlaceholder")} className={`${FIELD_CLASS} resize-y`} /></label>
            </div>
          )}
          {kind ==="DECISION"&& (
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("form.impactLabel")}<textarea rows={2} value={secondary} onChange={(event) => setSecondary(event.target.value)} placeholder={t("form.impactPlaceholder")} className={`${FIELD_CLASS} resize-y`} /></label>
          )}
          {kind ==="KNOWLEDGE"&& (
            <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("form.tagsLabel")}<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("form.tagsPlaceholder")} className={FIELD_CLASS} /><span className="text-xs font-normal text-gray-500 dark:text-gray-400">{t("form.tagsHint")}</span></label>
          )}
          {mentionCandidates.length > 0 && (
            <div className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>{t("form.mentionTeammates")}</span>
              <div className="flex flex-wrap gap-1.5">
                {mentionCandidates.map((candidate) => {
                  const selected = selectedMentionIds.includes(candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleMention(candidate.id)}
                      className={`border px-2.5 py-1 text-xs font-medium transition ${
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-300"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      }`}
                    >
                      @{candidate.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("form.linkTask")}
            <select value={taskKey} onChange={(event) => setTaskKey(event.target.value)} className={FIELD_CLASS}>
              <option value="">{t("form.noTask")}</option>
              {PREVIEW_TASKS.map((task) => <option key={task.key} value={task.key}>{task.key} · {task.title}</option>)}
            </select>
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{t("form.taskHint")}</span>
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-gray-800">
            <Button type="button"variant="outline"onClick={close}>{t("cancel")}</Button>
            <Button type="submit"className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">{t("form.savePreview")}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
