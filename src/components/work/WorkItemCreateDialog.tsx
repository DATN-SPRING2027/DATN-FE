"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { tr } from "@/i18n/tr";
import { CloseLineIcon } from "@/icons";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import type { Project } from "@/lib/queries/projects/useProjects";
import { PREVIEW_PEOPLE } from "./work-preview-data";
import { MonoIcon, MonoIssueTypeIcon } from "./WorkMonoIcons";
import type {
  CreatePreviewWorkItem,
  WorkItem,
  WorkItemType,
  WorkPerson,
  WorkPriority,
  WorkStatus,
} from "./work-types";

const UNASSIGNED_PERSON_ID = "unassigned";

type ActivePopover =
  | "type"
  | "assignee"
  | "parent"
  | "labels"
  | "dueDate"
  | "priority"
  | "status"
  | "fields"
  | null;

type VisiblePillsState = {
  parent: boolean;
  labels: boolean;
  dueDate: boolean;
  priority: boolean;
  status: boolean;
};

type SlashTemplate = {
  id: string;
  command: string;
  label: string;
  snippet: string;
};

function formatOffsetIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIssueTypeAccent(type: WorkItemType): string {
  if (type === "BUG") {
    return "bg-error-50 text-error-700 border-error-200 dark:bg-error-500/15 dark:text-error-300 dark:border-error-500/30";
  }
  if (type === "STORY") {
    return "bg-success-50 text-success-700 border-success-200 dark:bg-success-500/15 dark:text-success-300 dark:border-success-500/30";
  }
  return "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30";
}

function getPriorityGlyph(priority: WorkPriority): {
  symbol: string;
  tone: string;
} {
  if (priority === "HIGH") {
    return {
      symbol: "↑",
      tone: "text-error-600 dark:text-error-400",
    };
  }
  if (priority === "LOW") {
    return {
      symbol: "↓",
      tone: "text-brand-600 dark:text-brand-400",
    };
  }
  return {
    symbol: "=",
    tone: "text-warning-600 dark:text-warning-400",
  };
}

