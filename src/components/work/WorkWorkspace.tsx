"use client";

import { useEffect, useMemo, useRef, useState } from"react";
import { useTranslations } from"next-intl";
import { useCurrentUserQuery } from"@/lib/queries/auth/useAuth";
import { useProjectQuery, type Project } from"@/lib/queries/projects/useProjects";
import ProjectState from"@/components/projects/ProjectState";
import Button from"@/components/ui/button/Button";
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
  const [items, setItems] = useState<WorkItem[]>([...INITIAL_PREVIEW_WORK_ITEMS]);
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
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeWorkItemId, setActiveWorkItemId] = useState<string | null>(null);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const dialogWasOpenRef = useRef(false);
  const detailWasOpenRef = useRef(false);
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
    () => groupWorkItems(visibleItems, groupBy),
    [groupBy, visibleItems],
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
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function addPreviewItem(input: CreatePreviewWorkItem) {
    const targetStatus = input.status ??"TODO";
    setItems((current) => {
      const sequence =
        current.filter((item) => item.key.startsWith("PREVIEW-")).length + 1;
      const item: WorkItem = {
        id: `preview-${Date.now()}`,
        key: `PREVIEW-${sequence}`,
        title: input.title,
        type: input.type,
        assignee: input.assignee,
        reporter: PREVIEW_PEOPLE[1],
        priority: input.priority,
        status: targetStatus,
        resolution: targetStatus ==="DONE"?"RESOLVED":"UNRESOLVED",
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
  }

  function updateItemStatus(id: string, nextStatus: WorkStatus) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
              resolution: nextStatus ==="DONE"?"RESOLVED":"UNRESOLVED",
            }
          : item,
      ),
    );
  }

  function updateItemPriority(id: string, nextPriority: WorkPriority) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, priority: nextPriority } : item,
      ),
    );
  }

  function updateItemAssignee(id: string, nextAssignee: WorkPerson) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, assignee: nextAssignee } : item,
      ),
    );
  }

  function toggleSubtask(itemId: string, subtaskId: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const nextSubtasks = item.subtaskItems.map((sub) =>
          sub.id === subtaskId
            ? {
                ...sub,
                done: !sub.done,
                status: (!sub.done ?"DONE":"TODO") as WorkStatus,
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
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const existing = item.subtaskItems ?? [];
        const nextIdx = existing.length + 1;
        const nextStatus = options?.status ?? ("TODO" as WorkStatus);
        const newSub: WorkSubtaskItem = {
          id: `${item.key}.${nextIdx}-${Date.now()}`,
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
              author: user.data?.name ?? PREVIEW_PEOPLE[0].name,
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
  }

  function updateSubtask(
    itemId: string,
    subtaskId: string,
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const nextSubtasks = item.subtaskItems.map((sub) => {
          if (sub.id !== subtaskId) return sub;
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
  }

  function deleteSubtask(itemId: string, subtaskId: string) {
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
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !item.subtaskItems) return item;
        const idx = item.subtaskItems.findIndex((s) => s.id === subtaskId);
        if (idx < 0) return item;
        const source = item.subtaskItems[idx];
        const nextNum = item.subtaskItems.length + 1;
        const cloned: WorkSubtaskItem = {
          ...source,
          id: `${item.key}.${nextNum}-${Date.now()}`,
          key: `${item.key}.${nextNum}`,
          summary: `${source.summary} (Copy)`,
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
    let createdTaskId: string | null = null;
    setItems((current) => {
      const parentItem = current.find((i) => i.id === itemId);
      const sourceSub = parentItem?.subtaskItems?.find(
        (s) => s.id === subtaskId,
      );
      if (!parentItem || !sourceSub) return current;

      const nextSeq = 146 + current.length;
      const newTaskId = `promoted-${Date.now()}`;
      createdTaskId = newTaskId;
      const promotedItem: WorkItem = {
        id: newTaskId,
        key: `${projectCode || "KNW"}-${nextSeq}`,
        title: sourceSub.summary,
        type: "TASK",
        assignee: sourceSub.assignee ?? parentItem.assignee,
        reporter: sourceSub.reporter ?? parentItem.reporter,
        priority: sourceSub.priority ?? parentItem.priority,
        status: sourceSub.status,
        resolution: sourceSub.done ? "RESOLVED" : "UNRESOLVED",
        createdAt: sourceSub.createdAt ?? new Date().toISOString(),
        dueDate: sourceSub.dueDate ?? parentItem.dueDate,
        projectName,
        description:
          sourceSub.description ??
          `Promoted from subtask ${sourceSub.key} of parent work item ${parentItem.key}.`,
        parent: parentItem.parent ?? {
          key: parentItem.key,
          summary: parentItem.title,
        },
        labels: sourceSub.labels ?? parentItem.labels,
        subtasks: { completed: 0, total: 0 },
        subtaskItems: [],
        comments: sourceSub.comments ?? [],
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
      if (createdTaskId) {
        setActiveWorkItemId(createdTaskId);
      }
    }
    setAnnouncement("Converted subtask to standalone Task.");
  }

  function moveSubtaskToParent(
    fromItemId: string,
    subtaskId: string,
    toItemId: string,
  ) {
    if (fromItemId === toItemId) return;
    setItems((current) => {
      const fromItem = current.find((i) => i.id === fromItemId);
      const toItem = current.find((i) => i.id === toItemId);
      const movingSub = fromItem?.subtaskItems?.find((s) => s.id === subtaskId);
      if (!fromItem || !toItem || !movingSub) return current;

      const targetExisting = toItem.subtaskItems ?? [];
      const nextSubNumber = targetExisting.length + 1;
      const rekeyedSub: WorkSubtaskItem = {
        ...movingSub,
        key: `${toItem.key}.${nextSubNumber}`,
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
  }

  function bulkUpdateSubtasks(
    itemId: string,
    subtaskIds: readonly string[],
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) {
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
  }

  function addComment(itemId: string, text: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const existing = item.comments ?? [];
        const newComment = {
          id: `comment-${Date.now()}`,
          author: user.data?.name ?? PREVIEW_PEOPLE[0].name,
          initials: PREVIEW_PEOPLE[0].initials,
          createdAt:"Just now",
          text,
        };
        return {
          ...item,
          comments: [...existing, newComment],
        };
      }),
    );
  }

  function bulkUpdateStatus(nextStatus: WorkStatus) {
    setItems((current) =>
      current.map((item) =>
        selectedIds.has(item.id)
          ? {
              ...item,
              status: nextStatus,
              resolution: nextStatus ==="DONE"?"RESOLVED":"UNRESOLVED",
            }
          : item,
      ),
    );
    setSelectedIds(new Set());
  }

  function bulkDeleteSelected() {
    setItems((current) =>
      current.filter((item) => !selectedIds.has(item.id)),
    );
    setSelectedIds(new Set());
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
      assignee: PREVIEW_PEOPLE[0],
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

      {fullPageWorkItem ? (
        <WorkItemDetailDialog
          mode="page"
          item={fullPageWorkItem}
          allItems={items}
          initialSubtaskId={fullPageSubtaskId}
          onSelectSubtask={setFullPageSubtaskId}
          onClose={() => {
            setFullPageSubtaskId(null);
            setFullPageWorkItemId(null);
          }}
          onStatusChange={updateItemStatus}
          onPriorityChange={updateItemPriority}
          onAssigneeChange={updateItemAssignee}
          onToggleSubtask={toggleSubtask}
          onAddSubtask={addSubtask}
          onUpdateSubtask={updateSubtask}
          onDeleteSubtask={deleteSubtask}
          onCloneSubtask={cloneSubtask}
          onReorderSubtask={reorderSubtask}
          onConvertSubtaskToTask={convertSubtaskToTask}
          onMoveSubtaskToParent={moveSubtaskToParent}
          onBulkUpdateSubtasks={bulkUpdateSubtasks}
          onAddComment={addComment}
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
              onOpenAiCopilot={() => setAiCopilotOpen(true)}
              onExportCsv={exportCsv}
              onImportCsvItem={importCsvItem}
              onBulkSelectAll={() =>
                setSelectedIds(new Set(visibleItems.map((i) => i.id)))
              }
              onGoToReports={() => setView("reports")}
              onRefresh={() => void project.refetch()}
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

          {view ==="timeline"? (
            <WorkTimelineView
              items={visibleItems}
              onOpenItem={openWorkItem}
              onCreate={() => setCreateOpen(true)}
            />
          ) : view ==="development"? (
            <WorkDevelopmentView
              items={visibleItems}
              onCreateItem={addPreviewItem}
            />
          ) : view ==="forms"? (
            <WorkFormsView onCreateItem={addPreviewItem} />
          ) : view ==="docs"? (
            <WorkDocsView items={visibleItems} onOpenItem={openWorkItem} />
          ) : view ==="reports"? (
            <WorkReportsView items={visibleItems} onOpenItem={openWorkItem} />
          ) : visibleItems.length === 0 ? (
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
                  assignee: options?.assignee ?? PREVIEW_PEOPLE[0],
                  dueDate: options?.dueDate ?? null,
                })
              }
              onRefresh={() => void project.refetch()}
            />
          ) : view ==="overview"? (
            <WorkOverviewView
              items={visibleItems}
              onOpenItem={openWorkItem}
              onOpenSubtask={openSubtask}
              onOpenReports={() => setView("reports")}
              onOpenList={() => setView("list")}
            />
          ) : view ==="board"? (
            <WorkBoardView
              items={visibleItems}
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
                  assignee: PREVIEW_PEOPLE[0],
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
        onClose={() => setCreateOpen(false)}
        onCreate={addPreviewItem}
      />
      <WorkAiCopilotDialog
        isOpen={aiCopilotOpen}
        projectName={projectName}
        items={visibleItems}
        onClose={() => setAiCopilotOpen(false)}
      />
      {activeWorkItem && (
        <WorkItemDetailDialog
          mode="modal"
          item={activeWorkItem}
          allItems={items}
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
          onToggleSubtask={toggleSubtask}
          onAddSubtask={addSubtask}
          onUpdateSubtask={updateSubtask}
          onDeleteSubtask={deleteSubtask}
          onCloneSubtask={cloneSubtask}
          onReorderSubtask={reorderSubtask}
          onConvertSubtaskToTask={convertSubtaskToTask}
          onMoveSubtaskToParent={moveSubtaskToParent}
          onBulkUpdateSubtasks={bulkUpdateSubtasks}
          onAddComment={addComment}
        />
      )}
    </div>
  );
}

function groupWorkItems(
  items: readonly WorkItem[],
  groupBy: WorkGroupBy,
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
        ? (PREVIEW_PEOPLE.find((person) => person.id === key)?.name ?? key)
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
