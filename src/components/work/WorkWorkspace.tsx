"use client";

import { useEffect, useMemo, useRef, useState } from"react";
import { useTranslations } from"next-intl";
import { ApiError } from"@/lib/api-client";
import { useCurrentUserQuery } from"@/lib/queries/auth/useAuth";
import { useProjectMembersAllQuery } from"@/lib/queries/projects/useProjectMembers";
import { useProjectQuery, type Project } from"@/lib/queries/projects/useProjects";
import ProjectState from"@/components/projects/ProjectState";
import Button from"@/components/ui/button/Button";
import { Modal } from"@/components/ui/modal";
import { PlusIcon } from"@/icons";
import WorkNotesWorkspace from"@/components/work-notes/WorkNotesWorkspace";
import WorkAiCopilotDialog from"./WorkAiCopilotDialog";
import WorkBoardView from"./WorkBoardView";
import WorkCalendarView from"./WorkCalendarView";
import WorkDevelopmentView from"./WorkDevelopmentView";
import WorkDocsView from"./WorkDocsView";
import WorkFormsView from"./WorkFormsView";
import WorkItemCreateDialog from"./WorkItemCreateDialog";
import WorkItemDetailDialog from"./WorkItemDetailDialog";
import WorkListView from"./WorkListView";
import WorkOverviewView from"./WorkOverviewView";
import WorkPageHeader, { type WorkView } from"./WorkPageHeader";
import WorkReportsView from"./WorkReportsView";
import WorkTimelineView from"./WorkTimelineView";
import WorkToolbar from"./WorkToolbar";
import { formatWorklogMinutes, parseWorklogMinutes } from "./worklog-duration";
import {
  INITIAL_PREVIEW_WORK_ITEMS,
  PREVIEW_PEOPLE,
} from"./work-preview-data";
import {
  WORK_STATUS_ORDER,
  type CreatePreviewWorkItem,
  type WorkFilterCondition,
  type WorkFilterField,
  type WorkFilterOperator,
  type WorkGroupBy,
  type WorkItem,
  type WorkItemGroup,
  type WorkPerson,
  type WorkPriority,
  type WorkStatus,
  type WorkSubtaskItem,
} from"./work-types";
import { getCalendarMonthStart } from"./work-calendar-utils";
import {
  type BackendTask,
  type BackendTaskComment,
  type BackendTaskStatus,
  type BackendTaskWorklog,
  createProjectTaskApi,
  createTaskCommentApi,
  createTaskWorklogApi,
  fetchProjectTaskDetail,
  fetchTaskComments,
  fetchTaskHistory,
  fetchTaskWorklogs,
  type BackendTaskHistoryEvent,
  transitionProjectTaskApi,
  updateProjectTaskApi,
  useProjectTasksQuery,
} from"@/lib/queries/tasks/useTasks";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
async function fetchAllTaskComments(projectId: string, taskId: string) {
  const items: BackendTaskComment[] = [];
  let afterId: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await fetchTaskComments(projectId, taskId, undefined, afterId);
    items.push(...page.items);
    if (!page.nextAfterId || seen.has(page.nextAfterId)) break;
    seen.add(page.nextAfterId);
    afterId = page.nextAfterId;
  } while (afterId);
  return { items };
}

async function fetchAllTaskWorklogs(projectId: string, taskId: string) {
  const items: BackendTaskWorklog[] = [];
  let afterId: string | undefined;
  let totalMinutes = 0;
  const seen = new Set<string>();
  do {
    const page = await fetchTaskWorklogs(projectId, taskId, undefined, afterId);
    items.push(...page.items);
    totalMinutes = page.totalMinutes;
    if (!page.nextAfterId || seen.has(page.nextAfterId)) break;
    seen.add(page.nextAfterId);
    afterId = page.nextAfterId;
  } while (afterId);
  return { items, totalMinutes };
}

async function fetchAllTaskHistory(projectId: string, taskId: string) {
  const events: BackendTaskHistoryEvent[] = [];
  let page = 1;
  while (true) {
    const response = await fetchTaskHistory(projectId, taskId, page);
    events.push(...response.data);
    if (!response.pagination.hasNext) return events;
    page += 1;
  }
}
const UNASSIGNED_WORK_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "UN",
};

function mapTaskHistory(event: BackendTaskHistoryEvent) {
  const action = event.type === "TASK_CREATED"
    ? "created the work item"
    : event.type === "TASK_STATUS_TRANSITIONED"
      ? `changed status from ${event.fromStatus ?? "?"} to ${event.toStatus ?? "?"}`
      : event.type === "TASK_UPDATED"
        ? `updated ${event.changedFields?.join(", ") || "the work item"}`
        : event.type === "TASK_COMMENT_ADDED"
          ? "added a comment"
          : "logged work";
  return {
    id: event.id,
    author: event.actor?.fullName ?? "System",
    action,
    createdAt: formatCommentDateTime(event.occurredAt),
  };
}

function mapVisibleTaskHistory(events: readonly BackendTaskHistoryEvent[]) {
  return events
    .filter(
      (event) =>
        event.type !== "TASK_COMMENT_ADDED" &&
        event.type !== "TASK_WORKLOG_ADDED",
    )
    .map(mapTaskHistory);
}

function describeMutationError(error: unknown): string {
  if (error instanceof ApiError) {
    const reason = error.code ?? `HTTP ${error.status}`;
    return `${reason}: ${error.message}`;
  }
  return "The server did not accept the change. Please retry.";
}

function toPersonInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function formatCommentDateTime(value: string | Date): string {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/.test(value.trim())
  ) {
    return value.trim();
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export { formatWorklogMinutes, parseWorklogMinutes } from "./worklog-duration";

function mapBackendStatusToWorkStatus(status: BackendTaskStatus): WorkStatus {
  if (status === "CANCELLED") return "CANCELLED";
  if (status ==="IN_PROGRESS" || status === "BLOCKED") return status;
  if (status ==="IN_REVIEW") return"IN_REVIEW";
  if (status ==="DONE") return"DONE";
  return"TODO";
}

function resolvePersonById(
  personId: string | null,
  peopleById: ReadonlyMap<string, WorkPerson>,
  currentUser?: { id: string; name: string } | null,
  isRealProject = false,
): WorkPerson {
  if (!personId || personId === UNASSIGNED_WORK_PERSON.id) {
    return isRealProject ? UNASSIGNED_WORK_PERSON : PREVIEW_PEOPLE[0];
  }
  const fromProjectMembers = peopleById.get(personId);
  if (fromProjectMembers) {
    return fromProjectMembers;
  }
  if (currentUser && currentUser.id === personId) {
    return {
      id: currentUser.id,
      name: currentUser.name,
      initials: toPersonInitials(currentUser.name) || "ME",
    };
  }
  if (isRealProject) {
    return {
      id: personId,
      name: `Member ${personId.slice(-4)}`,
      initials: "MB",
    };
  }
  const found = PREVIEW_PEOPLE.find((p) => p.id === personId);
  if (found) return found;
  const fallbackIdx =
    parseInt(personId.slice(-2) ||"0", 16) % PREVIEW_PEOPLE.length;
  return PREVIEW_PEOPLE[fallbackIdx] ?? PREVIEW_PEOPLE[0];
}

export default function WorkWorkspace({
  projectId,
  project: projectProp,
  projects,
  onProjectChange,
  view: controlledView,
  onViewChange,
  embedded = false,
  hideProjectBanner = false,
}: {
  projectId: string;
  project?: Project;
  projects?: readonly Project[];
  onProjectChange?: (projectId: string) => void;
  view?: WorkView;
  onViewChange?: (view: WorkView) => void;
  embedded?: boolean;
  hideProjectBanner?: boolean;
}) {
  const t = useTranslations("work");
  const user = useCurrentUserQuery();
  const organizationId = projectProp?.organizationId ?? user.data?.organizationId ??"";
  const project = useProjectQuery(projectProp ?"": organizationId, projectId);
  const resolvedProject = projectProp ?? project.data;
  const [internalView, setInternalView] = useState<WorkView>(controlledView ??"list");
  const view = controlledView ?? internalView;
  const [fullPageWorkItemId, setFullPageWorkItemId] = useState<string | null>(null);
  const [fullPageSubtaskId, setFullPageSubtaskId] = useState<string | null>(null);
  const setView = (nextView: WorkView) => {
    setFullPageWorkItemId(null);
    setFullPageSubtaskId(null);
    setInternalView(nextView);
    onViewChange?.(nextView);
  };
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getCalendarMonthStart(new Date()),
  );
  const isRealProject = OBJECT_ID_PATTERN.test(projectId);
  const [items, setItems] = useState<WorkItem[]>(() =>
    isRealProject ? [] : [...INITIAL_PREVIEW_WORK_ITEMS],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkStatus |"ALL">("ALL");
  const [priority, setPriority] = useState<WorkPriority |"ALL">("ALL");
  const [assigneeId, setAssigneeId] = useState<string |"ALL">("ALL");
  const [groupBy, setGroupBy] = useState<WorkGroupBy>("NONE");
  const [filterConditions, setFilterConditions] = useState<WorkFilterCondition[]>([]);
  const [hideDone, setHideDone] = useState(false);
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [highlightHighPriority, setHighlightHighPriority] = useState(false);
  const [highlightDoneRows, setHighlightDoneRows] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelConfirmationIds, setCancelConfirmationIds] = useState<string[] | null>(null);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeWorkItemId, setActiveWorkItemId] = useState<string | null>(null);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const [worklogOpenRequest, setWorklogOpenRequest] = useState<{
    taskId: string;
    sequence: number;
  } | null>(null);
  const worklogOpenSequenceRef = useRef(0);
  const [announcement, setAnnouncement] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [taskActivityLoadingId, setTaskActivityLoadingId] = useState<string | null>(null);
  const [subtaskActivityLoadingId, setSubtaskActivityLoadingId] = useState<string | null>(null);
  const [activityRetryTarget, setActivityRetryTarget] = useState<"parent" | "subtask" | null>(null);
  const [parentActivityRetryVersion, setParentActivityRetryVersion] = useState(0);
  const [subtaskActivityRetryVersion, setSubtaskActivityRetryVersion] = useState(0);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const dialogWasOpenRef = useRef(false);
  const detailWasOpenRef = useRef(false);
  const deepLinkHandledRef = useRef(false);
  const tasksQuery = useProjectTasksQuery(projectId);
  const projectMembersQuery = useProjectMembersAllQuery(
    isRealProject ? organizationId : "",
    isRealProject ? projectId : "",
    { status: "ACTIVE" },
  );
  const currentUserPerson = useMemo<WorkPerson | null>(() => {
    if (!user.data) return null;
    const displayName = user.data.name?.trim() || "Current User";
    return {
      id: user.data.id,
      name: displayName,
      initials: toPersonInitials(displayName) || "ME",
    };
  }, [user.data]);
  const projectPeople = useMemo<readonly WorkPerson[]>(() => {
    if (!isRealProject) {
      return PREVIEW_PEOPLE;
    }
    const memberships = projectMembersQuery.data ?? [];
    const seenIds = new Set<string>();
    const list: WorkPerson[] = [];
    for (const membership of memberships) {
      if (membership.status && membership.status !== "ACTIVE") continue;
      const memberId = membership.user?.id ?? membership.userId;
      if (!memberId || seenIds.has(memberId)) continue;
      seenIds.add(memberId);
      const displayName =
        membership.user?.fullName?.trim() ||
        membership.user?.email?.trim() ||
        (currentUserPerson?.id === memberId ? currentUserPerson.name : "") ||
        `Member ${memberId.slice(-4)}`;
      list.push({
        id: memberId,
        name: displayName,
        initials: toPersonInitials(displayName),
      });
    }
    if (list.length === 0 && currentUserPerson) {
      return [currentUserPerson];
    }
    return list;
  }, [currentUserPerson, isRealProject, projectMembersQuery.data]);
  const projectPeopleById = useMemo(
    () => new Map(projectPeople.map((person) => [person.id, person])),
    [projectPeople],
  );
  const defaultAssigneePerson =
    projectPeople[0] ?? currentUserPerson ?? UNASSIGNED_WORK_PERSON;
  const taskVersionsRef = useRef<Map<string, number>>(new Map());
  const pendingIdPromisesRef = useRef<Map<string, Promise<string | null>>>(
    new Map(),
  );
  const resolvedIdsRef = useRef<Map<string, string>>(new Map());
  const taskMutationQueuesRef = useRef<Map<string, Promise<void>>>(new Map());

  async function resolveBackendTaskId(rawId: string): Promise<string | null> {
    if (OBJECT_ID_PATTERN.test(rawId)) return rawId;
    const mapped = resolvedIdsRef.current.get(rawId);
    if (mapped) return mapped;
    const pending = pendingIdPromisesRef.current.get(rawId);
    if (pending) return pending;
    return null;
  }

  function enqueueTaskMutation(
    rawId: string,
    operation: (realId: string, version: number) => Promise<number | void>,
    onRollback?: () => void,
  ): Promise<boolean> {
    if (!isRealProject) return Promise.resolve(true);
    return (async () => {
      const realId = await resolveBackendTaskId(rawId);
      if (!realId) {
        onRollback?.();
        return false;
      }
      const prevTaskPromise =
        taskMutationQueuesRef.current.get(realId) ?? Promise.resolve();
      const nextTaskPromise = prevTaskPromise
        .catch(() => undefined)
        .then(async (): Promise<boolean> => {
          try {
            const currentVersion = taskVersionsRef.current.get(realId) ?? 1;
            const updatedVersion = await operation(realId, currentVersion);
            if (typeof updatedVersion === "number") {
              taskVersionsRef.current.set(realId, updatedVersion);
            }
            return true;
          } catch (error) {
            onRollback?.();
            void tasksQuery.refetch();
            const message = describeMutationError(error);
            setMutationError(message);
            setAnnouncement(`Unable to save changes. ${message}`);
            return false;
          }
        });
      taskMutationQueuesRef.current.set(
        realId,
        nextTaskPromise.then(() => undefined),
      );
      return nextTaskPromise;
    })();
  }

  async function performBackendStatusTransition(
    realId: string,
    version: number,
    fromStatus: WorkStatus,
    toStatus: WorkStatus | "CANCELLED",
  ): Promise<number> {
    if (fromStatus === toStatus) return version;
    if (fromStatus === "CANCELLED") {
      const reopened = await transitionProjectTaskApi(projectId, realId, version, {
        fromStatus: "CANCELLED",
        toStatus: "TODO",
        reason: "Reopened from workspace UI",
      });
      return toStatus === "TODO"
        ? reopened.version
        : performBackendStatusTransition(realId, reopened.version, "TODO", toStatus);
    }
    if (toStatus === "CANCELLED") {
      let currentVer = version;
      let currentFrom: BackendTaskStatus = fromStatus;
      if (fromStatus === "DONE") {
        const reopened = await transitionProjectTaskApi(
          projectId,
          realId,
          currentVer,
          {
            fromStatus: "DONE",
            toStatus: "IN_PROGRESS",
            reason: "Reopened before cancellation",
          },
        );
        currentVer = reopened.version;
        currentFrom = "IN_PROGRESS";
      }
      const cancelled = await transitionProjectTaskApi(
        projectId,
        realId,
        currentVer,
        {
          fromStatus: currentFrom,
          toStatus: "CANCELLED",
          reason: "Cancelled from workspace UI",
        },
      );
      return cancelled.version;
    }

    if (
      (fromStatus === "BLOCKED" && toStatus === "DONE") ||
      (fromStatus === "TODO" && toStatus === "IN_REVIEW") ||
      (fromStatus === "IN_REVIEW" && toStatus === "TODO")
    ) {
      const first = await transitionProjectTaskApi(projectId, realId, version, {
        fromStatus,
        toStatus: "IN_PROGRESS",
        ...(fromStatus === "BLOCKED"
          ? { reason: "Resumed from blocked" }
          : {}),
      });
      return performBackendStatusTransition(
        realId,
        first.version,
        "IN_PROGRESS",
        toStatus,
      );
    }

    if (fromStatus === "TODO" && toStatus === "DONE") {
      const tr1 = await transitionProjectTaskApi(projectId, realId, version, {
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
      });
      const tr2 = await transitionProjectTaskApi(
        projectId,
        realId,
        tr1.version,
        {
          fromStatus: "IN_PROGRESS",
          toStatus: "DONE",
        },
      );
      return tr2.version;
    }

    if (fromStatus === "DONE" && toStatus !== "IN_PROGRESS") {
      const tr1 = await transitionProjectTaskApi(projectId, realId, version, {
        fromStatus: "DONE",
        toStatus: "IN_PROGRESS",
        reason: "Reopened from workspace UI",
      });
      const tr2 = await transitionProjectTaskApi(
        projectId,
        realId,
        tr1.version,
        {
          fromStatus: "IN_PROGRESS",
          toStatus,
          ...(toStatus === "BLOCKED"
            ? { reason: "Blocked from workspace UI" }
            : {}),
        },
      );
      return tr2.version;
    }

    const tr = await transitionProjectTaskApi(projectId, realId, version, {
      fromStatus,
      toStatus,
      ...(fromStatus === "DONE"
        ? { reason: "Reopened from workspace UI" }
        : fromStatus === "BLOCKED"
          ? { reason: "Resumed from blocked" }
          : toStatus === "BLOCKED"
            ? { reason: "Blocked from workspace UI" }
            : {}),
    });
    return tr.version;
  }

  useEffect(() => {
    if (!isRealProject || !tasksQuery.data) return;
    const rawTasks = tasksQuery.data.items.filter((t) => t.projectId === projectId);

    for (const t of rawTasks) {
      taskVersionsRef.current.set(t.id, t.version);
    }

    const parentTasks = rawTasks.filter((t) => t.parentId === null);
    const childrenByParent = new Map<string, BackendTask[]>();
    for (const t of rawTasks) {
      if (t.parentId) {
        const list = childrenByParent.get(t.parentId) ?? [];
        list.push(t);
        childrenByParent.set(t.parentId, list);
      }
    }

    const currentProjectName = resolvedProject?.name ?? "";
    const mapped: WorkItem[] = parentTasks.map((t) => {
      const childTasks = childrenByParent.get(t.id) ?? [];
      const subtaskItems: readonly WorkSubtaskItem[] = childTasks.map((sub) => {
        const subStatus = mapBackendStatusToWorkStatus(sub.status);
        return {
          id: sub.id,
          key: sub.key,
          summary: sub.title,
          done: subStatus === "DONE",
          status: subStatus,
          priority: sub.priority,
          assignee: resolvePersonById(
            sub.assigneeId,
            projectPeopleById,
            user.data,
            isRealProject,
          ),
          reporter: resolvePersonById(
            sub.createdBy,
            projectPeopleById,
            user.data,
            isRealProject,
          ),
          dueDate: sub.dueDate ? sub.dueDate.slice(0, 10) : null,
          startDate: sub.startDate ? sub.startDate.slice(0, 10) : null,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
          labels: sub.labels,
        };
      });

      const completedSubtasks =
        childTasks.length > 0
          ? childTasks.filter((c) => c.status === "DONE").length
          : t.subtaskCounts.total > 0
            ? t.subtaskCounts.done
            : 0;
      const totalSubtasks =
        childTasks.length > 0
          ? childTasks.length
          : t.subtaskCounts.total > 0
            ? t.subtaskCounts.total
            : 0;

      const uiStatus = mapBackendStatusToWorkStatus(t.status);

      return {
        id: t.id,
        key: t.key,
        title: t.title,
        type: t.type,
        assignee: resolvePersonById(
          t.assigneeId,
          projectPeopleById,
          user.data,
          isRealProject,
        ),
        reporter: resolvePersonById(
          t.createdBy,
          projectPeopleById,
          user.data,
          isRealProject,
        ),
        priority: t.priority,
        status: uiStatus,
        resolution: uiStatus === "DONE" ? "RESOLVED" : "UNRESOLVED",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt.slice(0, 10),
        dueDate: t.dueDate ? t.dueDate.slice(0, 10) : null,
        startDate: t.startDate ? t.startDate.slice(0, 10) : null,
        projectName: currentProjectName || "Workspace",
        labels: t.labels,
        subtasks: { completed: completedSubtasks, total: totalSubtasks },
        subtaskItems,
        comments: [],
        worklogs: [],
      };
    });

    queueMicrotask(() => {
      setItems((current) => {
        const prevById = new Map(current.map((item) => [item.id, item]));
        return mapped.map((item) => {
          const prev = prevById.get(item.id);
          if (!prev) return item;
          const prevSubById = new Map(
            (prev.subtaskItems ?? []).map((sub) => [sub.id, sub]),
          );
          const mergedSubs = item.subtaskItems?.map((sub) => {
            const prevSub = prevSubById.get(sub.id);
            if (!prevSub) return sub;
            return {
              ...sub,
              ...(prevSub.description !== undefined
                ? { description: prevSub.description }
                : {}),
              ...(prevSub.steps !== undefined ? { steps: prevSub.steps } : {}),
              ...(prevSub.comments !== undefined
                ? { comments: prevSub.comments }
                : {}),
              ...(prevSub.worklogs !== undefined
                ? { worklogs: prevSub.worklogs }
                : {}),
              ...(prevSub.history !== undefined ? { history: prevSub.history } : {}),
              ...(prevSub.loggedTime !== undefined
                ? { loggedTime: prevSub.loggedTime }
                : {}),
            };
          });
          return {
            ...item,
            ...(prev.description !== undefined
              ? { description: prev.description }
              : {}),
            ...(prev.comments && prev.comments.length > 0
              ? { comments: prev.comments }
              : {}),
            ...(prev.worklogs && prev.worklogs.length > 0
              ? { worklogs: prev.worklogs }
              : {}),
            ...(prev.history !== undefined ? { history: prev.history } : {}),
            ...(mergedSubs ? { subtaskItems: mergedSubs } : {}),
          };
        });
      });
    });
  }, [
    isRealProject,
    projectId,
    projectPeopleById,
    resolvedProject?.name,
    tasksQuery.data,
    user.data,
  ]);

  useEffect(() => {
    if ((isRealProject && !tasksQuery.isSuccess) || typeof window === "undefined") return;
    let targetKey = "";
    try {
      targetKey = decodeURIComponent(window.location.hash.slice(1)).trim().toUpperCase();
    } catch {
      return;
    }
    if (!targetKey || deepLinkHandledRef.current) return;
    const parent = items.find((item) => item.key.toUpperCase() === targetKey);
    if (parent) {
      deepLinkHandledRef.current = true;
      setActiveSubtaskId(null);
      setActiveWorkItemId(parent.id);
      return;
    }
    for (const item of items) {
      const subtask = item.subtaskItems?.find((sub) => sub.key.toUpperCase() === targetKey);
      if (!subtask) continue;
      deepLinkHandledRef.current = true;
      setActiveWorkItemId(item.id);
      setActiveSubtaskId(subtask.id);
      return;
    }
  }, [isRealProject, items, tasksQuery.isSuccess]);

  const openedTaskId = fullPageWorkItemId ?? activeWorkItemId;
  useEffect(() => {
    if (!isRealProject || !openedTaskId || !OBJECT_ID_PATTERN.test(openedTaskId)) {
      return;
    }
    let cancelled = false;
    setTaskActivityLoadingId(openedTaskId);
    void (async () => {
      try {
        const [detail, commentsPage, worklogsPage, historyPage] = await Promise.all([
          fetchProjectTaskDetail(projectId, openedTaskId),
          fetchAllTaskComments(projectId, openedTaskId),
          fetchAllTaskWorklogs(projectId, openedTaskId),
          fetchAllTaskHistory(projectId, openedTaskId),
        ]);
        if (cancelled) return;
        setTaskActivityLoadingId((current) => current === openedTaskId ? null : current);
        setActivityRetryTarget((current) => current === "parent" ? null : current);
        taskVersionsRef.current.set(detail.id, detail.version);
        const liveComments = commentsPage.items.map((c) => {
          const authorPerson = resolvePersonById(
            c.authorId,
            projectPeopleById,
            user.data,
            isRealProject,
          );
          return {
            id: c.id,
            author: authorPerson.name,
            initials: authorPerson.initials,
            createdAt: formatCommentDateTime(c.createdAt),
            text: c.body,
          };
        });
        const liveWorklogs = worklogsPage.items.map((w) => {
          const authorPerson = resolvePersonById(
            w.authorId,
            projectPeopleById,
            user.data,
            isRealProject,
          );
          return {
            id: w.id,
            author: authorPerson.name,
            timeSpent: formatWorklogMinutes(w.minutes),
            note: w.note ?? "",
            createdAt: formatCommentDateTime(w.loggedAt || w.createdAt),
          };
        });
        setItems((current) =>
          current.map((item) =>
            item.id === openedTaskId
              ? {
                  ...item,
                  description: detail.description ?? "",
                  comments: liveComments,
                  worklogs: liveWorklogs,
                  history: mapVisibleTaskHistory(historyPage),
                }
              : item,
          ),
        );
      } catch (error) {
        if (!cancelled) {
          setTaskActivityLoadingId((current) => current === openedTaskId ? null : current);
          setMutationError(describeMutationError(error));
          setActivityRetryTarget("parent");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentActivityRetryVersion, isRealProject, openedTaskId, projectId, projectPeopleById, user.data]);

  const openedSubtaskId = fullPageSubtaskId ?? activeSubtaskId;
  useEffect(() => {
    if (
      !isRealProject ||
      !openedTaskId ||
      !openedSubtaskId ||
      !OBJECT_ID_PATTERN.test(openedSubtaskId)
    ) {
      return;
    }
    let cancelled = false;
    setSubtaskActivityLoadingId(openedSubtaskId);
    void (async () => {
      try {
        const [subDetail, subCommentsPage, subWorklogsPage, subHistoryPage] = await Promise.all([
          fetchProjectTaskDetail(projectId, openedSubtaskId),
          fetchAllTaskComments(projectId, openedSubtaskId),
          fetchAllTaskWorklogs(projectId, openedSubtaskId),
          fetchAllTaskHistory(projectId, openedSubtaskId),
        ]);
        if (cancelled) return;
        setSubtaskActivityLoadingId((current) => current === openedSubtaskId ? null : current);
        setActivityRetryTarget((current) => current === "subtask" ? null : current);
        taskVersionsRef.current.set(subDetail.id, subDetail.version);
        const liveSubComments = subCommentsPage.items.map((c) => {
          const authorPerson = resolvePersonById(
            c.authorId,
            projectPeopleById,
            user.data,
            isRealProject,
          );
          return {
            id: c.id,
            author: authorPerson.name,
            initials: authorPerson.initials,
            createdAt: formatCommentDateTime(c.createdAt),
            text: c.body,
          };
        });
        const liveSubWorklogs = subWorklogsPage.items.map((w) => {
          const authorPerson = resolvePersonById(
            w.authorId,
            projectPeopleById,
            user.data,
            isRealProject,
          );
          return {
            id: w.id,
            author: authorPerson.name,
            timeSpent: formatWorklogMinutes(w.minutes),
            note: w.note ?? "",
            createdAt: formatCommentDateTime(w.loggedAt || w.createdAt),
          };
        });
        const totalLogged =
          subWorklogsPage.totalMinutes > 0
            ? formatWorklogMinutes(subWorklogsPage.totalMinutes)
            : "0h";
        setItems((current) =>
          current.map((item) => {
            if (item.id !== openedTaskId || !item.subtaskItems) return item;
            return {
              ...item,
              subtaskItems: item.subtaskItems.map((sub) =>
                sub.id === openedSubtaskId
                  ? {
                      ...sub,
                      description: subDetail.description ?? "",
                      steps: subDetail.steps,
                      comments: liveSubComments,
                      worklogs: liveSubWorklogs,
                      history: mapVisibleTaskHistory(subHistoryPage),
                      loggedTime: totalLogged,
                    }
                  : sub,
              ),
            };
          }),
        );
      } catch (error) {
        if (!cancelled) {
          setSubtaskActivityLoadingId((current) => current === openedSubtaskId ? null : current);
          setMutationError(describeMutationError(error));
          setActivityRetryTarget("subtask");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isRealProject,
    openedSubtaskId,
    openedTaskId,
    subtaskActivityRetryVersion,
    projectId,
    projectPeopleById,
    user.data,
  ]);

  const projectName = resolvedProject?.name ??"";
  const projectCode = resolvedProject?.code ??"";

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return items
      .filter((item) => {
        if (hideDone && item.status ==="DONE") return false;
        const subtaskHaystack = (item.subtaskItems ?? [])
          .map((sub) =>
            [
              sub.key,
              sub.summary,
              sub.assignee?.name ??"",
              sub.description ??"",
            ].join(" "),
          )
          .join(" ");
        const matchesQuery =
          !normalizedQuery ||
          normalizeSearch(
            [
              item.key,
              item.title,
              item.assignee.name,
              item.reporter.name,
              subtaskHaystack,
            ].join(" "),
          ).includes(normalizedQuery);
        if (
          !matchesQuery ||
          (status !=="ALL"&& item.status !== status) ||
          (priority !=="ALL"&& item.priority !== priority) ||
          (assigneeId !=="ALL"&& item.assignee.id !== assigneeId)
        ) {
          return false;
        }
        for (const cond of filterConditions) {
          const targetVal = cond.value.toLowerCase();
          if (cond.field ==="type"&& targetVal ==="subtask") {
            const hasSub = item.subtasks.total > 0;
            if (cond.operator ==="is"&& !hasSub) return false;
            if (cond.operator ==="is_not"&& hasSub) return false;
            continue;
          }
          const actualVal = (
            cond.field ==="status"
              ? item.status
              : cond.field ==="priority"
                ? item.priority
                : cond.field ==="assignee"
                  ? item.assignee.name
                  : cond.field ==="type"
                    ? item.type
                    : item.reporter.name
          ).toLowerCase();
          if (cond.operator ==="is"&& actualVal !== targetVal) return false;
          if (cond.operator ==="is_not"&& actualVal === targetVal)
            return false;
          if (cond.operator ==="contains"&& !actualVal.includes(targetVal))
            return false;
        }
        return true;
      })
      .map((item) => ({ ...item, projectName }));
  }, [
    assigneeId,
    filterConditions,
    hideDone,
    items,
    priority,
    projectName,
    query,
    status,
  ]);

  const activeWorkItem = useMemo(
    () =>
      activeWorkItemId
        ? (items
            .map((item) => ({ ...item, projectName }))
            .find((item) => item.id === activeWorkItemId) ?? null)
        : null,
    [activeWorkItemId, items, projectName],
  );

  const fullPageWorkItem = useMemo(
    () =>
      fullPageWorkItemId
        ? (items
            .map((item) => ({ ...item, projectName }))
            .find((item) => item.id === fullPageWorkItemId) ?? null)
        : null,
    [fullPageWorkItemId, items, projectName],
  );

  const groups = useMemo(
    () => groupWorkItems(visibleItems, groupBy, projectPeople),
    [groupBy, projectPeople, visibleItems],
  );
  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selectedIds.has(item.id));

  useEffect(() => {
    if (dialogWasOpenRef.current && !createOpen) createButtonRef.current?.focus();
    dialogWasOpenRef.current = createOpen;
  }, [createOpen]);

  useEffect(() => {
    if (detailWasOpenRef.current && !activeWorkItem) detailTriggerRef.current?.focus();
    detailWasOpenRef.current = Boolean(activeWorkItem);
  }, [activeWorkItem]);

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openWorkItem(
    item: WorkItem,
    trigger: HTMLButtonElement,
    openWorklog = false,
  ) {
    if (openWorklog) {
      worklogOpenSequenceRef.current += 1;
      setWorklogOpenRequest({
        taskId: item.id,
        sequence: worklogOpenSequenceRef.current,
      });
    } else {
      setWorklogOpenRequest(null);
    }
    updateTaskHash(item.key);
    detailTriggerRef.current = trigger;
    setActiveSubtaskId(null);
    setActiveWorkItemId(item.id);
  }

  function openSubtask(
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
    openWorklog = false,
  ) {
    if (openWorklog) {
      worklogOpenSequenceRef.current += 1;
      setWorklogOpenRequest({
        taskId: subtaskId,
        sequence: worklogOpenSequenceRef.current,
      });
    } else {
      setWorklogOpenRequest(null);
    }
    const subtask = item.subtaskItems?.find((candidate) => candidate.id === subtaskId);
    updateTaskHash(subtask?.key ?? item.key);
    detailTriggerRef.current = trigger;
    setActiveWorkItemId(item.id);
    setActiveSubtaskId(subtaskId);
  }

  function openFullPageWorkItem(item: WorkItem, subtaskId?: string | null) {
    const subtask = subtaskId
      ? item.subtaskItems?.find((candidate) => candidate.id === subtaskId)
      : undefined;
    updateTaskHash(subtask?.key ?? item.key);
    setActiveWorkItemId(null);
    setActiveSubtaskId(null);
    setFullPageWorkItemId(item.id);
    setFullPageSubtaskId(subtaskId ?? null);
  }

  function updateTaskHash(key: string) {
    if (typeof window === "undefined") return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${encodeURIComponent(key)}`,
    );
  }

  function clearTaskHash() {
    if (typeof window === "undefined" || !window.location.hash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleItems.forEach((item) => next.delete(item.id));
      else visibleItems.forEach((item) => next.add(item.id));
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
    setPriority("ALL");
    setAssigneeId("ALL");
    setFilterConditions([]);
    setHideDone(false);
    setSelectedIds(new Set());
  }

  function addFilterCondition(
    field: WorkFilterField,
    operator: WorkFilterOperator,
    value: string,
  ) {
    setFilterConditions((current) => [
      ...current,
      {
        id: `cond-${current.length + 1}-${field}`,
        field,
        operator,
        value,
      },
    ]);
  }

  function removeFilterCondition(id: string) {
    setFilterConditions((current) => current.filter((c) => c.id !== id));
  }

  function toggleItemFlag(id: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, flagged: !item.flagged } : item,
      ),
    );
  }

  function requestSingleTaskCancellation(id: string) {
    setCancelConfirmationIds([id]);
  }

  function addPreviewItem(input: CreatePreviewWorkItem): Promise<boolean> {
    const targetStatus = input.status ?? "TODO";
    const tempId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((current) => {
      const sequence =
        current.filter((item) => item.key.startsWith("PREVIEW-")).length + 1;
      const item: WorkItem = {
        id: tempId,
        key: `PREVIEW-${sequence}`,
        title: input.title,
        type: input.type,
        assignee: input.assignee,
        reporter: isRealProject
          ? (currentUserPerson ?? defaultAssigneePerson)
          : PREVIEW_PEOPLE[1],
        priority: input.priority,
        status: targetStatus,
        resolution: targetStatus === "DONE" ? "RESOLVED" : "UNRESOLVED",
        createdAt: new Date().toISOString(),
        dueDate: input.dueDate,
        projectName,
        description: input.description,
        subtasks: { completed: 0, total: 0 },
        subtaskItems: [],
        comments: [],
      };
      return [item, ...current];
    });
    if (!isRealProject) setAnnouncement(t("createAdded"));

    let creationPromise: Promise<string | null> | undefined;
    if (isRealProject) {
      creationPromise = (async (): Promise<string | null> => {
        try {
          const created = await createProjectTaskApi(projectId, {
            title: input.title,
            description: input.description ?? null,
            type: input.type,
            priority: input.priority,
            assigneeId: OBJECT_ID_PATTERN.test(input.assignee.id)
              ? input.assignee.id
              : null,
            dueDate: input.dueDate
              ? new Date(input.dueDate).toISOString()
              : null,
          });
          taskVersionsRef.current.set(created.id, created.version);
          resolvedIdsRef.current.set(tempId, created.id);
          setItems((current) =>
            current.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    id: created.id,
                    key: created.key,
                  }
                : item,
            ),
          );
          setSelectedIds((current) => {
            if (!current.has(tempId)) return current;
            const next = new Set(current);
            next.delete(tempId);
            next.add(created.id);
            return next;
          });
          setActiveWorkItemId((current) =>
            current === tempId ? created.id : current,
          );
          setFullPageWorkItemId((current) =>
            current === tempId ? created.id : current,
          );
          if (targetStatus !== "TODO") {
            try {
              const finalVersion = await performBackendStatusTransition(
                created.id,
                created.version,
                "TODO",
                targetStatus,
              );
              taskVersionsRef.current.set(created.id, finalVersion);
            } catch {
              setItems((current) =>
                current.map((item) =>
                  item.id === created.id
                    ? { ...item, status: "TODO", resolution: "UNRESOLVED" }
                    : item,
                ),
              );
              void tasksQuery.refetch();
              setAnnouncement(t("createStatusFailed"));
            }
          }
          setAnnouncement(`Created ${created.key}.`);
          return created.id;
        } catch {
          setItems((current) => current.filter((item) => item.id !== tempId));
          void tasksQuery.refetch();
          setAnnouncement("Unable to create work item. Changes reverted.");
          return null;
        } finally {
          pendingIdPromisesRef.current.delete(tempId);
        }
      })();
      pendingIdPromisesRef.current.set(tempId, creationPromise);
    }
    return creationPromise
      ? creationPromise.then((createdId) => createdId !== null)
      : Promise.resolve(true);
  }

  function updateItemStatus(id: string, nextStatus: WorkStatus): Promise<boolean> | void {
    const existing = items.find((item) => item.id === id);
    const prevStatus = existing?.status ?? "TODO";
    if (prevStatus === nextStatus) return Promise.resolve(true);
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
              resolution: nextStatus === "DONE" ? "RESOLVED" : "UNRESOLVED",
            }
          : item,
      ),
    );
    if (isRealProject) {
      return enqueueTaskMutation(
        id,
        (realId, version) =>
          performBackendStatusTransition(
            realId,
            version,
            prevStatus,
            nextStatus,
          ),
        () => {
          setItems((current) =>
            current.map((item) =>
              item.id === id || item.id === resolvedIdsRef.current.get(id)
                ? {
                    ...item,
                    status: prevStatus,
                    resolution:
                      prevStatus === "DONE" ? "RESOLVED" : "UNRESOLVED",
                  }
                : item,
            ),
          );
        },
      );
    }
  }

  function updateItemPriority(
    id: string,
    nextPriority: WorkPriority,
  ): Promise<boolean> | void {
    const existing = items.find((item) => item.id === id);
    const prevPriority = existing?.priority ?? "MEDIUM";
    if (prevPriority === nextPriority) return;
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, priority: nextPriority } : item,
      ),
    );
    if (isRealProject) {
      return enqueueTaskMutation(
        id,
        async (realId, version) => {
          const updated = await updateProjectTaskApi(
            projectId,
            realId,
            version,
            {
              priority: nextPriority,
            },
          );
          return updated.version;
        },
        () => {
          setItems((current) =>
            current.map((item) =>
              item.id === id || item.id === resolvedIdsRef.current.get(id)
                ? { ...item, priority: prevPriority }
                : item,
            ),
          );
        },
      );
    }
  }

  function updateItemAssignee(
    id: string,
    nextAssignee: WorkPerson,
  ): Promise<boolean> | undefined {
    const existing = items.find((item) => item.id === id);
    const prevAssignee = existing?.assignee ?? defaultAssigneePerson;
    setMutationError(null);
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, assignee: nextAssignee } : item,
      ),
    );
    if (isRealProject) {
      return enqueueTaskMutation(
        id,
        async (realId, version) => {
          const updated = await updateProjectTaskApi(
            projectId,
            realId,
            version,
            {
              assigneeId: OBJECT_ID_PATTERN.test(nextAssignee.id)
                ? nextAssignee.id
                : null,
            },
          );
          return updated.version;
        },
        () => {
          setItems((current) =>
            current.map((item) =>
              item.id === id || item.id === resolvedIdsRef.current.get(id)
                ? { ...item, assignee: prevAssignee }
                : item,
            ),
          );
        },
      );
    }
  }

  function updateItemTitle(id: string, titleInput: string): Promise<boolean> | void {
    const title = titleInput.trim();
    if (!title) return Promise.resolve(false);
    if (isRealProject) {
      return enqueueTaskMutation(
        id,
        async (realId, version) => {
          const updated = await updateProjectTaskApi(projectId, realId, version, { title });
          setItems((current) => current.map((item) =>
            item.id === id || item.id === realId
              ? { ...item, title: updated.title }
              : item,
          ));
          return updated.version;
        },
      );
    }
    setItems((current) => current.map((item) =>
      item.id === id ? { ...item, title } : item,
    ));
    return Promise.resolve(true);
  }

  function toggleSubtask(itemId: string, subtaskId: string) {
    const previousItems = items;
    const parentItem = items.find((item) => item.id === itemId);
    const targetSub = parentItem?.subtaskItems?.find(
      (sub) => sub.id === subtaskId,
    );
    if (!targetSub) return;
    const prevStatus = targetSub.status;
    const nextDone = !targetSub.done;
    const nextStatus: WorkStatus = nextDone ? "DONE" : "TODO";

    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const nextSubtasks = item.subtaskItems.map((sub) =>
          sub.id === subtaskId
            ? {
                ...sub,
                done: nextDone,
                status: nextStatus,
              }
            : sub,
        );
        const completed = nextSubtasks.filter((sub) => sub.done).length;
        return {
          ...item,
          subtaskItems: nextSubtasks,
          subtasks: { completed, total: nextSubtasks.length },
        };
      }),
    );

    if (isRealProject) {
      enqueueTaskMutation(
        subtaskId,
        (realSubId, version) =>
          performBackendStatusTransition(
            realSubId,
            version,
            prevStatus,
            nextStatus,
          ),
        () => {
          setItems(previousItems);
        },
      );
    }
  }

  function addSubtask(
    itemId: string,
    summary: string,
    options?: {
      assignee?: WorkPerson;
      priority?: WorkPriority;
      status?: WorkStatus;
      dueDate?: string | null;
      description?: string;
      estimate?: string;
    },
  ) {
    const tempSubId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextStatus = options?.status ?? ("TODO" as WorkStatus);
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const existing = item.subtaskItems ?? [];
        const nextIdx = existing.length + 1;
        const newSub: WorkSubtaskItem = {
          id: tempSubId,
          key: `${item.key}.${nextIdx}`,
          summary,
          done: nextStatus === "DONE",
          status: nextStatus,
          priority: options?.priority ?? item.priority,
          assignee: options?.assignee ?? item.assignee,
          reporter: item.reporter,
          dueDate: options?.dueDate ?? item.dueDate,
          createdAt: new Date().toISOString(),
          description: options?.description,
          ...(!isRealProject
            ? { estimate: options?.estimate ?? "2h", loggedTime: "0h" }
            : {}),
          steps: [],
          comments: [],
          worklogs: [],
          ...(!isRealProject
            ? {
                history: [
                  {
                    id: `hist-${Date.now()}`,
                    author: currentUserPerson?.name ?? defaultAssigneePerson.name,
                    action: `created subtask ${item.key}.${nextIdx}`,
                    createdAt: formatCommentDateTime(new Date()),
                  },
                ],
              }
            : {}),
        };
        const nextSubtasks = [...existing, newSub];
        const completed = nextSubtasks.filter((sub) => sub.done).length;
        return {
          ...item,
          subtaskItems: nextSubtasks,
          subtasks: { completed, total: nextSubtasks.length },
        };
      }),
    );
    if (isRealProject) {
      const subCreationPromise = (async (): Promise<string | null> => {
        try {
          const realParentId = await resolveBackendTaskId(itemId);
          if (!realParentId) {
            throw new Error("Parent task not persisted");
          }
          const createdSub = await createProjectTaskApi(projectId, {
            title: summary,
            parentId: realParentId,
            priority: options?.priority ?? "MEDIUM",
            description: options?.description ?? null,
            assigneeId:
              options?.assignee && OBJECT_ID_PATTERN.test(options.assignee.id)
                ? options.assignee.id
                : null,
            dueDate: options?.dueDate
              ? new Date(options.dueDate).toISOString()
              : null,
          });
          taskVersionsRef.current.set(createdSub.id, createdSub.version);
          resolvedIdsRef.current.set(tempSubId, createdSub.id);
          setItems((current) =>
            current.map((item) => {
              if (item.id !== itemId && item.id !== realParentId) return item;
              const nextSubtasks = (item.subtaskItems ?? []).map((sub) =>
                sub.id === tempSubId
                  ? {
                      ...sub,
                      id: createdSub.id,
                      key: createdSub.key,
                    }
                  : sub,
              );
              return {
                ...item,
                subtaskItems: nextSubtasks,
              };
            }),
          );
          try {
            const finalSubVersion = await performBackendStatusTransition(
              createdSub.id,
              createdSub.version,
              "TODO",
              nextStatus,
            );
            taskVersionsRef.current.set(createdSub.id, finalSubVersion);
          } catch {
            setItems((current) =>
              current.map((item) => {
                const subtaskItems = item.subtaskItems?.map((sub) =>
                  sub.id === createdSub.id
                    ? { ...sub, status: "TODO" as const, done: false }
                    : sub,
                );
                if (
                  !subtaskItems ||
                  !subtaskItems.some((sub) => sub.id === createdSub.id)
                ) return item;
                return {
                  ...item,
                  subtaskItems,
                  subtasks: {
                    completed: subtaskItems.filter((sub) => sub.done).length,
                    total: subtaskItems.length,
                  },
                };
              }),
            );
            void tasksQuery.refetch();
            setAnnouncement(t("subtaskStatusFailed"));
          }
          return createdSub.id;
        } catch {
          setItems((current) =>
            current.map((item) => {
              if (
                item.id !== itemId &&
                item.id !== resolvedIdsRef.current.get(itemId)
              ) {
                return item;
              }
              const nextSubtasks = (item.subtaskItems ?? []).filter(
                (sub) => sub.id !== tempSubId,
              );
              const completed = nextSubtasks.filter((sub) => sub.done).length;
              return {
                ...item,
                subtaskItems: nextSubtasks,
                subtasks: { completed, total: nextSubtasks.length },
              };
            }),
          );
          void tasksQuery.refetch();
          setAnnouncement("Unable to create subtask. Changes reverted.");
          return null;
        } finally {
          pendingIdPromisesRef.current.delete(tempSubId);
        }
      })();
      pendingIdPromisesRef.current.set(tempSubId, subCreationPromise);
    }
  }

  function updateSubtask(
    itemId: string,
    subtaskId: string,
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ): Promise<boolean> | void {
    const previousItems = items;
    const parentItem = items.find((item) => item.id === itemId);
    const existingSub = parentItem?.subtaskItems?.find(
      (sub) => sub.id === subtaskId,
    );
    const prevStatus = existingSub?.status ?? "TODO";
    const nextStatus: WorkStatus =
      patch.status !== undefined
        ? patch.status
        : patch.done !== undefined
          ? patch.done
            ? "DONE"
            : "TODO"
          : prevStatus;
    const nextDone = nextStatus === "DONE";

    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const nextSubtasks = item.subtaskItems.map((sub) => {
          if (sub.id !== subtaskId) return sub;
          return {
            ...sub,
            ...patch,
            status: nextStatus,
            done: nextDone,
            updatedAt: new Date().toISOString(),
          };
        });
        const completed = nextSubtasks.filter((sub) => sub.done).length;
        return {
          ...item,
          subtaskItems: nextSubtasks,
          subtasks: { completed, total: nextSubtasks.length },
        };
      }),
    );

    if (isRealProject && existingSub) {
      const hasFieldPatch =
        patch.summary !== undefined ||
        patch.priority !== undefined ||
        patch.assignee !== undefined ||
        patch.dueDate !== undefined ||
        patch.startDate !== undefined ||
        patch.description !== undefined ||
        patch.labels !== undefined ||
        patch.steps !== undefined;

      const addedComment =
        patch.comments &&
        patch.comments.length > (existingSub.comments?.length ?? 0)
          ? patch.comments[patch.comments.length - 1]
          : undefined;
      const addedWorklog =
        patch.worklogs &&
        patch.worklogs.length > (existingSub.worklogs?.length ?? 0)
          ? patch.worklogs[patch.worklogs.length - 1]
          : undefined;

      if (addedComment) {
        void (async () => {
          try {
            const realSubId = await resolveBackendTaskId(subtaskId);
            if (!realSubId) throw new Error("Subtask not persisted");
            const created = await createTaskCommentApi(
              projectId,
              realSubId,
              addedComment.text,
            );
            setItems((current) =>
              current.map((item) => {
                if (item.id !== itemId || !item.subtaskItems) return item;
                return {
                  ...item,
                  subtaskItems: item.subtaskItems.map((sub) =>
                    sub.id === subtaskId || sub.id === realSubId
                      ? {
                          ...sub,
                          comments: (sub.comments ?? []).map((c) =>
                            c.id === addedComment.id
                              ? {
                                  ...c,
                                  id: created.id,
                                  createdAt: formatCommentDateTime(
                                    created.createdAt,
                                  ),
                                }
                              : c,
                          ),
                        }
                      : sub,
                  ),
                };
              }),
            );
          } catch {
            setItems(previousItems);
          }
        })();
      }

      if (addedWorklog) {
        void (async () => {
          try {
            const realSubId = await resolveBackendTaskId(subtaskId);
            if (!realSubId) throw new Error("Subtask not persisted");
            const minutes = parseWorklogMinutes(addedWorklog.timeSpent);
            const created = await createTaskWorklogApi(projectId, realSubId, {
              minutes,
              note: addedWorklog.note || null,
            });
            setItems((current) =>
              current.map((item) => {
                if (item.id !== itemId || !item.subtaskItems) return item;
                return {
                  ...item,
                  subtaskItems: item.subtaskItems.map((sub) =>
                    sub.id === subtaskId || sub.id === realSubId
                      ? {
                          ...sub,
                          worklogs: (sub.worklogs ?? []).map((wl) =>
                            wl.id === addedWorklog.id
                              ? {
                                  ...wl,
                                  id: created.id,
                                  timeSpent: formatWorklogMinutes(
                                    created.minutes,
                                  ),
                                  note: created.note ?? "",
                                  createdAt: formatCommentDateTime(
                                    created.loggedAt || created.createdAt,
                                  ),
                                }
                              : wl,
                          ),
                        }
                      : sub,
                  ),
                };
              }),
            );
          } catch {
            setItems(previousItems);
          }
        })();
      }

      if (prevStatus !== nextStatus || hasFieldPatch) {
        return enqueueTaskMutation(
          subtaskId,
          async (realSubId, version) => {
            let currentVersion = version;
            if (prevStatus !== nextStatus) {
              currentVersion = await performBackendStatusTransition(
                realSubId,
                currentVersion,
                prevStatus,
                nextStatus,
              );
            }
            if (hasFieldPatch) {
              const updated = await updateProjectTaskApi(
                projectId,
                realSubId,
                currentVersion,
                {
                  ...(patch.summary !== undefined
                    ? { title: patch.summary }
                    : {}),
                  ...(patch.priority !== undefined
                    ? { priority: patch.priority }
                    : {}),
                  ...(patch.assignee !== undefined
                    ? {
                        assigneeId: OBJECT_ID_PATTERN.test(patch.assignee.id)
                          ? patch.assignee.id
                          : null,
                      }
                    : {}),
                  ...(patch.dueDate !== undefined
                    ? {
                        dueDate: patch.dueDate
                          ? new Date(patch.dueDate).toISOString()
                          : null,
                      }
                    : {}),
                  ...(patch.startDate !== undefined
                    ? {
                        startDate: patch.startDate
                          ? new Date(patch.startDate).toISOString()
                          : null,
                      }
                    : {}),
                  ...(patch.description !== undefined
                    ? { description: patch.description ?? null }
                    : {}),
                  ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
                  ...(patch.steps !== undefined ? { steps: patch.steps } : {}),
                },
              );
              currentVersion = updated.version;
            }
            return currentVersion;
          },
          () => {
            setItems(previousItems);
          },
        );
      }
    }
  }

  function deleteSubtask(itemId: string, subtaskId: string) {
    if (isRealProject) return;

    if (activeSubtaskId === subtaskId) {
      setActiveSubtaskId(null);
    }
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const nextSubtasks = item.subtaskItems.filter(
          (sub) => sub.id !== subtaskId,
        );
        const completed = nextSubtasks.filter((sub) => sub.done).length;
        return {
          ...item,
          subtaskItems: nextSubtasks,
          subtasks: { completed, total: nextSubtasks.length },
        };
      }),
    );
  }

  function cloneSubtask(itemId: string, subtaskId: string) {
    const parentItem = items.find((item) => item.id === itemId);
    const source = parentItem?.subtaskItems?.find((s) => s.id === subtaskId);
    if (!parentItem || !source) return;
    if (isRealProject) {
      addSubtask(itemId, `${source.summary} (Copy)`, {
        assignee: source.assignee,
        priority: source.priority,
        status: source.status,
        dueDate: source.dueDate,
        description: source.description,
        estimate: source.estimate,
      });
      setAnnouncement("Cloned subtask.");
      return;
    }
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const idx = item.subtaskItems.findIndex((s) => s.id === subtaskId);
        if (idx < 0) return item;
        const src = item.subtaskItems[idx];
        const nextNum = item.subtaskItems.length + 1;
        const cloned: WorkSubtaskItem = {
          ...src,
          id: `${item.key}.${nextNum}-${Date.now()}`,
          key: `${item.key}.${nextNum}`,
          summary: `${src.summary} (Copy)`,
          createdAt: new Date().toISOString(),
        };
        const nextSubtasks = [
          ...item.subtaskItems.slice(0, idx + 1),
          cloned,
          ...item.subtaskItems.slice(idx + 1),
        ];
        const completed = nextSubtasks.filter((sub) => sub.done).length;
        return {
          ...item,
          subtaskItems: nextSubtasks,
          subtasks: { completed, total: nextSubtasks.length },
        };
      }),
    );
    setAnnouncement("Cloned subtask.");
  }

  function reorderSubtask(
    itemId: string,
    subtaskId: string,
    direction: "up" | "down",
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const list = [...item.subtaskItems];
        const idx = list.findIndex((s) => s.id === subtaskId);
        if (idx < 0) return item;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= list.length) return item;
        const [moved] = list.splice(idx, 1);
        list.splice(targetIdx, 0, moved);
        return {
          ...item,
          subtaskItems: list,
        };
      }),
    );
  }

  function convertSubtaskToTask(itemId: string, subtaskId: string) {
    const previousItems = items;
    const parentItem = items.find((i) => i.id === itemId);
    const sourceSub = parentItem?.subtaskItems?.find((s) => s.id === subtaskId);
    if (!parentItem || !sourceSub) return;

    const promotedTaskId = isRealProject
      ? subtaskId
      : `promoted-${Date.now()}`;

    setItems((current) => {
      const pItem = current.find((i) => i.id === itemId);
      const sSub = pItem?.subtaskItems?.find((s) => s.id === subtaskId);
      if (!pItem || !sSub) return current;

      const nextSeq = 146 + current.length;
      const promotedItem: WorkItem = {
        id: promotedTaskId,
        key: isRealProject ? sSub.key : `${projectCode || "KNW"}-${nextSeq}`,
        title: sSub.summary,
        type: "TASK",
        assignee: sSub.assignee ?? pItem.assignee,
        reporter: sSub.reporter ?? pItem.reporter,
        priority: sSub.priority ?? pItem.priority,
        status: sSub.status,
        resolution: sSub.done ? "RESOLVED" : "UNRESOLVED",
        createdAt: sSub.createdAt ?? new Date().toISOString(),
        dueDate: sSub.dueDate ?? pItem.dueDate,
        projectName,
        description:
          sSub.description ??
          `Promoted from subtask ${sSub.key} of parent work item ${pItem.key}.`,
        parent: pItem.parent ?? {
          key: pItem.key,
          summary: pItem.title,
        },
        labels: sSub.labels ?? pItem.labels,
        subtasks: { completed: 0, total: 0 },
        subtaskItems: [],
        comments: sSub.comments ?? [],
      };

      const updatedList = current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const remaining = item.subtaskItems.filter((s) => s.id !== subtaskId);
        const completed = remaining.filter((s) => s.done).length;
        return {
          ...item,
          subtaskItems: remaining,
          subtasks: { completed, total: remaining.length },
        };
      });

      return [promotedItem, ...updatedList];
    });
    if (activeSubtaskId === subtaskId) {
      setActiveSubtaskId(null);
      setActiveWorkItemId(promotedTaskId);
    }
    setAnnouncement("Converted subtask to standalone Task.");

    if (isRealProject) {
      enqueueTaskMutation(
        subtaskId,
        async (realSubId, version) => {
          const updated = await updateProjectTaskApi(
            projectId,
            realSubId,
            version,
            { parentId: null },
          );
          return updated.version;
        },
        () => {
          setItems(previousItems);
        },
      );
    }
  }

  function moveSubtaskToParent(
    fromItemId: string,
    subtaskId: string,
    toItemId: string,
  ) {
    if (fromItemId === toItemId) return;
    const previousItems = items;
    setItems((current) => {
      const fromItem = current.find((i) => i.id === fromItemId);
      const toItem = current.find((i) => i.id === toItemId);
      const movingSub = fromItem?.subtaskItems?.find((s) => s.id === subtaskId);
      if (!fromItem || !toItem || !movingSub) return current;

      const targetExisting = toItem.subtaskItems ?? [];
      const nextSubNumber = targetExisting.length + 1;
      const rekeyedSub: WorkSubtaskItem = {
        ...movingSub,
        key: isRealProject ? movingSub.key : `${toItem.key}.${nextSubNumber}`,
      };

      return current.map((item) => {
        if (item.id === fromItemId) {
          const remaining = (item.subtaskItems ?? []).filter(
            (s) => s.id !== subtaskId,
          );
          const completed = remaining.filter((s) => s.done).length;
          return {
            ...item,
            subtaskItems: remaining,
            subtasks: { completed, total: remaining.length },
          };
        }
        if (item.id === toItemId) {
          const nextSubs = [...(item.subtaskItems ?? []), rekeyedSub];
          const completed = nextSubs.filter((s) => s.done).length;
          return {
            ...item,
            subtaskItems: nextSubs,
            subtasks: { completed, total: nextSubs.length },
          };
        }
        return item;
      });
    });
    if (activeWorkItemId === fromItemId && activeSubtaskId === subtaskId) {
      setActiveWorkItemId(toItemId);
    }
    setAnnouncement("Moved subtask to new parent work item.");

    if (isRealProject) {
      enqueueTaskMutation(
        subtaskId,
        async (realSubId, version) => {
          const realTargetParentId = await resolveBackendTaskId(toItemId);
          if (!realTargetParentId) {
            throw new Error("Target parent task not persisted");
          }
          const updated = await updateProjectTaskApi(
            projectId,
            realSubId,
            version,
            { parentId: realTargetParentId },
          );
          return updated.version;
        },
        () => {
          setItems(previousItems);
        },
      );
    }
  }

  function addExistingTaskAsSubtask(parentId: string, taskId: string) {
    const sourceParent = items.find((parent) =>
      parent.subtaskItems?.some((subtask) => subtask.id === taskId),
    );
    if (sourceParent) {
      moveSubtaskToParent(sourceParent.id, taskId, parentId);
      return;
    }

    const task = items.find((candidate) => candidate.id === taskId);
    const parent = items.find((candidate) => candidate.id === parentId);
    if (
      !task ||
      !parent ||
      task.id === parent.id ||
      task.subtasks.total > 0
    ) {
      return;
    }

    const previousItems = items;
    const existingSubtask: WorkSubtaskItem = {
      id: task.id,
      key: task.key,
      summary: task.title,
      done: task.status === "DONE",
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      reporter: task.reporter,
      dueDate: task.dueDate,
      startDate: task.startDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      description: task.description,
      flagged: task.flagged,
      labels: task.labels,
      comments: task.comments,
    };

    setItems((current) => {
      const target = current.find((candidate) => candidate.id === parentId);
      if (
        !current.some((candidate) => candidate.id === taskId) ||
        !target
      ) {
        return current;
      }

      return current
        .filter((candidate) => candidate.id !== taskId)
        .map((candidate) => {
          if (candidate.id !== parentId) return candidate;
          const nextSubtasks = [
            ...(candidate.subtaskItems ?? []),
            existingSubtask,
          ];
          return {
            ...candidate,
            subtaskItems: nextSubtasks,
            subtasks: {
              completed:
                candidate.subtasks.completed +
                (existingSubtask.done ? 1 : 0),
              total: Math.max(
                candidate.subtasks.total,
                candidate.subtaskItems?.length ?? 0,
              ) + 1,
            },
          };
        });
    });
    setAnnouncement(
      t("existingTaskAdded", { key: task.key, parent: parent.key }),
    );

    if (isRealProject) {
      enqueueTaskMutation(
        taskId,
        async (realTaskId, version) => {
          const realParentId = await resolveBackendTaskId(parentId);
          if (!realParentId) {
            throw new Error("Target parent task not persisted");
          }
          const updated = await updateProjectTaskApi(
            projectId,
            realTaskId,
            version,
            { parentId: realParentId },
          );
          return updated.version;
        },
        () => {
          setItems(previousItems);
        },
      );
    }
  }

  function bulkUpdateSubtasks(
    itemId: string,
    subtaskIds: readonly string[],
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) {
    const previousItems = items;
    const parentItem = items.find((item) => item.id === itemId);
    const affectedSubs = (parentItem?.subtaskItems ?? []).filter((sub) =>
      subtaskIds.includes(sub.id),
    );
    const idSet = new Set(subtaskIds);
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const nextSubtasks = item.subtaskItems.map((sub) => {
          if (!idSet.has(sub.id)) return sub;
          const nextStatus = patch.status ?? sub.status;
          const nextDone =
            patch.status !== undefined
              ? nextStatus === "DONE"
              : patch.done !== undefined
                ? patch.done
                : sub.done;
          return {
            ...sub,
            ...patch,
            status: nextStatus,
            done: nextDone,
          };
        });
        const completed = nextSubtasks.filter((sub) => sub.done).length;
        return {
          ...item,
          subtaskItems: nextSubtasks,
          subtasks: { completed, total: nextSubtasks.length },
        };
      }),
    );

    if (isRealProject) {
      for (const sub of affectedSubs) {
        const prevStatus = sub.status;
        const nextStatus: WorkStatus =
          patch.status !== undefined
            ? patch.status
            : patch.done !== undefined
              ? patch.done
                ? "DONE"
                : "TODO"
              : prevStatus;
        enqueueTaskMutation(
          sub.id,
          async (realSubId, version) => {
            let currentVer = version;
            if (prevStatus !== nextStatus) {
              currentVer = await performBackendStatusTransition(
                realSubId,
                currentVer,
                prevStatus,
                nextStatus,
              );
            }
            if (patch.priority !== undefined || patch.assignee !== undefined) {
              const updated = await updateProjectTaskApi(
                projectId,
                realSubId,
                currentVer,
                {
                  ...(patch.priority !== undefined
                    ? { priority: patch.priority }
                    : {}),
                  ...(patch.assignee !== undefined
                    ? {
                        assigneeId: OBJECT_ID_PATTERN.test(patch.assignee.id)
                          ? patch.assignee.id
                          : null,
                      }
                    : {}),
                },
              );
              currentVer = updated.version;
            }
            return currentVer;
          },
          () => {
            setItems(previousItems);
          },
        );
      }
    }
  }

  async function addComment(itemId: string, text: string): Promise<boolean> {
    if (isRealProject) {
      try {
        const realId = await resolveBackendTaskId(itemId);
        if (!realId) throw new Error("Task not persisted");
        const created = await createTaskCommentApi(projectId, realId, text);
        setItems((current) => current.map((item) =>
          item.id === itemId || item.id === realId
            ? {
                ...item,
                comments: [...(item.comments ?? []), {
                  id: created.id,
                  author: currentUserPerson?.name ?? defaultAssigneePerson.name,
                  initials: currentUserPerson?.initials ?? defaultAssigneePerson.initials,
                  createdAt: formatCommentDateTime(created.createdAt),
                  text: created.body,
                }],
              }
            : item,
        ));
        return true;
      } catch (error) {
        setAnnouncement(describeMutationError(error));
        return false;
      }
    }

    setItems((current) => current.map((item) =>
      item.id === itemId
        ? {
            ...item,
            comments: [...(item.comments ?? []), {
              id: `comment-${Date.now()}`,
              author: currentUserPerson?.name ?? defaultAssigneePerson.name,
              initials: currentUserPerson?.initials ?? defaultAssigneePerson.initials,
              createdAt: formatCommentDateTime(new Date()),
              text,
            }],
          }
        : item,
    ));
    return true;
  }

  async function addSubtaskComment(subtaskId: string, text: string): Promise<boolean> {
    if (!isRealProject) return false;
    try {
      const realId = await resolveBackendTaskId(subtaskId);
      if (!realId) throw new Error("Subtask not persisted");
      const created = await createTaskCommentApi(projectId, realId, text);
      setItems((current) => current.map((item) => ({
        ...item,
        subtaskItems: item.subtaskItems?.map((sub) =>
          sub.id === subtaskId || sub.id === realId
            ? {
                ...sub,
                comments: [...(sub.comments ?? []), {
                  id: created.id,
                  author: currentUserPerson?.name ?? defaultAssigneePerson.name,
                  initials: currentUserPerson?.initials ?? defaultAssigneePerson.initials,
                  createdAt: formatCommentDateTime(created.createdAt),
                  text: created.body,
                }],
              }
            : sub,
        ),
      })));
      return true;
    } catch (error) {
      setAnnouncement(describeMutationError(error));
      return false;
    }
  }

  async function addWorklog(itemId: string, minutes: number, noteInput: string): Promise<boolean> {
    if (!isRealProject || minutes < 1 || minutes > 1440) return false;
    try {
      const realId = await resolveBackendTaskId(itemId);
      if (!realId) return false;
      const created = await createTaskWorklogApi(projectId, realId, {
        minutes,
        note: noteInput || null,
      });
      setItems((current) => current.map((item) =>
        item.id === itemId || item.id === realId
          ? {
              ...item,
              worklogs: [...(item.worklogs ?? []), {
                id: created.id,
                author: currentUserPerson?.name ?? defaultAssigneePerson.name,
                timeSpent: formatWorklogMinutes(created.minutes),
                note: created.note ?? "",
                createdAt: formatCommentDateTime(created.loggedAt || created.createdAt),
              }],
            }
          : item,
      ));
      return true;
    } catch (error) {
      setAnnouncement(describeMutationError(error));
      return false;
    }
  }

  async function addSubtaskWorklog(subtaskId: string, minutes: number, noteInput: string): Promise<boolean> {
    if (!isRealProject || minutes < 1 || minutes > 1440) return false;
    try {
      const realId = await resolveBackendTaskId(subtaskId);
      if (!realId) return false;
      const created = await createTaskWorklogApi(projectId, realId, {
        minutes,
        note: noteInput || null,
      });
      setItems((current) => current.map((item) => ({
        ...item,
        subtaskItems: item.subtaskItems?.map((sub) =>
          sub.id === subtaskId || sub.id === realId
            ? {
                ...sub,
                worklogs: [...(sub.worklogs ?? []), {
                  id: created.id,
                  author: currentUserPerson?.name ?? defaultAssigneePerson.name,
                  timeSpent: formatWorklogMinutes(created.minutes),
                  note: created.note ?? "",
                  createdAt: formatCommentDateTime(created.loggedAt || created.createdAt),
                }],
                loggedTime: formatWorklogMinutes(
                  parseWorklogMinutes(sub.loggedTime ?? "") + created.minutes,
                ),
              }
            : sub,
        ),
      })));
      return true;
    } catch (error) {
      setAnnouncement(describeMutationError(error));
      return false;
    }
  }

  async function bulkUpdateStatus(nextStatus: WorkStatus) {
    const ids = [...selectedIds].filter((id) =>
      items.some((item) => item.id === id && item.status !== nextStatus),
    );
    setSelectedIds(new Set());
    const results = await Promise.all(
      ids.map((id) => Promise.resolve(updateItemStatus(id, nextStatus))),
    );
    const failedIds = ids.filter((_, index) => results[index] === false);
    if (failedIds.length > 0) {
      setSelectedIds((current) => new Set([...current, ...failedIds]));
    } else if (ids.length > 0) {
      setAnnouncement(t("bulkStatusUpdated", { count: ids.length }));
    }
  }

  function requestBulkTaskCancellation() {
    const ids = [...selectedIds];
    if (ids.length > 0) setCancelConfirmationIds(ids);
  }

  async function confirmTaskCancellation() {
    if (!cancelConfirmationIds?.length) return;
    const ids = cancelConfirmationIds;
    setCancelConfirmationIds(null);
    const results = await Promise.all(
      ids.map((id) => Promise.resolve(updateItemStatus(id, "CANCELLED"))),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    if (results.every((result) => result !== false)) {
      setAnnouncement(
        ids.length === 1
          ? t("taskCancelled")
          : t("tasksCancelled", { count: ids.length }),
      );
    }
  }

  function exportCsv(allFields = true) {
    if (typeof window ==="undefined") return;
    const header = allFields
      ? [
          "Key",
          "Summary",
          "Type",
          "Status",
          "Priority",
          "Assignee",
          "Reporter",
          "Resolution",
          "Created",
          "DueDate",
        ]
      : ["Key","Summary","Status","Priority","Assignee"];
    const rows = visibleItems.map((item) =>
      allFields
        ? [
            item.key,
            `"${item.title.replace(/"/g,'""')}"`,
            item.type,
            item.status,
            item.priority,
            `"${item.assignee.name}"`,
            `"${item.reporter.name}"`,
            item.resolution,
            item.createdAt,
            item.dueDate ??"",
          ]
        : [
            item.key,
            `"${item.title.replace(/"/g,'""')}"`,
            item.status,
            item.priority,
            `"${item.assignee.name}"`,
          ],
    );
    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectCode ||"workspace"}-work-items.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setAnnouncement("Exported work items to CSV.");
  }

  function importCsvItem(fileName: string) {
    addPreviewItem({
      title: `[IMPORTED] Work item imported from ${fileName}`,
      type:"TASK",
      priority:"MEDIUM",
      assignee: defaultAssigneePerson,
      dueDate: null,
      status:"TODO",
    });
  }

  const showFilterToolbar =
    view ==="overview"||
    view ==="list"||
    view ==="board"||
    view ==="calendar";

  if (!projectProp) {
    if (user.isPending || (organizationId && project.isPending)) {
      return <ProjectState />;
    }
    if (user.isError) return <ProjectState error={user.error} />;
    if (!organizationId) return <ProjectState error={new Error("No trusted organization")} />;
    if (project.isError) {
      return <ProjectState error={project.error} retry={() => void project.refetch()} />;
    }
    if (!project.data) return <ProjectState />;
  }

  if (isRealProject && tasksQuery.isPending) return <ProjectState />;
  if (isRealProject && tasksQuery.isError) {
    return <ProjectState error={tasksQuery.error} retry={() => void tasksQuery.refetch()} />;
  }

  return (
    <div
      className={`@container w-full min-w-0 space-y-2.5 ${
        isFullscreen
          ?"fixed inset-0 z-50 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950"
          : embedded
            ?""
            :"-mx-4 -my-4 px-3 py-2 md:-mx-6 md:-my-6 md:px-4 md:py-2.5"
      }`}
    >
      {!embedded ? (
        <WorkPageHeader
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          projects={projects}
          onProjectChange={onProjectChange}
          view={view}
          onViewChange={setView}
          onCreate={() => setCreateOpen(true)}
          createButtonRef={createButtonRef}
          showCreateButton={view !=="work-notes"}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          itemCount={view !=="work-notes"? visibleItems.length : undefined}
          hideProjectBanner={hideProjectBanner}
          isPreview={!isRealProject}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!isRealProject && <span className="inline-flex shrink-0 rounded border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
              {t("previewData")}
            </span>}
            <p
              className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400"
              aria-live="polite"
            >
              {t("workItemCount", { count: visibleItems.length })}
            </p>
          </div>
          <button
            ref={createButtonRef}
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded bg-brand-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <PlusIcon
              viewBox="0 0 12 12"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            {t("create")}
          </button>
        </div>
      )}

      {mutationError && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {activityRetryTarget ? "Could not load activity." : "Could not save changes."}
            </p>
            <p className="break-words">{mutationError}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMutationError(null);
              if (activityRetryTarget) {
                const retryTarget = activityRetryTarget;
                setActivityRetryTarget(null);
                if (retryTarget === "parent") {
                  setParentActivityRetryVersion((version) => version + 1);
                } else {
                  setSubtaskActivityRetryVersion((version) => version + 1);
                }
              }
            }}
            className="shrink-0 cursor-pointer font-medium underline underline-offset-2"
          >
            {activityRetryTarget ? "Retry activity" : "Dismiss"}
          </button>
        </div>
      )}

      {fullPageWorkItem ? (
        <WorkItemDetailDialog
          mode="page"
          item={fullPageWorkItem}
          worklogOpenRequest={worklogOpenRequest}
          isActivityLoading={taskActivityLoadingId === fullPageWorkItem.id}
          isSubtaskActivityLoading={subtaskActivityLoadingId === fullPageSubtaskId}
          allItems={items}
          people={projectPeople}
          currentUserPerson={currentUserPerson}
          initialSubtaskId={fullPageSubtaskId}
          onSelectSubtask={(subtaskId) => {
            setFullPageSubtaskId(subtaskId);
            const subtask = fullPageWorkItem.subtaskItems?.find((candidate) => candidate.id === subtaskId);
            updateTaskHash(subtask?.key ?? fullPageWorkItem.key);
          }}
          onClose={() => {
            clearTaskHash();
            setWorklogOpenRequest(null);
            setTaskActivityLoadingId(null);
            setSubtaskActivityLoadingId(null);
            setFullPageSubtaskId(null);
            setFullPageWorkItemId(null);
          }}
          onStatusChange={updateItemStatus}
          onTitleChange={updateItemTitle}
          onPriorityChange={updateItemPriority}
          onAssigneeChange={updateItemAssignee}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={addSubtask}
          onAddExistingTaskAsSubtask={addExistingTaskAsSubtask}
          onUpdateSubtask={updateSubtask}
          onDeleteSubtask={isRealProject ? undefined : deleteSubtask}
          onCloneSubtask={cloneSubtask}
          onReorderSubtask={isRealProject ? undefined : reorderSubtask}
          onConvertSubtaskToTask={convertSubtaskToTask}
          onMoveSubtaskToParent={moveSubtaskToParent}
          onBulkUpdateSubtasks={bulkUpdateSubtasks}
          onAddComment={addComment}
          onAddSubtaskComment={isRealProject ? addSubtaskComment : undefined}
          onAddWorklog={isRealProject ? addWorklog : undefined}
          onAddSubtaskWorklog={isRealProject ? addSubtaskWorklog : undefined}
        />
      ) : view ==="work-notes"? (
        <WorkNotesWorkspace
          projectId={projectId}
          project={resolvedProject}
          embedded
        />
      ) : (
        <>
          {showFilterToolbar && (
            <WorkToolbar
              query={query}
              status={status}
              priority={priority}
              assigneeId={assigneeId}
              groupBy={groupBy}
              people={projectPeople}
              filterConditions={filterConditions}
              hideDone={hideDone}
              showHierarchy={showHierarchy}
              highlightHighPriority={highlightHighPriority}
              highlightDoneRows={highlightDoneRows}
              items={items}
              onQueryChange={setQuery}
              onStatusChange={setStatus}
              onPriorityChange={setPriority}
              onAssigneeChange={setAssigneeId}
              onGroupByChange={setGroupBy}
              onClearFilters={clearFilters}
              onAddFilterCondition={addFilterCondition}
              onRemoveFilterCondition={removeFilterCondition}
              onToggleHideDone={setHideDone}
              onToggleShowHierarchy={setShowHierarchy}
              onToggleHighlightHighPriority={setHighlightHighPriority}
              onToggleHighlightDoneRows={setHighlightDoneRows}
              onOpenAiCopilot={isRealProject ? undefined : () => setAiCopilotOpen(true)}
              onExportCsv={exportCsv}
              onImportCsvItem={isRealProject ? undefined : importCsvItem}
              onBulkSelectAll={() =>
                setSelectedIds(new Set(visibleItems.map((i) => i.id)))
              }
              onGoToReports={() => setView("reports")}
              onRefresh={() => {
                void project.refetch();
                if (isRealProject) {
                  void tasksQuery.refetch();
                  void projectMembersQuery.refetch();
                }
              }}
            />
          )}

          {view ==="list"&& selectedIds.size > 0 && (
            <div
              role="region"
              aria-label="Bulk actions toolbar"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-800 bg-gray-900 px-3.5 py-2 text-white shadow-theme-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand-500 px-1.5 text-xs font-bold text-white">
                  {selectedIds.size}
                </span>
                <p className="text-xs font-medium text-white">
                  {t("selectedCount", { count: selectedIds.size })}
                </p>
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="cursor-pointer text-xs font-semibold text-brand-300 hover:underline"
                >
                  {allVisibleSelected ?"Deselect all":"Select all"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bulkUpdateStatus("DONE")}
                >
                  ✓ Mark as Done
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bulkUpdateStatus("IN_PROGRESS")}
                >
                  Move to In Progress
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestBulkTaskCancellation}
                >
                  ✕ {t("cancelTasksAction")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {t("clearSelection")}
                </Button>
              </div>
            </div>
          )}

          {view ==="timeline" && isRealProject ? (
            <WorkPreviewNotice onOpenList={() => setView("list")} />
          ) : view ==="timeline"? (
            <WorkTimelineView
              items={visibleItems}
              people={projectPeople}
              onOpenItem={openWorkItem}
              onCreate={() => setCreateOpen(true)}
            />
          ) : view ==="development" && isRealProject ? (
            <WorkPreviewNotice onOpenList={() => setView("list")} />
          ) : view ==="development"? (
            <WorkDevelopmentView
              items={visibleItems}
              onCreateItem={addPreviewItem}
            />
          ) : view ==="forms" && isRealProject ? (
            <WorkPreviewNotice onOpenList={() => setView("list")} />
          ) : view ==="forms"? (
            <WorkFormsView onCreateItem={addPreviewItem} />
          ) : view ==="docs" && isRealProject ? (
            <WorkPreviewNotice onOpenList={() => setView("list")} />
          ) : view ==="docs"? (
            <WorkDocsView items={visibleItems} onOpenItem={openWorkItem} />
          ) : view ==="reports" && isRealProject ? (
            <WorkPreviewNotice onOpenList={() => setView("list")} />
          ) : view ==="reports"? (
            <WorkReportsView
              items={visibleItems}
              people={projectPeople}
              onOpenItem={openWorkItem}
            />
          ) : visibleItems.length === 0 &&
            (items.length > 0 ||
              Boolean(query.trim()) ||
              status !== "ALL" ||
              priority !== "ALL" ||
              assigneeId !== "ALL" ||
              filterConditions.length > 0 ||
              hideDone) ? (
            <div
              role="status"
              className="rounded-md border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900"
            >
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                {t("noResultsTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("noResultsDescription")}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 cursor-pointer rounded px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                {t("clearFilters")}
              </button>
            </div>
          ) : view ==="list"? (
            <WorkListView
              groups={groups}
              allItems={items}
              people={projectPeople}
              currentUserPerson={currentUserPerson}
              totalCount={items.length}
              selectedIds={selectedIds}
              allVisibleSelected={allVisibleSelected}
              showHierarchy={showHierarchy}
              highlightHighPriority={highlightHighPriority}
              highlightDoneRows={highlightDoneRows}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              onToggleItem={toggleItem}
              onToggleAll={toggleAllVisible}
              onOpenItem={openWorkItem}
              onOpenFullPage={openFullPageWorkItem}
              onStatusChange={updateItemStatus}
              onPriorityChange={updateItemPriority}
              onAssigneeChange={updateItemAssignee}
              onToggleFlag={isRealProject ? undefined : toggleItemFlag}
              onCancelTask={requestSingleTaskCancellation}
              onToggleSubtask={toggleSubtask}
              onAddSubtask={addSubtask}
              onUpdateSubtask={updateSubtask}
              onDeleteSubtask={isRealProject ? undefined : deleteSubtask}
              onCloneSubtask={cloneSubtask}
              onReorderSubtask={isRealProject ? undefined : reorderSubtask}
              onConvertSubtaskToTask={convertSubtaskToTask}
              onMoveSubtaskToParent={moveSubtaskToParent}
              onOpenSubtask={openSubtask}
              onInlineCreate={(title, type, options) =>
                addPreviewItem({
                  title,
                  type: type ??"TASK",
                  priority:"MEDIUM",
                  assignee: options?.assignee ?? defaultAssigneePerson,
                  dueDate: options?.dueDate ?? null,
                })
              }
              onRefresh={() => {
                void project.refetch();
                if (isRealProject) {
                  void tasksQuery.refetch();
                  void projectMembersQuery.refetch();
                }
              }}
            />
          ) : view ==="overview"? (
            <WorkOverviewView
              items={visibleItems}
              people={projectPeople}
              onOpenItem={openWorkItem}
              onOpenSubtask={openSubtask}
              onOpenReports={() => setView("reports")}
              onOpenList={() => setView("list")}
            />
          ) : view ==="board"? (
            <WorkBoardView
              items={visibleItems}
              people={projectPeople}
              onOpenItem={openWorkItem}
              onOpenSubtask={openSubtask}
              onStatusChange={updateItemStatus}
              onToggleSubtask={toggleSubtask}
              onAddSubtask={addSubtask}
              onUpdateSubtask={updateSubtask}
              onDeleteSubtask={isRealProject ? undefined : deleteSubtask}
              onCloneSubtask={cloneSubtask}
              onConvertSubtaskToTask={convertSubtaskToTask}
              onQuickCreate={(title, targetStatus) =>
                addPreviewItem({
                  title,
                  type:"TASK",
                  priority:"MEDIUM",
                  assignee: defaultAssigneePerson,
                  dueDate: null,
                  status: targetStatus,
                })
              }
            />
          ) : (
            <WorkCalendarView
              items={visibleItems}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onOpenItem={openWorkItem}
            />
          )}
        </>
      )}

      <p className="sr-only"role="status"aria-live="polite">
        {announcement}
      </p>
      <Modal
        isOpen={cancelConfirmationIds !== null}
        onClose={() => setCancelConfirmationIds(null)}
        showCloseButton={false}
        backdropClassName="bg-gray-900/40 backdrop-blur-sm"
        className="mx-4 max-w-md p-6 shadow-theme-lg"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("cancelTaskTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("cancelTaskDescription", { count: cancelConfirmationIds?.length ?? 0 })}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelConfirmationIds(null)}>
              {t("keepTask")}
            </Button>
            <Button type="button" onClick={() => void confirmTaskCancellation()}>
              {t("confirmTaskCancellation")}
            </Button>
          </div>
        </div>
      </Modal>
      <WorkItemCreateDialog
        isOpen={createOpen}
        isPreview={!isRealProject}
        people={projectPeople}
        onClose={() => setCreateOpen(false)}
        onCreate={addPreviewItem}
      />
      <WorkAiCopilotDialog
        isOpen={aiCopilotOpen && !isRealProject}
        projectName={projectName}
        items={visibleItems}
        onClose={() => setAiCopilotOpen(false)}
      />
      {activeWorkItem && (
        <WorkItemDetailDialog
          mode="modal"
          item={activeWorkItem}
          worklogOpenRequest={worklogOpenRequest}
          isActivityLoading={taskActivityLoadingId === activeWorkItem.id}
          isSubtaskActivityLoading={subtaskActivityLoadingId === activeSubtaskId}
          allItems={items}
          people={projectPeople}
          currentUserPerson={currentUserPerson}
          initialSubtaskId={activeSubtaskId}
          onSelectSubtask={(subtaskId) => {
            setActiveSubtaskId(subtaskId);
            const subtask = activeWorkItem.subtaskItems?.find((candidate) => candidate.id === subtaskId);
            updateTaskHash(subtask?.key ?? activeWorkItem.key);
          }}
          onOpenFullPage={(subId) => openFullPageWorkItem(activeWorkItem, subId)}
          onClose={() => {
            clearTaskHash();
            setWorklogOpenRequest(null);
            setTaskActivityLoadingId(null);
            setSubtaskActivityLoadingId(null);
            setActiveSubtaskId(null);
            setActiveWorkItemId(null);
          }}
          onStatusChange={updateItemStatus}
          onTitleChange={updateItemTitle}
          onPriorityChange={updateItemPriority}
          onAssigneeChange={updateItemAssignee}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={addSubtask}
          onAddExistingTaskAsSubtask={addExistingTaskAsSubtask}
          onUpdateSubtask={updateSubtask}
          onDeleteSubtask={isRealProject ? undefined : deleteSubtask}
          onCloneSubtask={cloneSubtask}
          onReorderSubtask={isRealProject ? undefined : reorderSubtask}
          onConvertSubtaskToTask={convertSubtaskToTask}
          onMoveSubtaskToParent={moveSubtaskToParent}
          onBulkUpdateSubtasks={bulkUpdateSubtasks}
          onAddComment={addComment}
          onAddSubtaskComment={isRealProject ? addSubtaskComment : undefined}
          onAddWorklog={isRealProject ? addWorklog : undefined}
          onAddSubtaskWorklog={isRealProject ? addSubtaskWorklog : undefined}
        />
      )}
    </div>
  );
}

