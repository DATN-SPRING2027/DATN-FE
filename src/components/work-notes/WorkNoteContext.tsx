"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  Info,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectMemberPage } from "@/lib/queries/projects/project-members.contract";
import {
  fetchProjectTaskDetail,
  type BackendTaskPriority,
  type BackendTaskStatus,
} from "@/lib/queries/tasks/useTasks";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function statusBadgeStyle(status: BackendTaskStatus): {
  pill: string;
  dot: string;
} {
  switch (status) {
    case "IN_PROGRESS":
      return {
        pill: "border-brand-200/80 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300",
        dot: "bg-brand-600 dark:bg-brand-400",
      };
    case "DONE":
      return {
        pill: "border-success-200/80 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-300",
        dot: "bg-success-600 dark:bg-success-400",
      };
    case "IN_REVIEW":
      return {
        pill: "border-purple-200/80 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300",
        dot: "bg-purple-600 dark:bg-purple-400",
      };
    case "BLOCKED":
      return {
        pill: "border-error-200/80 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300",
        dot: "bg-error-600 dark:bg-error-400",
      };
    case "TODO":
    case "CANCELLED":
    default:
      return {
        pill: "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
        dot: "bg-gray-500 dark:bg-gray-400",
      };
  }
}

function priorityBadgeClass(priority: BackendTaskPriority): string {
  switch (priority) {
    case "HIGH":
      return "border-warning-200/80 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-300";
    case "MEDIUM":
      return "border-blue-light-200/80 bg-blue-light-50 text-blue-light-700 dark:border-blue-light-500/30 dark:bg-blue-light-500/15 dark:text-blue-light-300";
    case "LOW":
    default:
      return "border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function formatVietnameseDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = parsed.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function renderInlineTokens(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong
          key={idx}
          className="font-semibold text-gray-900 dark:text-gray-100"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="font-mono rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={idx} className="italic text-gray-800 dark:text-gray-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

function FormattedTaskDescription({ text }: { text: string }) {
  const lines = useMemo(() => text.replace(/\r\n?/g, "\n").split("\n"), [text]);

  return (
    <div className="space-y-1.5 text-xs leading-relaxed break-words text-gray-600 dark:text-gray-300">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={idx} className="h-0.5" aria-hidden="true" />;
        }

        const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
          return (
            <p
              key={idx}
              className="pt-1 text-xs font-bold text-gray-800 first:pt-0 dark:text-gray-100"
            >
              {renderInlineTokens(headingMatch[2])}
            </p>
          );
        }

        const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="min-w-4 shrink-0 font-semibold text-gray-700 dark:text-gray-200">
                {numberedMatch[1]}.
              </span>
              <p className="min-w-0 flex-1">
                {renderInlineTokens(numberedMatch[2])}
              </p>
            </div>
          );
        }

        const bulletMatch = /^[-*•]\s+(.+)$/.exec(trimmed);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500"
              />
              <p className="min-w-0 flex-1">
                {renderInlineTokens(bulletMatch[1])}
              </p>
            </div>
          );
        }

        return <p key={idx}>{renderInlineTokens(trimmed)}</p>;
      })}
    </div>
  );
}

