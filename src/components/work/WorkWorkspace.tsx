"use client";

import { useEffect, useMemo, useRef, useState } from"react";
import { useTranslations } from"next-intl";
import {
  ApiError,
  isAccessOrResourceUnavailableError,
} from"@/lib/api-client";
import { useCurrentUserQuery } from"@/lib/queries/auth/useAuth";
import { useProjectMembersQuery } from"@/lib/queries/projects/useProjectMembers";
import { useProjectQuery, type Project } from"@/lib/queries/projects/useProjects";
import ProjectState from"@/components/projects/ProjectState";
import Button from"@/components/ui/button/Button";
import { BackgroundRefreshError, UpdatingStatus } from"@/components/ui/loading/AsyncStatus";
import { PlusIcon } from"@/icons";
import WorkBoardView from"./WorkBoardView";
import WorkCalendarView from"./WorkCalendarView";
import WorkItemCreateDialog from"./WorkItemCreateDialog";
import WorkItemDetailDialog from"./WorkItemDetailDialog";
import WorkListView from"./WorkListView";
import WorkOverviewView from"./WorkOverviewView";
import WorkPageHeader, { type WorkView } from"./WorkPageHeader";
import WorkReportsView from"./WorkReportsView";
import WorkTimelineView from"./WorkTimelineView";
import WorkToolbar from"./WorkToolbar";
import { importJiraRows, parseJiraImportCsv, type JiraImportProgress } from "./jira-import";
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
  type BackendTaskHistoryEvent,
  type BackendTaskStatus,
  completeProjectSprintApi,
  createProjectTaskApi,
  createTaskCommentApi,
  createTaskWorklogApi,
  fetchAllTaskComments,
  fetchAllTaskHistory,
  fetchAllTaskWorklogs,
  fetchProjectTaskDetail,
  transitionProjectTaskApi,
  updateProjectTaskApi,
  useProjectSprintsQuery,
  useProjectTasksQuery,
} from"@/lib/queries/tasks/useTasks";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const UNASSIGNED_WORK_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "UN",
};

const OUT_OF_SCOPE_WORK_VIEWS = new Set<WorkView>([
  "development",
  "forms",
  "docs",
  "work-notes",
]);

function isOutOfScopeWorkView(view: WorkView): boolean {
  return OUT_OF_SCOPE_WORK_VIEWS.has(view);
}