function WorkPreviewNotice({ onOpenList }: { onOpenList: () => void }) {
  const t = useTranslations("work");
  return (
    <section
      role="status"
      className="rounded-md border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
        {t("viewPreviewTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t("viewPreviewDescription")}
      </p>
      <Button type="button" variant="outline" className="mt-4" onClick={onOpenList}>
        {t("openWorkList")}
      </Button>
    </section>
  );
}

function groupWorkItems(
  items: readonly WorkItem[],
  groupBy: WorkGroupBy,
  people: readonly WorkPerson[],
): WorkItemGroup[] {
  if (groupBy ==="NONE") {
    return [{ id:"all", label: null, labelKind:"text", items }];
  }

  const grouped = new Map<string, WorkItem[]>();
  for (const item of items) {
    const key =
      groupBy ==="STATUS"
        ? item.status
        : groupBy ==="ASSIGNEE"
          ? item.assignee.id
          : item.priority;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  const keys = [...grouped.keys()];
  if (groupBy ==="STATUS") {
    keys.sort(
      (left, right) =>
        WORK_STATUS_ORDER.indexOf(left as WorkStatus) -
        WORK_STATUS_ORDER.indexOf(right as WorkStatus),
    );
  } else if (groupBy ==="PRIORITY") {
    const priorityOrder: WorkPriority[] = ["HIGH","MEDIUM","LOW"];
    keys.sort(
      (left, right) =>
        priorityOrder.indexOf(left as WorkPriority) -
        priorityOrder.indexOf(right as WorkPriority),
    );
  } else {
    keys.sort((left, right) => left.localeCompare(right));
  }

  return keys.map((key) => {
    const label =
      groupBy ==="ASSIGNEE"
        ? (people.find((person) => person.id === key)?.name ??
            (key === UNASSIGNED_WORK_PERSON.id
              ? UNASSIGNED_WORK_PERSON.name
              : key))
        : key;
    return {
      id: key,
      label,
      labelKind:
        groupBy ==="STATUS"
          ?"status"
          : groupBy ==="PRIORITY"
            ?"priority"
            :"text",
      items: grouped.get(key) ?? [],
    };
  });
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase();
}
