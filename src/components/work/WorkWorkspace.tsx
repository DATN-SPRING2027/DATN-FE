"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import ProjectState from "@/components/projects/ProjectState";
import Button from "@/components/ui/button/Button";
import WorkBoardView from "./WorkBoardView";
import WorkItemDetailDialog from "./WorkItemDetailDialog";
import WorkItemCreateDialog from "./WorkItemCreateDialog";
import WorkCalendarView from "./WorkCalendarView";
import WorkListView from "./WorkListView";
import WorkOverviewView from "./WorkOverviewView";
import WorkPageHeader, { type WorkView } from "./WorkPageHeader";
import WorkToolbar from "./WorkToolbar";
import {
  INITIAL_PREVIEW_WORK_ITEMS,
  PREVIEW_PEOPLE,
} from "./work-preview-data";
import {
  WORK_STATUS_ORDER,
  type CreatePreviewWorkItem,
  type WorkGroupBy,
  type WorkItem,
  type WorkItemGroup,
  type WorkPriority,
  type WorkStatus,
} from "./work-types";
import { getCalendarMonthStart } from "./work-calendar-utils";

export default function WorkWorkspace({ projectId }: { projectId: string }) {
  const t = useTranslations("work");
  const user = useCurrentUserQuery();
  const organizationId = user.data?.organizationId ?? "";
  const project = useProjectQuery(organizationId, projectId);
  const [view, setView] = useState<WorkView>("list");
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getCalendarMonthStart(new Date()),
  );
  const [items, setItems] = useState<WorkItem[]>([...INITIAL_PREVIEW_WORK_ITEMS]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<WorkPriority | "ALL">("ALL");
  const [assigneeId, setAssigneeId] = useState<string | "ALL">("ALL");
  const [groupBy, setGroupBy] = useState<WorkGroupBy>("STATUS");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [activeWorkItem, setActiveWorkItem] = useState<WorkItem | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const dialogWasOpenRef = useRef(false);
  const detailWasOpenRef = useRef(false);
  const projectName = project.data?.name ?? "";
  const projectCode = project.data?.code ?? "";

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearch(
          [item.key, item.title, item.assignee.name, item.reporter.name].join(" "),
        ).includes(normalizedQuery);
      return (
        matchesQuery &&
        (status === "ALL" || item.status === status) &&
        (priority === "ALL" || item.priority === priority) &&
        (assigneeId === "ALL" || item.assignee.id === assigneeId)
      );
    }).map((item) => ({ ...item, projectName }));
  }, [assigneeId, items, priority, projectName, query, status]);

  const groups = useMemo(
    () => groupWorkItems(visibleItems, groupBy),
    [groupBy, visibleItems],
  );
  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));

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
    setActiveWorkItem(item);
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
    setSelectedIds(new Set());
  }

  function addPreviewItem(input: CreatePreviewWorkItem) {
    setItems((current) => {
      const sequence = current.filter((item) => item.key.startsWith("PREVIEW-")).length + 1;
      const item: WorkItem = {
        id: `preview-${Date.now()}`,
        key: `PREVIEW-${sequence}`,
        title: input.title,
        type: input.type,
        assignee: input.assignee,
        reporter: PREVIEW_PEOPLE[1],
        priority: input.priority,
        status: "TODO",
        resolution: "UNRESOLVED",
        createdAt: new Date().toISOString(),
        dueDate: input.dueDate,
        projectName,
        subtasks: { completed: 0, total: 0 },
      };
      return [item, ...current];
    });
    setAnnouncement(t("createAdded"));
    setCreateOpen(false);
  }

  if (user.isPending || (organizationId && project.isPending)) {
    return <ProjectState />;
  }
  if (user.isError) return <ProjectState error={user.error} />;
  if (!organizationId) return <ProjectState error={new Error("No trusted organization")} />;
  if (project.isError) {
    return <ProjectState error={project.error} retry={() => void project.refetch()} />;
  }
  if (!project.data) return <ProjectState />;

  return (
    <div className="@container min-w-0 space-y-5 sm:space-y-6">
      <WorkPageHeader
        projectId={projectId}
        projectName={projectName}
        projectCode={projectCode}
        view={view}
        onViewChange={setView}
        onCreate={() => setCreateOpen(true)}
        createButtonRef={createButtonRef}
      />

      <div className="flex justify-end">
        <p className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400" aria-live="polite">
          {t("workItemCount", { count: visibleItems.length })}
        </p>
      </div>

      <WorkToolbar
        query={query}
        status={status}
        priority={priority}
        assigneeId={assigneeId}
        groupBy={groupBy}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onPriorityChange={setPriority}
        onAssigneeChange={setAssigneeId}
        onGroupByChange={setGroupBy}
        onClearFilters={clearFilters}
      />

      {view === "list" && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 dark:border-brand-500/30 dark:bg-brand-500/10">
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">
            {t("selectedCount", { count: selectedIds.size })}
          </p>
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
      )}

      {visibleItems.length === 0 ? (
        <div role="status" className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{t("noResultsTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("noResultsDescription")}</p>
          <button type="button" onClick={clearFilters} className="mt-4 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10">
            {t("clearFilters")}
          </button>
        </div>
      ) : view === "list" ? (
        <WorkListView
          groups={groups}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          onToggleItem={toggleItem}
          onToggleAll={toggleAllVisible}
          onOpenItem={openWorkItem}
        />
      ) : view === "overview" ? (
        <WorkOverviewView items={visibleItems} onOpenItem={openWorkItem} />
      ) : view === "board" ? (
        <WorkBoardView items={visibleItems} onOpenItem={openWorkItem} />
      ) : (
        <WorkCalendarView
          items={visibleItems}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onOpenItem={openWorkItem}
        />
      )}

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <WorkItemCreateDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={addPreviewItem}
      />
      {activeWorkItem && (
        <WorkItemDetailDialog
          item={activeWorkItem}
          onClose={() => setActiveWorkItem(null)}
        />
      )}
    </div>
  );
}

function groupWorkItems(
  items: readonly WorkItem[],
  groupBy: WorkGroupBy,
): WorkItemGroup[] {
  if (groupBy === "NONE") {
    return [{ id: "all", label: null, labelKind: "text", items }];
  }

  const grouped = new Map<string, WorkItem[]>();
  for (const item of items) {
    const key =
      groupBy === "STATUS"
        ? item.status
        : groupBy === "ASSIGNEE"
          ? item.assignee.id
          : item.priority;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  const keys = [...grouped.keys()];
  if (groupBy === "STATUS") {
    keys.sort(
      (left, right) =>
        WORK_STATUS_ORDER.indexOf(left as WorkStatus) -
        WORK_STATUS_ORDER.indexOf(right as WorkStatus),
    );
  } else if (groupBy === "PRIORITY") {
    const priorityOrder: WorkPriority[] = ["HIGH", "MEDIUM", "LOW"];
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
      groupBy === "ASSIGNEE"
        ? (PREVIEW_PEOPLE.find((person) => person.id === key)?.name ?? key)
        : key;
    return {
      id: key,
      label,
      labelKind: groupBy === "STATUS" ? "status" : groupBy === "PRIORITY" ? "priority" : "text",
      items: grouped.get(key) ?? [],
    };
  });
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}