function WorkItemsLoadingState({
  view,
  label,
}: {
  view: WorkView;
  label: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {view === "board" ? (
        <div aria-hidden="true" className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((column) => (
            <div key={column} className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="continuum-shimmer h-4 w-24 rounded-md" />
              {[0, 1, 2].map((card) => (
                <div key={card} className="space-y-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                  <div className="continuum-shimmer h-4 w-3/4 rounded-md" />
                  <div className="continuum-shimmer h-3 w-full rounded-md" />
                  <div className="continuum-shimmer h-3 w-2/3 rounded-md" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : view === "calendar" ? (
        <div aria-hidden="true" className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, item) => (
            <div key={item} className="min-h-20 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
              <div className="continuum-shimmer h-3 w-6 rounded-md" />
              {item % 3 === 0 && <div className="continuum-shimmer mt-3 h-5 w-full rounded-md" />}
            </div>
          ))}
        </div>
      ) : view === "overview" ? (
        <div aria-hidden="true" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="continuum-shimmer h-3 w-24 rounded-md" />
                <div className="continuum-shimmer h-7 w-16 rounded-md" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((item) => <div key={item} className="continuum-shimmer h-16 rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div aria-hidden="true" className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center gap-4 px-4 py-4">
                <div className="continuum-shimmer size-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="continuum-shimmer h-4 w-40 max-w-full rounded-md" />
                  <div className="continuum-shimmer h-3 w-64 max-w-full rounded-md" />
                </div>
                <div className="continuum-shimmer hidden h-6 w-20 rounded-full sm:block" />
                <div className="continuum-shimmer hidden h-8 w-24 rounded-lg md:block" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

export function formatWorklogMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function parseWorklogMinutes(input: string): number {
  const raw = input.trim().toLowerCase();
  if (!raw) return 0;
  const tokenMatch = raw.match(
    /^(?:(\d+(?:\.\d+)?)\s*d)?\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?$/,
  );
  if (tokenMatch && (tokenMatch[1] || tokenMatch[2] || tokenMatch[3])) {
    const days = tokenMatch[1] ? parseFloat(tokenMatch[1]) : 0;
    const hours = tokenMatch[2] ? parseFloat(tokenMatch[2]) : 0;
    const mins = tokenMatch[3] ? parseFloat(tokenMatch[3]) : 0;
    const totalMinutes = days * 8 * 60 + hours * 60 + mins;
    if (totalMinutes <= 0) return 0;
    return Math.max(1, Math.min(1440, Math.round(totalMinutes)));
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = parseFloat(raw);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return Math.max(1, Math.min(1440, Math.round(numeric)));
    }
  }
  return 0;
}

function formatHistoryEventAction(
  event: BackendTaskHistoryEvent,
  itemKey: string,
): string {
  const type = event.type.toUpperCase();
  if (type === "TASK_CREATED") {
    return `created work item ${itemKey}`;
  }
  if (
    event.fromStatus &&
    event.toStatus &&
    event.fromStatus !== event.toStatus
  ) {
    return `updated status from ${event.fromStatus} to ${event.toStatus}`;
  }
  if (event.toStatus) {
    return `updated status to ${event.toStatus}`;
  }
  if (type === "TASK_COMMENT_ADDED") {
    return "added a comment";
  }
  if (type === "TASK_WORKLOG_ADDED") {
    return event.minutes
      ? `logged ${formatWorklogMinutes(event.minutes)} of work`
      : "logged work";
  }
  if (event.changedFields && event.changedFields.length > 0) {
    return `updated ${event.changedFields.join(", ")}`;
  }
  if (event.reason) {
    return `${event.type.toLowerCase().replace(/_/g, " ")} (${event.reason})`;
  }
  return event.type.toLowerCase().replace(/_/g, " ");
}

function mapBackendStatusToWorkStatus(status: BackendTaskStatus): WorkStatus {
  if (status ==="IN_PROGRESS"|| status ==="BLOCKED") return"IN_PROGRESS";
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
  hasMoreProjects,
  isLoadingMoreProjects,
  onLoadMoreProjects,
  view: controlledView,
  onViewChange,
  embedded = false,
  hideProjectBanner = false,
}: {
  projectId: string;
  project?: Project;
  projects?: readonly Project[];
  onProjectChange?: (projectId: string) => void;
  hasMoreProjects?: boolean;
  isLoadingMoreProjects?: boolean;
  onLoadMoreProjects?: () => void;
  view?: WorkView;
  onViewChange?: (view: WorkView) => void;
  embedded?: boolean;
  hideProjectBanner?: boolean;
}) {
  const t = useTranslations("work");
  const common = useTranslations("common");
  const user = useCurrentUserQuery();
  const userAccessLost = isAccessOrResourceUnavailableError(user.error);
  const visibleUser = userAccessLost ? undefined : user.data;
  const organizationId = projectProp?.organizationId ?? visibleUser?.organizationId ??"";
  const project = useProjectQuery(projectProp ?"": organizationId, projectId);
  const projectAccessLost = isAccessOrResourceUnavailableError(project.error);
  const visibleProject = projectAccessLost ? undefined : project.data;
  const resolvedProject = projectProp ?? visibleProject;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeWorkItemId, setActiveWorkItemId] = useState<string | null>(null);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [unavailableTaskNotice, setUnavailableTaskNotice] = useState<string | null>(null);
  const [deepLinkOverrideTaskId, setDeepLinkOverrideTaskId] = useState<string | null>(null);
  const handledDeepLinkTaskRef = useRef<string | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const dialogWasOpenRef = useRef(false);
  const detailWasOpenRef = useRef(false);
  const tasksQuery = useProjectTasksQuery(projectId);
  const taskAccessLost = isAccessOrResourceUnavailableError(tasksQuery.error);
  const visibleTasks = taskAccessLost ? undefined : tasksQuery.data;
  const sprintsQuery = useProjectSprintsQuery(isRealProject ? projectId : "");
  const sprintsAccessLost = isAccessOrResourceUnavailableError(sprintsQuery.error);
  const visibleSprints = sprintsAccessLost ? undefined : sprintsQuery.data;
  const activeSprint = visibleSprints?.items.find(
    (sprint) => sprint.status === "ACTIVE",
  ) ?? null;
  const projectMembersQuery = useProjectMembersQuery(
    isRealProject ? organizationId : "",
    isRealProject ? projectId : "",
    { page: 1, pageSize: 100, status: "ACTIVE" },
  );
  const projectMembersAccessLost = isAccessOrResourceUnavailableError(projectMembersQuery.error);
  const visibleProjectMembers = projectMembersAccessLost ? undefined : projectMembersQuery.data;
  const currentUserPerson = useMemo<WorkPerson | null>(() => {
    if (!visibleUser) return null;
    const displayName = visibleUser.name?.trim() || "Current User";
    return {
      id: visibleUser.id,
      name: displayName,
      initials: toPersonInitials(displayName) || "ME",
    };
  }, [visibleUser]);
  const projectPeople = useMemo<readonly WorkPerson[]>(() => {
    if (!isRealProject) {
      return PREVIEW_PEOPLE;
    }
    const memberships = visibleProjectMembers?.data ?? [];
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
  }, [currentUserPerson, isRealProject, visibleProjectMembers]);
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

  async function completeActiveSprint(): Promise<void> {
    if (!activeSprint) throw new Error("There is no active sprint to complete.");
    await completeProjectSprintApi(
      projectId,
      activeSprint.id,
      activeSprint.version,
    );
    setAnnouncement(t("sprintCompleted"));
    void tasksQuery.refetch();
    void sprintsQuery.refetch();
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

    if (fromStatus === toStatus) return version;

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
        },
      );
      return tr2.version;
    }

    const tr = await transitionProjectTaskApi(projectId, realId, version, {
      fromStatus,
      toStatus,
      ...(fromStatus === "DONE"
        ? { reason: "Reopened from workspace UI" }
        : {}),
    });
    return tr.version;
  }

  useEffect(() => {
    if (!isRealProject || !visibleTasks) return;
    const rawTasks = visibleTasks.items.filter(
      (t) => t.projectId === projectId && t.status !== "CANCELLED",
    );

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
            visibleUser,
            isRealProject,
          ),
          reporter: resolvePersonById(
            sub.createdBy,
            projectPeopleById,
            visibleUser,
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
          visibleUser,
          isRealProject,
        ),
        reporter: resolvePersonById(
          t.createdBy,
          projectPeopleById,
          visibleUser,
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
              ...(prevSub.comments !== undefined
                ? { comments: prevSub.comments }
                : {}),
              ...(prevSub.worklogs !== undefined
                ? { worklogs: prevSub.worklogs }
                : {}),
              ...(prevSub.history !== undefined
                ? { history: prevSub.history }
                : {}),
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
            ...(prev.history && prev.history.length > 0
              ? { history: prev.history }
              : {}),
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
    visibleTasks,
    visibleUser,
  ]);

  const openedTaskId = fullPageWorkItemId ?? activeWorkItemId;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDeepLink = (event: Event) => {
      const detailUrl = (event as CustomEvent<{ url?: string }>).detail?.url;
      if (detailUrl) {
        const qIndex = detailUrl.indexOf("?");
        const searchPart = qIndex >= 0 ? detailUrl.slice(qIndex) : "";
        const nextId = new URLSearchParams(searchPart).get("taskId")?.trim() ?? null;
        if (nextId) {
          handledDeepLinkTaskRef.current = null;
          setDeepLinkOverrideTaskId(nextId);
        }
      } else {
        handledDeepLinkTaskRef.current = null;
        setDeepLinkOverrideTaskId(
          new URLSearchParams(window.location.search).get("taskId")?.trim() ?? null,
        );
      }
    };
    window.addEventListener("continuum:deep-link", onDeepLink);
    window.addEventListener("popstate", onDeepLink);
    return () => {
      window.removeEventListener("continuum:deep-link", onDeepLink);
      window.removeEventListener("popstate", onDeepLink);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const deepLinkTaskId =
      deepLinkOverrideTaskId ?? params.get("taskId")?.trim() ?? null;
    if (!deepLinkTaskId) return;
    if (handledDeepLinkTaskRef.current === deepLinkTaskId) return;

    if (isRealProject && !tasksQuery.isFetched) {
      return;
    }

    const directItem = items.find((item) => item.id === deepLinkTaskId);
    if (directItem) {
      handledDeepLinkTaskRef.current = deepLinkTaskId;
      queueMicrotask(() => {
        setUnavailableTaskNotice(null);
        setActiveSubtaskId(null);
        setActiveWorkItemId(directItem.id);
      });
      return;
    }

    const parentWithSubtask = items.find((item) =>
      (item.subtaskItems ?? []).some((sub) => sub.id === deepLinkTaskId),
    );
    if (parentWithSubtask) {
      handledDeepLinkTaskRef.current = deepLinkTaskId;
      queueMicrotask(() => {
        setUnavailableTaskNotice(null);
        setActiveWorkItemId(parentWithSubtask.id);
        setActiveSubtaskId(deepLinkTaskId);
      });
      return;
    }

    if (isRealProject && visibleTasks) {
      const rawMatched = visibleTasks.items.find(
        (t) => t.id === deepLinkTaskId && t.status !== "CANCELLED",
      );
      if (rawMatched) {
        // Wait for items state sync effect to populate `items`
        return;
      }
      handledDeepLinkTaskRef.current = deepLinkTaskId;
      queueMicrotask(() => {
        setUnavailableTaskNotice(t("contentUnavailable"));
      });
      return;
    }

    if (!isRealProject || tasksQuery.isError) {
      handledDeepLinkTaskRef.current = deepLinkTaskId;
      queueMicrotask(() => {
        setUnavailableTaskNotice(t("contentUnavailable"));
      });
    }
  }, [deepLinkOverrideTaskId, isRealProject, items, t, visibleTasks, tasksQuery.isError, tasksQuery.isFetched]);
  useEffect(() => {
    if (!isRealProject || !openedTaskId || !OBJECT_ID_PATTERN.test(openedTaskId)) {
      setActivityError(null);
      return;
    }
    let cancelled = false;
    setActivityError(null);
    void (async () => {
      try {
        let fetchFailed = false;
        const [detail, commentItems, worklogsData, historyItems] =
          await Promise.all([
            fetchProjectTaskDetail(projectId, openedTaskId),
            fetchAllTaskComments(projectId, openedTaskId).catch((err) => {
              fetchFailed = true;
              if (!cancelled) {
                setActivityError(describeMutationError(err));
              }
              return null;
            }),
            fetchAllTaskWorklogs(projectId, openedTaskId).catch((err) => {
              fetchFailed = true;
              if (!cancelled) {
                setActivityError(describeMutationError(err));
              }
              return null;
            }),
            fetchAllTaskHistory(projectId, openedTaskId).catch((err) => {
              const msg = err instanceof Error ? err.message : "";
              if (!msg.includes("Unexpected API path")) {
                fetchFailed = true;
                if (!cancelled) {
                  setActivityError(describeMutationError(err));
                }
              }
              return null;
            }),
          ]);
        if (cancelled) return;
        if (!fetchFailed) {
          setActivityError(null);
        }
        taskVersionsRef.current.set(detail.id, detail.version);
        const liveComments = commentItems?.map((c) => {
          const authorPerson = resolvePersonById(
            c.authorId,
            projectPeopleById,
            visibleUser,
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
        const liveWorklogs = worklogsData?.items.map((w) => {
          const authorPerson = resolvePersonById(
            w.authorId,
            projectPeopleById,
            visibleUser,
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
        const liveHistory = historyItems?.map((ev) => {
          const actorName =
            ev.actor?.fullName ||
            resolvePersonById(
              ev.actor?.id ?? null,
              projectPeopleById,
              visibleUser,
              isRealProject,
            ).name;
          return {
            id: ev.id,
            author: actorName,
            action: formatHistoryEventAction(ev, detail.key),
            createdAt: formatCommentDateTime(ev.occurredAt),
          };
        });
        setItems((current) =>
          current.map((item) =>
            item.id === openedTaskId
              ? {
                  ...item,
                  ...(detail.description ? { description: detail.description } : {}),
                  ...(liveComments ? { comments: liveComments } : {}),
                  ...(liveWorklogs ? { worklogs: liveWorklogs } : {}),
                  ...(liveHistory ? { history: liveHistory } : {}),
                }
              : item,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!cancelled && !msg.includes("Unexpected API path")) {
          setActivityError(describeMutationError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRealProject, openedTaskId, projectId, projectPeopleById, visibleUser]);

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
    void (async () => {
      try {
        let fetchFailed = false;
        const [subDetail, subCommentItems, subWorklogsData, subHistoryItems] =
          await Promise.all([
            fetchProjectTaskDetail(projectId, openedSubtaskId),
            fetchAllTaskComments(projectId, openedSubtaskId).catch((err) => {
              fetchFailed = true;
              if (!cancelled) {
                setActivityError(describeMutationError(err));
              }
              return null;
            }),
            fetchAllTaskWorklogs(projectId, openedSubtaskId).catch((err) => {
              fetchFailed = true;
              if (!cancelled) {
                setActivityError(describeMutationError(err));
              }
              return null;
            }),
            fetchAllTaskHistory(projectId, openedSubtaskId).catch((err) => {
              const msg = err instanceof Error ? err.message : "";
              if (!msg.includes("Unexpected API path")) {
                fetchFailed = true;
                if (!cancelled) {
                  setActivityError(describeMutationError(err));
                }
              }
              return null;
            }),
          ]);
        if (cancelled) return;
        if (!fetchFailed) {
          setActivityError(null);
        }
        taskVersionsRef.current.set(subDetail.id, subDetail.version);
        const liveSubComments = subCommentItems?.map((c) => {
          const authorPerson = resolvePersonById(
            c.authorId,
            projectPeopleById,
            visibleUser,
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
        const liveSubWorklogs = subWorklogsData?.items.map((w) => {
          const authorPerson = resolvePersonById(
            w.authorId,
            projectPeopleById,
            visibleUser,
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
        const liveSubHistory = subHistoryItems?.map((ev) => {
          const actorName =
            ev.actor?.fullName ||
            resolvePersonById(
              ev.actor?.id ?? null,
              projectPeopleById,
              visibleUser,
              isRealProject,
            ).name;
          return {
            id: ev.id,
            author: actorName,
            action: formatHistoryEventAction(ev, subDetail.key),
            createdAt: formatCommentDateTime(ev.occurredAt),
          };
        });
        const totalLogged =
          subWorklogsData && subWorklogsData.totalMinutes > 0
            ? formatWorklogMinutes(subWorklogsData.totalMinutes)
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
                      ...(subDetail.description
                        ? { description: subDetail.description }
                        : {}),
                      ...(liveSubComments ? { comments: liveSubComments } : {}),
                      ...(liveSubWorklogs ? { worklogs: liveSubWorklogs } : {}),
                      ...(liveSubHistory ? { history: liveSubHistory } : {}),
                      loggedTime: totalLogged,
                    }
                  : sub,
              ),
            };
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!cancelled && !msg.includes("Unexpected API path")) {
          setActivityError(describeMutationError(err));
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
    projectId,
    projectPeopleById,
    visibleUser,
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

  function openWorkItem(item: WorkItem, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    setActiveSubtaskId(null);
    setActiveWorkItemId(item.id);
  }

  function openSubtask(
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) {
    detailTriggerRef.current = trigger;
    setActiveWorkItemId(item.id);
    setActiveSubtaskId(subtaskId);
  }

  function openFullPageWorkItem(item: WorkItem, subtaskId?: string | null) {
    setActiveWorkItemId(null);
    setActiveSubtaskId(null);
    setFullPageWorkItemId(item.id);
    setFullPageSubtaskId(subtaskId ?? null);
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

  function deleteSingleItem(id: string) {
    const previousItems = items;
    const previousSelected = new Set(selectedIds);
    const existing = items.find((item) => item.id === id);
    const fromStatus = existing?.status ?? "TODO";
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (isRealProject) {
      enqueueTaskMutation(
        id,
        (realId, version) =>
          performBackendStatusTransition(
            realId,
            version,
            fromStatus,
            "CANCELLED",
          ),
        () => {
          setItems(previousItems);
          setSelectedIds(previousSelected);
        },
      );
    }
  }

  function addPreviewItem(input: CreatePreviewWorkItem) {
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
    setAnnouncement(t("createAdded"));
    setCreateOpen(false);

    if (isRealProject) {
      const creationPromise = (async (): Promise<string | null> => {
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
  }

  function updateItemStatus(id: string, nextStatus: WorkStatus) {
    const existing = items.find((item) => item.id === id);
    const prevStatus = existing?.status ?? "TODO";
    if (prevStatus === nextStatus) return;
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
      enqueueTaskMutation(
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

  function updateItemPriority(id: string, nextPriority: WorkPriority) {
    const existing = items.find((item) => item.id === id);
    const prevPriority = existing?.priority ?? "MEDIUM";
    if (prevPriority === nextPriority) return;
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, priority: nextPriority } : item,
      ),
    );
    if (isRealProject) {
      enqueueTaskMutation(
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

  function updateItemDueDate(id: string, nextDueDate: string | null) {
    const existing = items.find((item) => item.id === id);
    const prevDueDate = existing?.dueDate ?? null;
    const prevStartDate = existing?.startDate;
    if (prevDueDate === nextDueDate) return;
    const shouldClampStartDate = Boolean(
      nextDueDate && prevStartDate && prevStartDate > nextDueDate,
    );
    setMutationError(null);
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              dueDate: nextDueDate,
              ...(shouldClampStartDate ? { startDate: nextDueDate ?? undefined } : {}),
            }
          : item,
      ),
    );
    if (isRealProject) {
      enqueueTaskMutation(
        id,
        async (realId, version) => {
          const isoDue = nextDueDate
            ? new Date(`${nextDueDate}T00:00:00.000Z`).toISOString()
            : null;
          const updated = await updateProjectTaskApi(
            projectId,
            realId,
            version,
            {
              dueDate: isoDue,
              ...(shouldClampStartDate ? { startDate: isoDue } : {}),
            },
          );
          return updated.version;
        },
        () => {
          setItems((current) =>
            current.map((item) =>
              item.id === id || item.id === resolvedIdsRef.current.get(id)
                ? {
                    ...item,
                    dueDate: prevDueDate,
                    ...(shouldClampStartDate ? { startDate: prevStartDate } : {}),
                  }
                : item,
            ),
          );
        },
      );
    }
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
          estimate: options?.estimate ?? "2h",
          loggedTime: "0h",
          steps: [],
          comments: [],
          worklogs: [],
          history: [
            {
              id: `hist-${Date.now()}`,
              author: currentUserPerson?.name ?? defaultAssigneePerson.name,
              action: `created subtask ${item.key}.${nextIdx}`,
              createdAt: "Just now",
            },
          ],
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
  ) {
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
        enqueueTaskMutation(
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
                          ? new Date(`${patch.dueDate}T00:00:00.000Z`).toISOString()
                          : null,
                        ...(patch.dueDate &&
                        existingSub.startDate &&
                        existingSub.startDate > patch.dueDate &&
                        patch.startDate === undefined
                          ? {
                              startDate: new Date(
                                `${patch.dueDate}T00:00:00.000Z`,
                              ).toISOString(),
                            }
                          : {}),
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
    const previousItems = items;
    const parentItem = items.find((item) => item.id === itemId);
    const existingSub = parentItem?.subtaskItems?.find(
      (sub) => sub.id === subtaskId,
    );
    const prevStatus = existingSub?.status ?? "TODO";

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

    if (isRealProject && existingSub) {
      enqueueTaskMutation(
        subtaskId,
        (realSubId, version) =>
          performBackendStatusTransition(
            realSubId,
            version,
            prevStatus,
            "CANCELLED",
          ),
        () => {
          setItems(previousItems);
        },
      );
    }
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

  function addComment(itemId: string, text: string) {
    const previousItems = items;
    const tempCommentId = `comment-${Date.now()}`;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const existing = item.comments ?? [];
        const newComment = {
          id: tempCommentId,
          author: currentUserPerson?.name ?? defaultAssigneePerson.name,
          initials:
            currentUserPerson?.initials ?? defaultAssigneePerson.initials,
          createdAt: formatCommentDateTime(new Date()),
          text,
        };
        return {
          ...item,
          comments: [...existing, newComment],
        };
      }),
    );
    if (isRealProject) {
      void (async () => {
        try {
          const realId = await resolveBackendTaskId(itemId);
          if (!realId) {
            throw new Error("Task not persisted");
          }
          const created = await createTaskCommentApi(projectId, realId, text);
          setItems((current) =>
            current.map((item) => {
              if (item.id !== itemId && item.id !== realId) return item;
              return {
                ...item,
                comments: (item.comments ?? []).map((c) =>
                  c.id === tempCommentId
                    ? {
                        ...c,
                        id: created.id,
                        createdAt: formatCommentDateTime(created.createdAt),
                      }
                    : c,
                ),
              };
            }),
          );
        } catch {
          setItems(previousItems);
          void tasksQuery.refetch();
          setAnnouncement("Unable to post comment. Restored latest state.");
        }
      })();
    }
  }

  async function addWorklog(
    itemId: string,
    timeSpentInput: string,
    noteInput: string,
  ): Promise<boolean> {
    const minutes = parseWorklogMinutes(timeSpentInput);
    if (minutes < 1) return false;
    const formattedTimeSpent = formatWorklogMinutes(minutes);
    const trimmedNote = noteInput.trim();
    const previousItems = items;
    const tempWorklogId = `wl-${Date.now()}`;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const existing = item.worklogs ?? [];
        const newWorklog = {
          id: tempWorklogId,
          author: currentUserPerson?.name ?? defaultAssigneePerson.name,
          timeSpent: formattedTimeSpent,
          note: trimmedNote || "Logged engineering progress.",
          createdAt: formatCommentDateTime(new Date()),
        };
        return {
          ...item,
          worklogs: [...existing, newWorklog],
        };
      }),
    );
    if (isRealProject) {
      try {
        const realId = await resolveBackendTaskId(itemId);
        if (!realId) {
          throw new Error("Task not persisted");
        }
        const created = await createTaskWorklogApi(projectId, realId, {
          minutes,
          note: trimmedNote || null,
        });
        setItems((current) =>
          current.map((item) => {
            if (item.id !== itemId && item.id !== realId) return item;
            return {
              ...item,
              worklogs: (item.worklogs ?? []).map((wl) =>
                wl.id === tempWorklogId
                  ? {
                      ...wl,
                      id: created.id,
                      timeSpent: formatWorklogMinutes(created.minutes),
                      note: created.note ?? "",
                      createdAt: formatCommentDateTime(
                        created.loggedAt || created.createdAt,
                      ),
                    }
                  : wl,
              ),
            };
          }),
        );
        return true;
      } catch {
        setItems(previousItems);
        void tasksQuery.refetch();
        setAnnouncement("Unable to log work. Restored latest state.");
        return false;
      }
    }
    return true;
  }

  function bulkUpdateStatus(nextStatus: WorkStatus) {
    const previousItems = items;
    const previousSelected = new Set(selectedIds);
    const affectedItems = items.filter(
      (item) => selectedIds.has(item.id) && item.status !== nextStatus,
    );
    setItems((current) =>
      current.map((item) =>
        selectedIds.has(item.id)
          ? {
              ...item,
              status: nextStatus,
              resolution: nextStatus === "DONE" ? "RESOLVED" : "UNRESOLVED",
            }
          : item,
      ),
    );
    setSelectedIds(new Set());

    if (isRealProject) {
      for (const item of affectedItems) {
        const prevStatus = item.status;
        enqueueTaskMutation(
          item.id,
          (realId, version) =>
            performBackendStatusTransition(
              realId,
              version,
              prevStatus,
              nextStatus,
            ),
          () => {
            setItems(previousItems);
            setSelectedIds(previousSelected);
          },
        );
      }
    }
  }

  function bulkDeleteSelected() {
    const previousItems = items;
    const previousSelected = new Set(selectedIds);
    const affectedItems = items.filter((item) => selectedIds.has(item.id));
    setItems((current) =>
      current.filter((item) => !selectedIds.has(item.id)),
    );
    setSelectedIds(new Set());

    if (isRealProject) {
      for (const item of affectedItems) {
        const prevStatus = item.status;
        enqueueTaskMutation(
          item.id,
          (realId, version) =>
            performBackendStatusTransition(
              realId,
              version,
              prevStatus,
              "CANCELLED",
            ),
          () => {
            setItems(previousItems);
            setSelectedIds(previousSelected);
          },
        );
      }
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

  async function importCsvItem(
    file: File,
    onProgress: (progress: JiraImportProgress) => void,
  ): Promise<JiraImportProgress> {
    if (!isRealProject) throw new Error("Choose a saved Project before importing.");
    if (!resolvedProject || resolvedProject.id !== projectId) {
      throw new Error(
        "Project visibility could not be verified. Wait for Project details to load, then retry.",
      );
    }
    if (file.size > 10 * 1024 * 1024) throw new Error("CSV file exceeds 10 MB.");
    const rows = parseJiraImportCsv(await file.text(), projectId);
    try {
      return await importJiraRows(
        projectId,
        rows,
        resolvedProject.visibility,
        onProgress,
      );
    } finally {
      void tasksQuery.refetch();
    }
  }

  const showFilterToolbar =
    view ==="overview"||
    view ==="list"||
    view ==="board"||
    view ==="calendar";

  if (userAccessLost) {
    return <ProjectState error={user.error} retry={() => void user.refetch()} />;
  }

  if (!projectProp) {
    if (
      (user.isPending && !visibleUser) ||
      (organizationId && project.isPending && !visibleProject)
    ) {
      return <ProjectState />;
    }
    if (user.isError && !visibleUser)
      return <ProjectState error={user.error} />;
    if (!organizationId) return <ProjectState error={new Error("No trusted organization")} />;
    if (project.isError && !visibleProject) {
      return <ProjectState error={project.error} retry={() => void project.refetch()} />;
    }
    if (!visibleProject) return <ProjectState />;
  }

  if (isRealProject && taskAccessLost) {
    return (
      <section className="space-y-4" aria-labelledby="work-access-error-title">
        <h1
          id="work-access-error-title"
          className="text-lg font-semibold text-gray-900 dark:text-white/90"
        >
          {projectName || t("workspaceTitle")}
        </h1>
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          <span>{common("loadFailed")}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={tasksQuery.isFetching}
            onClick={() => void tasksQuery.refetch()}
          >
            {common("retry")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div
      className={`w-full min-w-0 space-y-2.5 ${
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
          hasMoreProjects={hasMoreProjects}
          isLoadingMoreProjects={isLoadingMoreProjects}
          onLoadMoreProjects={onLoadMoreProjects}
          view={view}
          onViewChange={setView}
          onCreate={() => setCreateOpen(true)}
          createButtonRef={createButtonRef}
          showCreateButton={!isOutOfScopeWorkView(view)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          itemCount={
            !isOutOfScopeWorkView(view) &&
            (!isRealProject || visibleTasks !== undefined)
              ? visibleItems.length
              : undefined
          }
          hideProjectBanner={hideProjectBanner}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 rounded border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
              {t("previewData")}
            </span>
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

      {isRealProject && visibleTasks !== undefined && tasksQuery.isFetching && (
        <UpdatingStatus>{common("updating")}</UpdatingStatus>
      )}
      {isRealProject && tasksQuery.isRefetchError && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void tasksQuery.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}

      {unavailableTaskNotice && (
        <div
          role="alert"
          data-testid="work-task-unavailable-banner"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
        >
          <p className="font-medium">{unavailableTaskNotice}</p>
          <button
            type="button"
            onClick={() => setUnavailableTaskNotice(null)}
            className="shrink-0 cursor-pointer font-medium underline underline-offset-2"
          >
            {t("mutationError.dismiss")}
          </button>
        </div>
      )}

      {mutationError && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <div className="min-w-0">
            <p className="font-semibold">{t("mutationError.title")}</p>
            <p className="break-words">{mutationError}</p>
          </div>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            className="shrink-0 cursor-pointer font-medium underline underline-offset-2"
          >
            {t("mutationError.dismiss")}
          </button>
        </div>
      )}

      {fullPageWorkItem ? (
        <WorkItemDetailDialog
          mode="page"
          projectId={projectId}
          item={fullPageWorkItem}
          allItems={items}
          people={projectPeople}
          currentUserPerson={currentUserPerson}
          activityError={activityError}
          initialSubtaskId={fullPageSubtaskId}
          onSelectSubtask={setFullPageSubtaskId}
          onClose={() => {
            setFullPageSubtaskId(null);
            setFullPageWorkItemId(null);
          }}
          onStatusChange={updateItemStatus}
          onPriorityChange={updateItemPriority}
          onAssigneeChange={updateItemAssignee}
          onDueDateChange={updateItemDueDate}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={addSubtask}
          onAddExistingTaskAsSubtask={addExistingTaskAsSubtask}
          onUpdateSubtask={updateSubtask}
          onDeleteSubtask={deleteSubtask}
          onCloneSubtask={cloneSubtask}
          onReorderSubtask={reorderSubtask}
          onConvertSubtaskToTask={convertSubtaskToTask}
          onMoveSubtaskToParent={moveSubtaskToParent}
          onBulkUpdateSubtasks={bulkUpdateSubtasks}
          onAddComment={addComment}
          onAddWorklog={addWorklog}
        />
      ) : isOutOfScopeWorkView(view) ? (
        <div
          role="status"
          className="border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          {t("notAvailableYet")}
        </div>
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
              onExportCsv={exportCsv}
              onImportCsvItem={importCsvItem}
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
                  onClick={bulkDeleteSelected}
                >
                  ✕ Delete
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

          {isRealProject && tasksQuery.isPending && !visibleTasks ? (
            <WorkItemsLoadingState view={view} label={common("loading")} />
          ) : isRealProject && tasksQuery.isError && !visibleTasks ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
              <span>{common("loadFailed")}</span>
              <Button variant="outline" size="sm" onClick={() => void tasksQuery.refetch()}>
                {common("retry")}
              </Button>
            </div>
          ) : view ==="timeline"? (
            <WorkTimelineView
              items={visibleItems}
              people={projectPeople}
              onOpenItem={openWorkItem}
              onCreate={() => setCreateOpen(true)}
            />
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
              onDueDateChange={updateItemDueDate}
              onToggleFlag={toggleItemFlag}
              onDeleteItem={deleteSingleItem}
              onToggleSubtask={toggleSubtask}
              onAddSubtask={addSubtask}
              onUpdateSubtask={updateSubtask}
              onDeleteSubtask={deleteSubtask}
              onCloneSubtask={cloneSubtask}
              onReorderSubtask={reorderSubtask}
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
              activeSprintName={activeSprint?.name ?? null}
              activeSprintCounts={activeSprint?.counts ?? null}
              isSprintLoading={sprintsQuery.isPending}
              isSprintError={sprintsQuery.isError}
              onCompleteSprint={activeSprint ? completeActiveSprint : undefined}
              onOpenItem={openWorkItem}
              onOpenSubtask={openSubtask}
              onStatusChange={updateItemStatus}
              onToggleSubtask={toggleSubtask}
              onAddSubtask={addSubtask}
              onUpdateSubtask={updateSubtask}
              onDeleteSubtask={deleteSubtask}
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
      <WorkItemCreateDialog
        isOpen={createOpen}
        people={projectPeople}
        onClose={() => setCreateOpen(false)}
        onCreate={addPreviewItem}
      />
      {activeWorkItem && (
        <WorkItemDetailDialog
          mode="modal"
          projectId={projectId}
          item={activeWorkItem}
          allItems={items}
          people={projectPeople}
          currentUserPerson={currentUserPerson}
          activityError={activityError}
          initialSubtaskId={activeSubtaskId}
          onSelectSubtask={setActiveSubtaskId}
          onOpenFullPage={(subId) => openFullPageWorkItem(activeWorkItem, subId)}
          onClose={() => {
            setActiveSubtaskId(null);
            setActiveWorkItemId(null);
          }}
          onStatusChange={updateItemStatus}
          onPriorityChange={updateItemPriority}
          onAssigneeChange={updateItemAssignee}
          onDueDateChange={updateItemDueDate}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={addSubtask}
          onAddExistingTaskAsSubtask={addExistingTaskAsSubtask}
          onUpdateSubtask={updateSubtask}
          onDeleteSubtask={deleteSubtask}
          onCloneSubtask={cloneSubtask}
          onReorderSubtask={reorderSubtask}
          onConvertSubtaskToTask={convertSubtaskToTask}
          onMoveSubtaskToParent={moveSubtaskToParent}
          onBulkUpdateSubtasks={bulkUpdateSubtasks}
          onAddComment={addComment}
          onAddWorklog={addWorklog}
        />
      )}
    </div>
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
