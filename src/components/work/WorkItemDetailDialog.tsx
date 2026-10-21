"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { CloseLineIcon, TaskIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import { PREVIEW_PEOPLE } from "./work-preview-data";
import { WorkPriorityLabel, WorkStatusBadge } from "./WorkStatusBadge";
import {
  WORK_STATUS_ORDER,
  type WorkItem,
  type WorkPerson,
  type WorkPriority,
  type WorkStatus,
} from "./work-types";

type ActivityTab = "all" | "comments" | "history" | "worklog";

export default function WorkItemDetailDialog({
  item,
  onClose,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onToggleSubtask,
  onAddSubtask,
  onAddComment,
}: {
  item: WorkItem | null;
  onClose: () => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onAssigneeChange?: (id: string, assignee: WorkPerson) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onAddSubtask?: (itemId: string, summary: string) => void;
  onAddComment?: (itemId: string, text: string) => void;
}) {
  const t = useTranslations("work");
  const locale = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [branchCreated, setBranchCreated] = useState(false);
  const [commitCopied, setCommitCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [watching, setWatching] = useState(true);
  const [activityTab, setActivityTab] = useState<ActivityTab>("all");
  const [aiEnhancedDesc, setAiEnhancedDesc] = useState<string | null>(null);
  const [worklogs, setWorklogs] = useState<
    { id: string; author: string; timeSpent: string; note: string }[]
  >([
    {
      id: "wl-1",
      author: "Minh Anh",
      timeSpent: "2h 30m",
      note: "Implemented initial service boundary and integration test cases.",
    },
  ]);
  const [worklogTime, setWorklogTime] = useState("");
  const [worklogNote, setWorklogNote] = useState("");
  const [automationRan, setAutomationRan] = useState(false);

  useEffect(() => {
    if (item) {
      closeButtonRef.current?.focus();
    }
  }, [item]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
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

  function handleAddSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !onAddSubtask) return;
    const trimmed = subtaskInput.trim();
    if (!trimmed) return;
    onAddSubtask(item.id, trimmed);
    setSubtaskInput("");
    setAddingSubtask(false);
  }

  function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !onAddComment) return;
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    onAddComment(item.id, trimmed);
    setCommentInput("");
  }

  function handleAddWorklog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!worklogTime.trim()) return;
    setWorklogs((current) => [
      ...current,
      {
        id: `wl-${Date.now()}`,
        author: PREVIEW_PEOPLE[0].name,
        timeSpent: worklogTime.trim(),
        note: worklogNote.trim() || "Logged engineering progress.",
      },
    ]);
    setWorklogTime("");
    setWorklogNote("");
  }

  function handleImproveTaskWithAi() {
    if (!item) return;
    const base = item.description ?? t("noDescription");
    setAiEnhancedDesc(
      `${base}\n\n✨ AI Copilot Acceptance Criteria (Given/When/Then):\n• Given an authenticated MEMBER in project ${item.projectName}\n• When executing ${item.key} (${item.title})\n• Then RBAC permissions, source citations, and RFC-7807 error contracts are strictly verified.`,
    );
  }

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25"
      showCloseButton={false}
      className={`mx-3 overflow-hidden p-0 shadow-theme-lg ${
        isMaximized ? "max-h-[96vh] max-w-7xl" : "max-h-[92vh] max-w-6xl"
      }`}
    >
      {item && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-detail-title"
          aria-describedby="work-detail-description"
          onKeyDown={trapDialogFocus}
          className="max-h-[92vh] overflow-y-auto rounded-3xl"
        >
          <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7 dark:border-gray-800">
            <div className="min-w-0">
              <nav
                aria-label={t("detailBreadcrumb")}
                className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
              >
                <span className="inline-flex items-center gap-1.5">
                  <TaskIcon
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 text-brand-500"
                    aria-hidden="true"
                  />
                  {item.projectName}
                </span>
                {item.parent && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      ⚡ {item.parent.key}
                    </span>
                  </>
                )}
                <span aria-hidden="true">/</span>
                <span className="font-medium text-brand-600 dark:text-brand-400">
                  {item.key}
                </span>
              </nav>
              <p
                id="work-detail-description"
                className="mt-1 text-xs text-gray-500 dark:text-gray-400"
              >
                {t("detailPreviewHint")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* Watch Counter Toggle */}
              <button
                type="button"
                onClick={() => setWatching((prev) => !prev)}
                title="Watch issue"
                className={`inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition ${
                  watching
                    ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                }`}
              >
                <span>👁</span>
                <span>{watching ? 2 : 1}</span>
              </button>

              {/* Maximize / Full Page View Toggle */}
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? "Restore modal size" : "Full page view"}
                className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 sm:inline-flex dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                ⛶
              </button>

              {/* Close Modal Button */}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t("closeDetails")}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <CloseLineIcon
                  viewBox="0 0 17 16"
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </button>
            </div>
          </header>

          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {/* Left Main Content */}
            <main className="min-w-0 space-y-6 px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <WorkStatusBadge status={item.status} />
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {t(`types.${item.type}`)}
                  </span>
                  {item.labels?.map((lbl) => (
                    <span
                      key={lbl}
                      className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    >
                      #{lbl}
                    </span>
                  ))}
                </div>

                {/* ✨ Improve Task AI Copilot Button */}
                <button
                  type="button"
                  onClick={handleImproveTaskWithAi}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300"
                >
                  <span>✨</span> Improve Task
                </button>
              </div>

              <h2
                id="work-detail-title"
                className="text-xl font-semibold leading-7 text-gray-900 sm:text-2xl dark:text-white/90"
              >
                {item.title}
              </h2>

              <section
                aria-labelledby="work-detail-description-heading"
                className="space-y-3"
              >
                <h3
                  id="work-detail-description-heading"
                  className="text-sm font-semibold text-gray-800 dark:text-gray-200"
                >
                  {t("description")}
                </h3>
                <p className="whitespace-pre-line rounded-lg border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                  {aiEnhancedDesc ?? item.description ?? t("noDescription")}
                </p>
              </section>

              {/* Child Work Items / Subtasks Section */}
              <section
                aria-labelledby="work-detail-subtasks-heading"
                className="space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3
                    id="work-detail-subtasks-heading"
                    className="text-sm font-semibold text-gray-800 dark:text-gray-200"
                  >
                    {t("subtasks")}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t("subtaskProgress", {
                      completed: item.subtasks.completed,
                      total: item.subtasks.total,
                    })}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                  role="progressbar"
                  aria-label={t("subtasks")}
                  aria-valuemin={0}
                  aria-valuemax={item.subtasks.total}
                  aria-valuenow={item.subtasks.completed}
                >
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{
                      width: `${
                        item.subtasks.total === 0
                          ? 0
                          : (item.subtasks.completed / item.subtasks.total) *
                            100
                      }%`,
                    }}
                  />
                </div>

                {item.subtaskItems && item.subtaskItems.length > 0 && (
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                    {item.subtaskItems.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                      >
                        <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={sub.done}
                            onChange={() =>
                              onToggleSubtask?.(item.id, sub.id)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-brand-600"
                          />
                          <span className="font-semibold text-brand-600 dark:text-brand-400">
                            {sub.key}
                          </span>
                          <span
                            className={`truncate ${
                              sub.done
                                ? "line-through text-gray-400 dark:text-gray-500"
                                : "text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {sub.summary}
                          </span>
                        </label>
                        <WorkStatusBadge status={sub.status} />
                      </li>
                    ))}
                  </ul>
                )}

                {onAddSubtask &&
                  (addingSubtask ? (
                    <form
                      onSubmit={handleAddSubtask}
                      className="flex items-center gap-2"
                    >
                      <input
                        value={subtaskInput}
                        onChange={(event) =>
                          setSubtaskInput(event.target.value)
                        }
                        placeholder="Add child work item summary…"
                        className="h-8 flex-1 rounded-lg border border-brand-300 bg-white px-3 text-xs text-gray-900 outline-none dark:border-brand-500 dark:bg-gray-950 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSubtask(false);
                          setSubtaskInput("");
                        }}
                        className="h-8 cursor-pointer rounded-lg px-2 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSubtask(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      + Add a child work item
                    </button>
                  ))}
              </section>

              {/* Activity & Comments Stream with 4 Tabs (All, Comments, History, Work log) */}
              <section
                aria-labelledby="work-detail-activity-heading"
                className="space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id="work-detail-activity-heading"
                    className="text-sm font-semibold text-gray-800 dark:text-gray-200"
                  >
                    Activity
                  </h3>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs dark:border-gray-800 dark:bg-gray-950">
                    {(
                      [
                        { id: "all", label: "All" },
                        { id: "comments", label: "Comments" },
                        { id: "history", label: "History" },
                        { id: "worklog", label: "Work log" },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActivityTab(tab.id)}
                        className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition ${
                          activityTab === tab.id
                            ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-brand-400"
                            : "text-gray-600 hover:text-gray-900 dark:text-gray-400"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(activityTab === "all" || activityTab === "comments") && (
                  <>
                    {onAddComment && (
                      <form
                        onSubmit={handleAddComment}
                        className="flex items-start gap-2.5"
                      >
                        <input
                          value={commentInput}
                          onChange={(event) =>
                            setCommentInput(event.target.value)
                          }
                          placeholder="Add a comment…"
                          className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                        />
                        <button
                          type="submit"
                          className="h-9 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
                        >
                          Save
                        </button>
                      </form>
                    )}

                    {item.comments && item.comments.length > 0 ? (
                      <ul className="space-y-2.5">
                        {item.comments.map((comment) => (
                          <li
                            key={comment.id}
                            className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-900"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900 dark:text-white/90">
                                {comment.author}
                              </span>
                              <span className="text-gray-400">
                                {comment.createdAt}
                              </span>
                            </div>
                            <p className="mt-1 text-gray-700 dark:text-gray-300">
                              {comment.text}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No comments on this work item yet.
                      </p>
                    )}
                  </>
                )}

                {activityTab === "history" && (
                  <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                    <li className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900">
                      <strong>{item.assignee.name}</strong> updated status to{" "}
                      <strong>{item.status}</strong> • Today
                    </li>
                    <li className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900">
                      <strong>{item.reporter.name}</strong> created work item{" "}
                      <strong>{item.key}</strong>
                    </li>
                  </ul>
                )}

                {activityTab === "worklog" && (
                  <div className="space-y-3">
                    <form
                      onSubmit={handleAddWorklog}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={worklogTime}
                        onChange={(event) => setWorklogTime(event.target.value)}
                        placeholder="Time spent (e.g. 1h 30m)"
                        className="h-8 w-40 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <input
                        value={worklogNote}
                        onChange={(event) => setWorklogNote(event.target.value)}
                        placeholder="Work description…"
                        className="h-8 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
                      >
                        + Log work
                      </button>
                    </form>
                    <ul className="space-y-2 text-xs">
                      {worklogs.map((wl) => (
                        <li
                          key={wl.id}
                          className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
                            <span>{wl.author}</span>
                            <span className="text-brand-600 dark:text-brand-400">
                              ⏱ {wl.timeSpent}
                            </span>
                          </div>
                          <p className="mt-1 text-gray-600 dark:text-gray-300">
                            {wl.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </main>

            {/* Right Details & Integrations Column */}
            <aside className="min-w-0 space-y-4 border-t border-gray-200 bg-gray-50/70 px-5 py-6 sm:px-7 lg:border-s lg:border-t-0 dark:border-gray-800 dark:bg-gray-950/40">
              <section
                aria-labelledby="work-detail-fields-heading"
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <h3
                  id="work-detail-fields-heading"
                  className="mb-4 text-sm font-semibold text-gray-900 dark:text-white/90"
                >
                  {t("details")}
                </h3>
                <dl className="space-y-4">
                  <DetailField label={t("status")}>
                    <div className="flex items-center gap-2">
                      <WorkStatusBadge status={item.status} />
                      {onStatusChange && (
                        <select
                          aria-label="Update work item status"
                          value={item.status}
                          onChange={(event) =>
                            onStatusChange(
                              item.id,
                              event.target.value as WorkStatus,
                            )
                          }
                          className="h-7 cursor-pointer rounded border border-gray-200 bg-transparent px-1.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                          {WORK_STATUS_ORDER.map((st) => (
                            <option key={st} value={st}>
                              {t(`statuses.${st}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </DetailField>

                  <DetailField label={t("assignee")}>
                    <div className="space-y-1.5">
                      <PersonValue person={item.assignee} />
                      {onAssigneeChange && (
                        <select
                          aria-label="Reassign work item"
                          value={item.assignee.id}
                          onChange={(event) => {
                            const nextPerson = PREVIEW_PEOPLE.find(
                              (person) => person.id === event.target.value,
                            );
                            if (nextPerson) {
                              onAssigneeChange(item.id, nextPerson);
                            }
                          }}
                          className="h-7 w-full cursor-pointer rounded border border-gray-200 bg-transparent px-1.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                          {PREVIEW_PEOPLE.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </DetailField>

                  <DetailField label={t("reporter")}>
                    <PersonValue person={item.reporter} />
                  </DetailField>

                  <DetailField label={t("priority")}>
                    <div className="flex items-center gap-2">
                      <WorkPriorityLabel priority={item.priority} />
                      {onPriorityChange && (
                        <select
                          aria-label="Update work item priority"
                          value={item.priority}
                          onChange={(event) =>
                            onPriorityChange(
                              item.id,
                              event.target.value as WorkPriority,
                            )
                          }
                          className="h-7 cursor-pointer rounded border border-gray-200 bg-transparent px-1.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                          <option value="HIGH">{t("priorities.HIGH")}</option>
                          <option value="MEDIUM">
                            {t("priorities.MEDIUM")}
                          </option>
                          <option value="LOW">{t("priorities.LOW")}</option>
                        </select>
                      )}
                    </div>
                  </DetailField>

                  {item.parent && (
                    <DetailField label="Parent">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                        ⚡ {item.parent.key} — {item.parent.summary}
                      </span>
                    </DetailField>
                  )}

                  <DetailField label={t("resolution")}>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t(`resolutions.${item.resolution}`)}
                    </span>
                  </DetailField>

                  <DetailField label={t("project")}>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.projectName}
                    </span>
                  </DetailField>

                  <DetailField label={t("dueDate")}>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.dueDate
                        ? new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          }).format(new Date(`${item.dueDate}T00:00:00.000Z`))
                        : t("noDueDate")}
                    </span>
                  </DetailField>

                  <DetailField label={t("created")}>
                    <time
                      dateTime={item.createdAt}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(item.createdAt))}
                    </time>
                  </DetailField>
                </dl>
              </section>

              {/* Development Accordion Card */}
              <section
                aria-label="Development git actions"
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Development
                </h3>
                <div className="mt-3 space-y-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setBranchCreated(true)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <span>
                      {branchCreated
                        ? `✓ Branch feat/${item.key.toLowerCase()} ready`
                        : "Create git branch"}
                    </span>
                    <span>↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommitCopied(true)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <span>
                      {commitCopied
                        ? `✓ Copied git commit -m "${item.key}: ..."`
                        : "Create commit command"}
                    </span>
                    <span>📋</span>
                  </button>
                </div>
              </section>

              {/* Automation Accordion Card */}
              <section
                aria-label="Automation rules"
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Automation
                  </h3>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                    ACTIVE
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {automationRan
                    ? "✓ Synced status & parent Epic progress via Jira Automation."
                    : "When PR is merged → Automatically transition issue."}
                </p>
                <button
                  type="button"
                  onClick={() => setAutomationRan(true)}
                  className="mt-2.5 w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  ⚡ Run automation check
                </button>
              </section>

              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("detailPreviewNotice")}
              </p>
            </aside>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function PersonValue({ person }: { person: WorkPerson }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
      >
        {person.initials}
      </span>
      <span className="truncate">{person.name}</span>
    </span>
  );
}