/** Read-only preview of the existing Task API. Provider authority stays on BE. */
export default function WorkNoteContext({
  projectId,
  taskId,
  selection,
  fullContext,
}: {
  projectId: string;
  taskId: string;
  selection: { quote: string } | null;
  fullContext: boolean;
}) {
  const t = useTranslations("workNotes.agent");
  const queryClient = useQueryClient();
  const [descExpanded, setDescExpanded] = useState(false);
  const [scopeExpanded, setScopeExpanded] = useState(false);

  const task = useQuery({
    queryKey: ["worknote-task-context", projectId, taskId],
    queryFn: async ({ signal }) => {
      const value = await fetchProjectTaskDetail(projectId, taskId, signal);
      if (value.id !== taskId || value.projectId !== projectId)
        throw Error("Task scope mismatch");
      return value;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const shortTask = taskId ? `#${taskId.slice(-6).toUpperCase()}` : "—";
  const displayTaskKey =
    task.data && !task.isError && task.data.key?.trim()
      ? task.data.key.trim()
      : shortTask;

  function resolveMemberDisplayName(userId: string): string {
    const cachedPages = queryClient.getQueriesData<ProjectMemberPage>({
      queryKey: ["project-members"],
    });
    for (const [, page] of cachedPages) {
      if (!page?.data) continue;
      const matched = page.data.find(
        (member) => member.projectId === projectId && member.userId === userId,
      );
      if (matched?.user?.fullName?.trim()) {
        return matched.user.fullName.trim();
      }
      if (matched?.user?.email?.trim()) {
        return matched.user.email.split("@")[0] || matched.user.email;
      }
    }
    if (userId && !OBJECT_ID_PATTERN.test(userId)) {
      return userId;
    }
    return t("taskMetaDefaultMember");
  }

  const creatorName =
    task.data && !task.isError
      ? resolveMemberDisplayName(task.data.createdBy)
      : "";
  const creatorInitial = (creatorName.trim()[0] ?? "A").toUpperCase();
  const formattedDueDate =
    task.data && !task.isError ? formatVietnameseDate(task.data.dueDate) : null;

  const rawDescription =
    task.data && !task.isError ? (task.data.description?.trim() ?? "") : "";
  const isLongDescription = useMemo(() => {
    if (!rawDescription) return false;
    const nonEmptyLines = rawDescription
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0).length;
    return rawDescription.length > 220 || nonEmptyLines > 4;
  }, [rawDescription]);

  const steps = task.data && !task.isError ? task.data.steps : [];
  const totalSteps = steps.length;
  const doneSteps = steps.filter((step) => step.done).length;
  const progressPercent =
    totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const scopeItems = [
    t("aiScopeItem1"),
    t("aiScopeItem2"),
    t("aiScopeItem3"),
    t("aiScopeItem4"),
  ];

  const statusStyle =
    task.data && !task.isError ? statusBadgeStyle(task.data.status) : null;

  return (
    <div className="space-y-3">
      {/* Section 1: Thông tin task liên kết */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {t("linkedTaskSectionTitle")}
        </h4>

        <div className="rounded-2xl border border-gray-200/85 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          {/* Top Row: Task Key + Status + Priority Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono inline-flex items-center rounded-md border border-gray-200 bg-gray-100/90 px-2 py-0.5 text-[11px] font-bold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {displayTaskKey}
            </span>

            {task.data && !task.isError && statusStyle && (
              <>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusStyle.pill}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${statusStyle.dot}`}
                  />
                  <span>{t(`taskStatusLabels.${task.data.status}`)}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${priorityBadgeClass(
                    task.data.priority,
                  )}`}
                >
                  <Flag className="size-2.5" aria-hidden="true" />
                  <span>{t(`taskPriorityLabels.${task.data.priority}`)}</span>
                </span>
              </>
            )}
          </div>

          {task.isPending && (
            <p
              role="status"
              className="mt-2.5 text-xs text-gray-500 dark:text-gray-400"
            >
              {t("contextLoading")}
            </p>
          )}

          {task.isError && (
            <div
              role="alert"
              className="mt-2.5 space-y-2 text-xs text-error-700 dark:text-error-300"
            >
              <p>{t("contextLoadFailed")}</p>
              <button
                type="button"
                onClick={() => void task.refetch()}
                disabled={task.isFetching}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                {t("contextReload")}
              </button>
            </div>
          )}

          {task.data && !task.isError && (
            <>
              {/* Task Title */}
              <p className="mt-2.5 text-[13px] leading-snug font-bold text-gray-900 dark:text-gray-100">
                {task.data.title}
              </p>

              {/* Compact 1-Line Creator + Due Date Bar */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                  <span
                    aria-hidden="true"
                    className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[9px] font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
                  >
                    {creatorInitial}
                  </span>
                  <span className="truncate">{creatorName}</span>
                </span>

                <span
                  aria-hidden="true"
                  className="text-gray-300 dark:text-gray-600"
                >
                  •
                </span>

                <span className="inline-flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                  <Calendar
                    className="size-3 shrink-0 text-gray-400 dark:text-gray-500"
                    aria-hidden="true"
                  />
                  <span>
                    {formattedDueDate
                      ? t("taskDuePrefix", { date: formattedDueDate })
                      : t("taskMetaNoDueDate")}
                  </span>
                </span>
              </div>

              {/* Formatted Markdown Description + Expand/Collapse (No nested scrollbar) */}
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                <h5 className="mb-1.5 text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {t("taskDescriptionHeading")}
                </h5>

                {rawDescription ? (
                  <div>
                    <div
                      className={
                        isLongDescription && !descExpanded
                          ? "relative max-h-28 overflow-hidden"
                          : ""
                      }
                    >
                      <FormattedTaskDescription text={rawDescription} />
                      {isLongDescription && !descExpanded && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-gray-900 dark:via-gray-900/85"
                        />
                      )}
                    </div>

                    {isLongDescription && (
                      <button
                        type="button"
                        aria-expanded={descExpanded}
                        onClick={() => setDescExpanded((prev) => !prev)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <span>
                          {t(
                            descExpanded
                              ? "taskDescriptionCollapse"
                              : "taskDescriptionExpand",
                          )}
                        </span>
                        {descExpanded ? (
                          <ChevronUp className="size-3" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="size-3" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("contextNoDescription")}
                  </p>
                )}
              </div>

              {/* Clean Checklist Section with Progress Bar & ✓ / ○ Icons */}
              {totalSteps > 0 && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                      {t("taskChecklistHeading")}
                    </h5>
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {t("taskChecklistProgress", {
                        done: doneSteps,
                        total: totalSteps,
                      })}
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={t("taskChecklistHeading")}
                    aria-valuenow={doneSteps}
                    aria-valuemin={0}
                    aria-valuemax={totalSteps}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                  >
                    <div
                      style={{ width: `${progressPercent}%` }}
                      className={`h-full rounded-full transition-all ${
                        doneSteps === totalSteps
                          ? "bg-success-500"
                          : "bg-brand-600 dark:bg-brand-500"
                      }`}
                    />
                  </div>

                  <ul className="space-y-1.5 pt-0.5 text-xs">
                    {steps.map((step) => (
                      <li
                        key={step.id}
                        className="flex items-start gap-2 leading-snug"
                      >
                        {step.done ? (
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-success-200 bg-success-100 text-success-700 dark:border-success-500/35 dark:bg-success-500/20 dark:text-success-300"
                          >
                            <Check className="size-2.5" strokeWidth={3} />
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
                          />
                        )}
                        <span className="sr-only">
                          {t(step.done ? "stepDone" : "stepOpen")}{" "}
                        </span>
                        <span
                          className={`min-w-0 flex-1 break-words ${
                            step.done
                              ? "text-gray-500 dark:text-gray-400"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {step.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Section 2: Collapsible 1-Line AI Scope Accordion */}
      <div className="rounded-2xl border border-gray-200/85 bg-gray-50/75 dark:border-gray-800 dark:bg-gray-900/70">
        <button
          type="button"
          aria-expanded={scopeExpanded}
          title={t("aiScopeTooltip")}
          onClick={() => setScopeExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-start transition-colors hover:bg-gray-100/70 dark:hover:bg-gray-800/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">
              {t("aiScopeSectionTitle")}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 shadow-2xs dark:bg-gray-800 dark:text-gray-300">
              {t("aiScopeSummaryBadge", { count: scopeItems.length })}
            </span>
            <ChevronDown
              className={`size-3.5 text-gray-400 transition-transform ${
                scopeExpanded ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </span>
        </button>

        {scopeExpanded && (
          <div className="space-y-2.5 border-t border-gray-200/75 px-3.5 pt-2.5 pb-3 dark:border-gray-800">
            <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-200">
              {scopeItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p className="flex items-start gap-1.5 rounded-xl bg-brand-50/70 px-2.5 py-2 text-[11px] leading-relaxed text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <Info
                className="mt-0.5 size-3.5 shrink-0 text-brand-600 dark:text-brand-400"
                aria-hidden="true"
              />
              <span>{t("aiScopeNotice")}</span>
            </p>
          </div>
        )}

        {selection && (
          <div className="border-t border-gray-200/75 px-3.5 py-2.5 dark:border-gray-800">
            <blockquote
              aria-label={t("selectedSource")}
              className="max-h-24 overflow-auto rounded-lg border-l-2 border-brand-400 bg-white py-1.5 pr-2.5 pl-2.5 text-[11px] break-words whitespace-pre-wrap text-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
            >
              {selection.quote}
            </blockquote>
          </div>
        )}

        {/* Accessible active request scope & verification boundary metadata */}
        <p className="sr-only">
          {t(
            selection
              ? fullContext
                ? "scopeSelectionFull"
                : "scopeSelection"
              : "scopeWhole",
          )}{" "}
          {t("contextEvidence")}
        </p>
      </div>
    </div>
  );
}