export default function WorkItemCreateDialog({
  isOpen,
  isPreview = true,
  projectId,
  projectName,
  projectCode,
  projects,
  onProjectChange,
  people,
  currentUserPerson,
  parentCandidates = [],
  existingLabels = [],
  sprints = [],
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  isPreview?: boolean;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  projects?: readonly Project[];
  onProjectChange?: (projectId: string) => void;
  people?: readonly WorkPerson[];
  currentUserPerson?: WorkPerson | null;
  parentCandidates?: readonly Pick<WorkItem, "id" | "key" | "title" | "type">[];
  existingLabels?: readonly string[];
  sprints?: readonly { id: string; name: string }[];
  onClose: () => void;
  onCreate: (item: CreatePreviewWorkItem) => void;
}) {
  const t = useTranslations("work");
  const unassignedLabel = tr(t, "quickUi.unassigned", "Unassigned");
  const unassignedPerson = useMemo<WorkPerson>(
    () => ({
      id: UNASSIGNED_PERSON_ID,
      name: unassignedLabel,
      initials: "UN",
    }),
    [unassignedLabel],
  );

  const availablePeople = people ?? PREVIEW_PEOPLE;
  const assigneeChoices = useMemo<readonly WorkPerson[]>(
    () =>
      people !== undefined
        ? [
          unassignedPerson,
          ...availablePeople.filter((p) => p.id !== UNASSIGNED_PERSON_ID),
        ]
        : availablePeople,
    [availablePeople, people, unassignedPerson],
  );
  const defaultAssignee =
    people !== undefined
      ? unassignedPerson
      : (availablePeople[0] ?? unassignedPerson);

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<WorkItemType>("TASK");
  const [priority, setPriority] = useState<WorkPriority>("MEDIUM");
  const [status, setStatus] = useState<WorkStatus>("TODO");
  const [assigneeId, setAssigneeId] = useState(defaultAssignee.id);
  const [parentId, setParentId] = useState<string>("");
  const [parentQuery, setParentQuery] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [sprintId, setSprintId] = useState("");
  const [createAnother, setCreateAnother] = useState(false);
  const [createdAnotherBanner, setCreatedAnotherBanner] = useState(false);
  const [isExpandedFields, setIsExpandedFields] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [visiblePills, setVisiblePills] = useState<VisiblePillsState>({
    parent: true,
    labels: true,
    dueDate: true,
    priority: true,
    status: false,
  });
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [validationError, setValidationError] = useState("");

  const effectiveAssigneeId = assigneeChoices.some(
    (person) => person.id === assigneeId,
  )
    ? assigneeId
    : defaultAssignee.id;

  const selectedAssignee =
    assigneeChoices.find((p) => p.id === effectiveAssigneeId) ??
    defaultAssignee;

  const canAssignToMe = Boolean(
    currentUserPerson &&
    assigneeChoices.some((person) => person.id === currentUserPerson.id),
  );

  const selectedParent = useMemo(
    () => parentCandidates.find((item) => item.id === parentId) ?? null,
    [parentCandidates, parentId],
  );

  const filteredParents = useMemo(() => {
    const q = parentQuery.trim().toLowerCase();
    if (!q) return parentCandidates;
    return parentCandidates.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q),
    );
  }, [parentCandidates, parentQuery]);

  const suggestedLabels = useMemo(() => {
    const defaults = ["frontend", "backend", "ui-ux", "api", "urgent"];
    return Array.from(new Set([...existingLabels, ...defaults])).slice(0, 12);
  }, [existingLabels]);

  const slashTemplates = useMemo<readonly SlashTemplate[]>(
    () => [
      {
        id: "acceptance",
        command: "/criteria",
        label: tr(t, "quickUi.slashAcceptance", "Acceptance criteria"),
        snippet:
          "### Acceptance Criteria\n- [ ] Given \n- [ ] When \n- [ ] Then ",
      },
      {
        id: "bug",
        command: "/bug",
        label: tr(t, "quickUi.slashBugSteps", "Bug reproduction steps"),
        snippet:
          "### Steps to Reproduce\n1. \n2. \n\n**Expected:** \n**Actual:** ",
      },
      {
        id: "checklist",
        command: "/checklist",
        label: tr(t, "quickUi.slashChecklist", "Action checklist"),
        snippet: "- [ ] Step 1\n- [ ] Step 2\n- [ ] Verify & test",
      },
      {
        id: "code",
        command: "/code",
        label: tr(t, "quickUi.slashCodeBlock", "Code snippet"),
        snippet: "```\n\n```",
      },
    ],
    [t],
  );

  const matchingSlashTemplates = useMemo(() => {
    if (slashQuery === null) return [];
    const normalized = slashQuery.trim().toLowerCase();
    if (!normalized) return slashTemplates;
    return slashTemplates.filter(
      (tpl) =>
        tpl.command.slice(1).includes(normalized) ||
        tpl.label.toLowerCase().includes(normalized),
    );
  }, [slashQuery, slashTemplates]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      titleRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!isOpen || !activePopover) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && dialogRef.current && !dialogRef.current.contains(target)) {
        setActivePopover(null);
      } else if (
        target instanceof Element &&
        !target.closest("[data-create-popover-zone]")
      ) {
        setActivePopover(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [activePopover, isOpen]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (slashQuery !== null) {
        event.stopPropagation();
        setSlashQuery(null);
        return;
      }
      if (activePopover !== null) {
        event.stopPropagation();
        setActivePopover(null);
        return;
      }
      if (isDocked) {
        onClose();
        return;
      }
    }
    if (event.key !== "Tab" || isDocked) return;
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

  function applySlashTemplate(template: SlashTemplate) {
    const el = descriptionRef.current;
    const cursor = el?.selectionStart ?? description.length;
    const before = description.slice(0, cursor);
    const after = description.slice(cursor);
    const replacedBefore = before.replace(
      /(?:^|\n)\/[a-zA-Z0-9_-]*$/,
      (match) =>
        match.startsWith("\n") ? `\n${template.snippet}` : template.snippet,
    );
    const nextValue =
      replacedBefore !== before
        ? `${replacedBefore}${after}`
        : description
          ? `${description}\n${template.snippet}`
          : template.snippet;
    setDescription(nextValue);
    setSlashQuery(null);
    setSlashIndex(0);
    requestAnimationFrame(() => {
      descriptionRef.current?.focus();
    });
  }

  function handleDescriptionChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextVal = event.target.value;
    setDescription(nextVal);
    const cursor = event.target.selectionStart ?? nextVal.length;
    const beforeCursor = nextVal.slice(0, cursor);
    const slashMatch = beforeCursor.match(/(?:^|\n)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1] ?? "");
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }
  }

  function addLabelToken(raw: string) {
    const cleaned = raw.trim().replace(/\s+/g, "-").slice(0, 40);
    if (!cleaned) return;
    setLabels((prev) => {
      if (prev.includes(cleaned) || prev.length >= 20) return prev;
      return [...prev, cleaned];
    });
    setLabelInput("");
  }

  function toggleLabelToken(token: string) {
    setLabels((prev) =>
      prev.includes(token)
        ? prev.filter((item) => item !== token)
        : prev.length < 20
          ? [...prev, token]
          : prev,
    );
  }

  function performSubmit() {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setValidationError(t("titleRequired"));
      titleRef.current?.focus();
      return;
    }

    const assignee =
      assigneeChoices.find((person) => person.id === effectiveAssigneeId) ??
      defaultAssignee;

    const normalizedStart = startDate || null;
    const normalizedDue = dueDate || null;
    const safeStartDate =
      normalizedStart && normalizedDue && normalizedStart > normalizedDue
        ? normalizedDue
        : normalizedStart;

    onCreate({
      title: normalizedTitle,
      type,
      priority,
      status,
      assignee,
      dueDate: normalizedDue,
      startDate: safeStartDate,
      parentId: selectedParent ? selectedParent.id : null,
      labels: labels.length > 0 ? labels : undefined,
      sprintId: sprintId || null,
      description: description.trim() || undefined,
      keepDialogOpen: createAnother,
    });

    setTitle("");
    setDescription("");
    setValidationError("");
    setActivePopover(null);
    setSlashQuery(null);

    if (createAnother) {
      setCreatedAnotherBanner(true);
      requestAnimationFrame(() => {
        titleRef.current?.focus();
      });
    } else {
      setType("TASK");
      setPriority("MEDIUM");
      setStatus("TODO");
      setAssigneeId(defaultAssignee.id);
      setParentId("");
      setLabels([]);
      setLabelInput("");
      setDueDate("");
      setStartDate("");
      setSprintId("");
      setCreatedAnotherBanner(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    performSubmit();
  }

  function handleComposerShortcut(event: KeyboardEvent<HTMLElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      performSubmit();
    }
  }

  if (!isOpen) return null;

  const badgeCode = (
    projectCode?.trim() ||
    projectName
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 4) ||
    "PRJ"
  ).toUpperCase();
  const displayProjectLabel =
    projectCode?.trim() || projectName?.trim() || "Workspace";
  const priorityMeta = getPriorityGlyph(priority);

  const composerContent = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal={!isDocked}
      aria-labelledby="work-create-title"
      onKeyDown={trapDialogFocus}
      className="relative bg-white text-gray-900 dark:bg-gray-900 dark:text-white"
    >
      <h2 id="work-create-title" className="sr-only">
        {t("createDialogTitle")}
      </h2>

      {/* Top Jira-style Context & Window Bar (`[Project | ☑ Type] ... [◨] [⤢] [✕]`) */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 sm:px-5 dark:border-gray-800">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Project Pill / Switcher */}
          {projects && projects.length > 1 && onProjectChange ? (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-gray-200/80 bg-gray-50/80 px-2 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <span className="inline-flex h-4 items-center justify-center rounded-xs bg-brand-600 px-1 font-mono text-[10px] font-bold text-white">
                {badgeCode.slice(0, 4)}
              </span>
              <select
                aria-label="Target project"
                value={projectId ?? projects[0]?.id ?? ""}
                onChange={(e) => onProjectChange(e.target.value)}
                className="max-w-40 cursor-pointer truncate bg-transparent text-xs font-semibold text-gray-800 outline-none dark:bg-gray-800 dark:text-gray-100"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.code ? `${proj.code} — ${proj.name}` : proj.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span
              title={projectName || displayProjectLabel}
              className="inline-flex max-w-52 items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200"
            >
              <span className="inline-flex h-4 shrink-0 items-center justify-center rounded-xs bg-brand-600 px-1 font-mono text-[10px] font-bold text-white">
                {badgeCode.slice(0, 4)}
              </span>
              <span className="truncate">
                {projectName || displayProjectLabel}
              </span>
            </span>
          )}

          <span
            aria-hidden="true"
            className="h-4 w-px bg-gray-200 dark:bg-gray-700"
          />

          {/* Issue Type Selector Pill (Jira `☑ Task ▾`) */}
          <div className="relative" data-create-popover-zone>
            <button
              type="button"
              aria-label={t("type")}
              aria-haspopup="listbox"
              aria-expanded={activePopover === "type"}
              onClick={() => {
                if (isMinimized) setIsMinimized(false);
                setActivePopover((cur) => (cur === "type" ? null : "type"));
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition ${getIssueTypeAccent(type)}`}
            >
              <MonoIssueTypeIcon type={type} className="h-3.5 w-3.5 shrink-0" />
              <span>{t(`types.${type}`)}</span>
              <span aria-hidden="true" className="text-[10px] opacity-75">
                ▾
              </span>
            </button>

            {activePopover === "type" && (
              <div
                role="listbox"
                aria-label={t("type")}
                className="absolute start-0 top-full z-40 mt-1 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                {(["TASK", "BUG", "STORY"] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    role="option"
                    aria-selected={type === candidate}
                    onClick={() => {
                      setType(candidate);
                      setActivePopover(null);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-xs font-medium transition ${type === candidate
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <MonoIssueTypeIcon
                        type={candidate}
                        className="h-3.5 w-3.5"
                      />
                      <span>{t(`types.${candidate}`)}</span>
                    </span>
                    {type === candidate && (
                      <MonoIcon name="check" className="h-3.5 w-3.5" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Window Controls (`[-]`, `[◨ Dock]`, `[⤢ Expand]`, `[✕ Close]`) */}
        <div className="flex shrink-0 items-center gap-1">
          {isDocked && (
            <button
              type="button"
              onClick={() => setIsMinimized((prev) => !prev)}
              aria-label={isMinimized ? "Restore draft" : "Minimize draft"}
              title={isMinimized ? "Restore draft" : "Minimize draft"}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <span aria-hidden="true" className="text-sm font-bold">
                {isMinimized ? "▢" : "—"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsDocked((prev) => !prev);
              setIsMinimized(false);
            }}
            aria-pressed={isDocked}
            aria-label={
              isDocked
                ? tr(t, "quickUi.undockComposer", "Center dialog")
                : tr(t, "quickUi.dockComposer", "Dock to corner")
            }
            title={
              isDocked
                ? tr(t, "quickUi.undockComposer", "Center dialog")
                : tr(t, "quickUi.dockComposer", "Dock to corner")
            }
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition ${isDocked
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              }`}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
              <rect
                x="7.5"
                y="7.5"
                width="5"
                height="4.5"
                fill="currentColor"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMinimized(false);
              setIsExpandedFields((prev) => !prev);
            }}
            aria-pressed={isExpandedFields}
            aria-label={
              isExpandedFields
                ? tr(t, "quickUi.collapseQuickForm", "Switch to quick view")
                : tr(t, "quickUi.expandFullForm", "Expand full fields")
            }
            title={
              isExpandedFields
                ? tr(t, "quickUi.collapseQuickForm", "Switch to quick view")
                : tr(t, "quickUi.expandFullForm", "Expand full fields")
            }
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition ${isExpandedFields
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              }`}
          >
            <MonoIcon name="maximize" className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeDialog")}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <CloseLineIcon className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <form onSubmit={submit} className="space-y-3 px-4 py-4 sm:px-6">
          {isPreview && (
            <div className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              {t("createPreviewNotice")}
            </div>
          )}

          {createdAnotherBanner && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-md border border-success-200 bg-success-50 px-3 py-1.5 text-xs font-medium text-success-800 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
            >
              <span className="inline-flex items-center gap-1.5">
                <MonoIcon name="check" className="h-3.5 w-3.5" />
                <span>
                  {tr(
                    t,
                    "quickUi.createdAnotherNotice",
                    "Created work item — ready for the next one.",
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setCreatedAnotherBanner(false)}
                className="cursor-pointer text-xs opacity-75 hover:opacity-100"
              >
                ×
              </button>
            </div>
          )}

          {/* Large Bold Summary Composer (Jira `Summary`) */}
          <div>
            <input
              ref={titleRef}
              aria-label={t("summaryLabel")}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (event.target.value.trim()) setValidationError("");
                if (createdAnotherBanner) setCreatedAnotherBanner(false);
              }}
              onKeyDown={handleComposerShortcut}
              maxLength={isPreview ? 160 : 255}
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                validationError ? "work-title-error" : undefined
              }
              placeholder={t("summaryPlaceholder")}
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-1.5 text-lg font-semibold text-gray-900 outline-none transition placeholder:font-semibold placeholder:text-gray-400 focus:border-brand-300 focus:bg-gray-50/50 focus:px-2.5 sm:text-xl dark:text-white dark:placeholder:text-gray-500 dark:focus:border-brand-500/50 dark:focus:bg-gray-800/40"
            />
            {validationError && (
              <p
                id="work-title-error"
                className="mt-1 px-1 text-xs font-medium text-error-600 dark:text-error-400"
              >
                {validationError}
              </p>
            )}
          </div>

          {/* Description Composer + `/` Slash Quick-Actions Menu */}
          <div className="relative">
            <textarea
              ref={descriptionRef}
              aria-label={t("description")}
              rows={isDocked ? 3 : 4}
              value={description}
              onChange={handleDescriptionChange}
              onKeyDown={(event) => {
                if (
                  slashQuery !== null &&
                  matchingSlashTemplates.length > 0
                ) {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSlashIndex(
                      (prev) => (prev + 1) % matchingSlashTemplates.length,
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSlashIndex(
                      (prev) =>
                        (prev - 1 + matchingSlashTemplates.length) %
                        matchingSlashTemplates.length,
                    );
                    return;
                  }
                  if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    const picked =
                      matchingSlashTemplates[slashIndex] ??
                      matchingSlashTemplates[0];
                    if (picked) applySlashTemplate(picked);
                    return;
                  }
                }
                handleComposerShortcut(event);
              }}
              placeholder={tr(
                t,
                "quickUi.descriptionPlaceholder",
                "Add acceptance criteria or engineering context — or type / for actions",
              )}
              className="w-full resize-y rounded-md border border-transparent bg-transparent px-1 py-1.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-200 focus:bg-gray-50/50 focus:px-2.5 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-gray-700 dark:focus:bg-gray-800/40"
            />

            {/* Floating `/` Quick Templates Menu */}
            {slashQuery !== null && matchingSlashTemplates.length > 0 && (
              <div
                role="listbox"
                aria-label={tr(
                  t,
                  "quickUi.slashMenuTitle",
                  "Quick templates (/)",
                )}
                className="absolute start-0 top-full z-40 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="px-2 py-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                  {tr(t, "quickUi.slashMenuTitle", "Quick templates (/)")}
                </div>
                {matchingSlashTemplates.map((tpl, idx) => (
                  <button
                    key={tpl.id}
                    type="button"
                    role="option"
                    aria-selected={idx === slashIndex}
                    onClick={() => applySlashTemplate(tpl)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-xs transition ${idx === slashIndex
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                  >
                    <span className="font-medium">{tpl.label}</span>
                    <code className="rounded-xs bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {tpl.command}
                    </code>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Label Chips Preview Strip */}
          {labels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {labels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                >
                  <span>#{lbl}</span>
                  <button
                    type="button"
                    aria-label={`Remove label ${lbl}`}
                    onClick={() => toggleLabelToken(lbl)}
                    className="ms-0.5 cursor-pointer text-xs leading-none opacity-75 hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Jira Interactive Quick-Action Pills Bar (`[👤 Assignee] [⚡ Parent] [🏷️ Labels] [📅 Due date] [= Priority]`) */}
          <div
            aria-label="Quick field pills"
            className="flex flex-wrap items-center gap-1.5 pt-2"
          >
            {/* 1. Assignee Pill */}
            <div className="relative" data-create-popover-zone>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={activePopover === "assignee"}
                onClick={() =>
                  setActivePopover((cur) =>
                    cur === "assignee" ? null : "assignee",
                  )
                }
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${selectedAssignee.id !== UNASSIGNED_PERSON_ID
                    ? "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
              >
                <MonoIcon name="user" className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-36 truncate">
                  {selectedAssignee.name}
                </span>
              </button>

              {activePopover === "assignee" && (
                <div className="absolute start-0 bottom-full z-40 mb-1.5 w-56 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  {canAssignToMe && currentUserPerson && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(currentUserPerson.id);
                        setActivePopover(null);
                      }}
                      className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-md border border-brand-200/80 bg-brand-50/70 px-2.5 py-1.5 text-start text-xs font-semibold text-brand-700 transition hover:bg-brand-100/70 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                    >
                      <MonoIcon name="bolt" className="h-3.5 w-3.5" />
                      <span>
                        {tr(t, "quickUi.assignToMe", "Assign to me")} (
                        {currentUserPerson.name})
                      </span>
                    </button>
                  )}
                  <div className="max-h-48 overflow-y-auto">
                    {assigneeChoices.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setAssigneeId(person.id);
                          setActivePopover(null);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-xs transition ${effectiveAssigneeId === person.id
                            ? "bg-gray-100 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/70"
                          }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {person.initials}
                          </span>
                          <span className="truncate">{person.name}</span>
                        </span>
                        {effectiveAssigneeId === person.id && (
                          <MonoIcon name="check" className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Parent Work Item Pill (`⚡ Parent`) */}
            {visiblePills.parent && (
              <div className="relative" data-create-popover-zone>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={activePopover === "parent"}
                  onClick={() =>
                    setActivePopover((cur) =>
                      cur === "parent" ? null : "parent",
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${selectedParent
                      ? "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  <MonoIcon name="bolt" className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-36 truncate">
                    {selectedParent
                      ? selectedParent.key
                      : tr(t, "quickUi.parentPill", "Parent")}
                  </span>
                </button>

                {activePopover === "parent" && (
                  <div className="absolute start-0 bottom-full z-40 mb-1.5 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    <input
                      type="text"
                      value={parentQuery}
                      onChange={(e) => setParentQuery(e.target.value)}
                      placeholder={tr(
                        t,
                        "quickUi.searchParentPlaceholder",
                        "Search parent work item…",
                      )}
                      className="mb-1.5 h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <div className="max-h-44 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setParentId("");
                          setActivePopover(null);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-start text-xs ${!selectedParent
                            ? "bg-gray-100 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/70"
                          }`}
                      >
                        <span>
                          {tr(t, "quickUi.noParent", "No parent (root item)")}
                        </span>
                        {!selectedParent && (
                          <MonoIcon name="check" className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {filteredParents.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => {
                            setParentId(candidate.id);
                            setActivePopover(null);
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-xs ${selectedParent?.id === candidate.id
                              ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                              : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/70"
                            }`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="me-1.5 font-mono font-semibold">
                              {candidate.key}
                            </span>
                            <span>{candidate.title}</span>
                          </span>
                          {selectedParent?.id === candidate.id && (
                            <MonoIcon
                              name="check"
                              className="h-3.5 w-3.5 shrink-0"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Labels Pill (`🏷️ Labels`) */}
            {visiblePills.labels && (
              <div className="relative" data-create-popover-zone>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={activePopover === "labels"}
                  onClick={() =>
                    setActivePopover((cur) =>
                      cur === "labels" ? null : "labels",
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${labels.length > 0
                      ? "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  <MonoIcon name="tag" className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {labels.length > 0
                      ? `${tr(t, "quickUi.labelsPill", "Labels")} (${labels.length})`
                      : tr(t, "quickUi.labelsPill", "Labels")}
                  </span>
                </button>

                {activePopover === "labels" && (
                  <div className="absolute start-0 bottom-full z-40 mb-1.5 w-64 rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addLabelToken(labelInput);
                          }
                        }}
                        placeholder={tr(
                          t,
                          "quickUi.addLabelPlaceholder",
                          "Type a label and press Enter…",
                        )}
                        className="h-8 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => addLabelToken(labelInput)}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand-600 px-2.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {suggestedLabels.map((candidate) => {
                        const active = labels.includes(candidate);
                        return (
                          <button
                            key={candidate}
                            type="button"
                            onClick={() => toggleLabelToken(candidate)}
                            className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${active
                                ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-300"
                                : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              }`}
                          >
                            {active ? `✓ ${candidate}` : candidate}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Due Date Pill (`📅 Due date`) */}
            {visiblePills.dueDate && (
              <div className="relative" data-create-popover-zone>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={activePopover === "dueDate"}
                  onClick={() =>
                    setActivePopover((cur) =>
                      cur === "dueDate" ? null : "dueDate",
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${dueDate
                      ? "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  <MonoIcon name="calendar" className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {dueDate || tr(t, "quickUi.dueDatePill", "Due date")}
                  </span>
                </button>

                {activePopover === "dueDate" && (
                  <div className="absolute start-0 bottom-full z-40 mb-1.5 w-60 rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-2 flex flex-wrap gap-1">
                      {[
                        {
                          label: tr(t, "quickUi.presetToday", "Today"),
                          offset: 0,
                        },
                        {
                          label: tr(t, "quickUi.presetTomorrow", "Tomorrow"),
                          offset: 1,
                        },
                        {
                          label: tr(t, "quickUi.presetNextWeek", "+7 days"),
                          offset: 7,
                        },
                      ].map((preset) => (
                        <button
                          key={preset.offset}
                          type="button"
                          onClick={() => {
                            setDueDate(formatOffsetIsoDate(preset.offset));
                            setActivePopover(null);
                          }}
                          className="cursor-pointer rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="date"
                      aria-label={t("dueDate")}
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                      }}
                      className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    {dueDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setDueDate("");
                          setActivePopover(null);
                        }}
                        className="mt-2 w-full cursor-pointer rounded-md py-1 text-center text-xs font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                      >
                        {tr(t, "quickUi.clearDate", "Clear date")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 5. Priority Pill (`= Priority`) */}
            {visiblePills.priority && (
              <div className="relative" data-create-popover-zone>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={activePopover === "priority"}
                  onClick={() =>
                    setActivePopover((cur) =>
                      cur === "priority" ? null : "priority",
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${priority !== "MEDIUM"
                      ? "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  <span className={`font-bold ${priorityMeta.tone}`}>
                    {priorityMeta.symbol}
                  </span>
                  <span>{t(`priorities.${priority}`)}</span>
                </button>

                {activePopover === "priority" && (
                  <div
                    role="listbox"
                    aria-label={t("priority")}
                    className="absolute start-0 bottom-full z-40 mb-1.5 w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                  >
                    {(["HIGH", "MEDIUM", "LOW"] as const).map((prio) => {
                      const glyph = getPriorityGlyph(prio);
                      return (
                        <button
                          key={prio}
                          type="button"
                          role="option"
                          aria-selected={priority === prio}
                          onClick={() => {
                            setPriority(prio);
                            setActivePopover(null);
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-start text-xs font-medium ${priority === prio
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                            }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className={`font-bold ${glyph.tone}`}>
                              {glyph.symbol}
                            </span>
                            <span>{t(`priorities.${prio}`)}</span>
                          </span>
                          {priority === prio && (
                            <MonoIcon name="check" className="h-3.5 w-3.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 6. Optional Initial Status Pill (`● Status`) */}
            {visiblePills.status && (
              <div className="relative" data-create-popover-zone>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={activePopover === "status"}
                  onClick={() =>
                    setActivePopover((cur) =>
                      cur === "status" ? null : "status",
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${status !== "TODO"
                      ? "border-brand-300 bg-brand-50/80 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  <span className="h-2 w-2 rounded-full bg-brand-500" />
                  <span>{t(`statuses.${status}`)}</span>
                </button>

                {activePopover === "status" && (
                  <div
                    role="listbox"
                    aria-label={tr(
                      t,
                      "quickUi.initialStatusLabel",
                      "Initial status",
                    )}
                    className="absolute start-0 bottom-full z-40 mb-1.5 w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
                  >
                    {(
                      ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        role="option"
                        aria-selected={status === st}
                        onClick={() => {
                          setStatus(st);
                          setActivePopover(null);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-start text-xs font-medium ${status === st
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                          }`}
                      >
                        <span>{t(`statuses.${st}`)}</span>
                        {status === st && (
                          <MonoIcon name="check" className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expanded Advanced Fields Grid (when user toggles `⤢` in top-right) */}
          {isExpandedFields && (
            <div className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 sm:grid-cols-2 dark:border-gray-800 dark:bg-gray-800/30">
              <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                <span>
                  {tr(t, "quickUi.initialStatusLabel", "Initial status")}
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkStatus)}
                  className="h-9 cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="TODO">{t("statuses.TODO")}</option>
                  <option value="IN_PROGRESS">
                    {t("statuses.IN_PROGRESS")}
                  </option>
                  <option value="IN_REVIEW">{t("statuses.IN_REVIEW")}</option>
                  <option value="DONE">{t("statuses.DONE")}</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                <span>{tr(t, "quickUi.startDateLabel", "Start date")}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                />
              </label>

              <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                <span>{t("dueDate")}</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                />
              </label>

              {sprints.length > 0 && (
                <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                  <span>{tr(t, "quickUi.sprintLabel", "Sprint")}</span>
                  <select
                    value={sprintId}
                    onChange={(e) => setSprintId(e.target.value)}
                    className="h-9 cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  >
                    <option value="">
                      {tr(t, "quickUi.noSprint", "No sprint (Backlog)")}
                    </option>
                    {sprints.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Bottom Jira Footer Bar (`[⍈ Configure fields] ... [☐ Create another] [Create]`) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3.5 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="relative" data-create-popover-zone>
                <button
                  type="button"
                  aria-label={tr(
                    t,
                    "quickUi.configureFields",
                    "Configure visible fields",
                  )}
                  title={tr(
                    t,
                    "quickUi.configureFields",
                    "Configure visible fields",
                  )}
                  aria-expanded={activePopover === "fields"}
                  onClick={() =>
                    setActivePopover((cur) =>
                      cur === "fields" ? null : "fields",
                    )
                  }
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  <MonoIcon name="sliders" className="h-3.5 w-3.5" />
                </button>

                {activePopover === "fields" && (
                  <div className="absolute start-0 bottom-full z-40 mb-1.5 w-52 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-1 px-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {tr(
                        t,
                        "quickUi.configureFields",
                        "Configure visible fields",
                      )}
                    </div>
                    {(
                      [
                        {
                          key: "parent",
                          label: tr(t, "quickUi.parentPill", "Parent"),
                        },
                        {
                          key: "labels",
                          label: tr(t, "quickUi.labelsPill", "Labels"),
                        },
                        {
                          key: "dueDate",
                          label: tr(t, "quickUi.dueDatePill", "Due date"),
                        },
                        { key: "priority", label: t("priority") },
                        {
                          key: "status",
                          label: tr(
                            t,
                            "quickUi.initialStatusLabel",
                            "Initial status",
                          ),
                        },
                      ] as const
                    ).map((field) => (
                      <label
                        key={field.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={visiblePills[field.key]}
                          onChange={(e) =>
                            setVisiblePills((prev) => ({
                              ...prev,
                              [field.key]: e.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 accent-brand-600"
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <span className="hidden text-[11px] text-gray-400 sm:inline dark:text-gray-500">
                {tr(t, "quickUi.ctrlEnterHint", "Ctrl + Enter to create")}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 select-none dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={createAnother}
                  onChange={(e) => setCreateAnother(e.target.checked)}
                  className="h-4 w-4 rounded-xs border-gray-300 accent-brand-600"
                />
                <span>{tr(t, "quickUi.createAnother", "Create another")}</span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-9 rounded-md px-3.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  className="h-9 rounded-md px-4 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {isPreview ? t("addToPreview") : t("create")}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  if (isDocked) {
    const dockedComposer = (
      <div
        className={`fixed end-4 bottom-4 z-99999 w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 sm:end-6 sm:bottom-5 dark:border-gray-700 dark:bg-gray-900 ${isExpandedFields
            ? "max-h-[calc(100vh-5rem)] overflow-y-auto"
            : "overflow-visible"
          }`}
      >
        {composerContent}
      </div>
    );
    if (typeof document === "undefined") {
      return dockedComposer;
    }
    return createPortal(dockedComposer, document.body);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="bg-gray-900/20 backdrop-blur-[1px] dark:bg-gray-950/35"
      showCloseButton={false}
      className="mx-4 max-w-2xl overflow-visible rounded-xl p-0 shadow-theme-lg"
    >
      {composerContent}
    </Modal>
  );
}
