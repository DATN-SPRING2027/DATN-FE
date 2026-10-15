export const WORK_STATUS_ORDER = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
] as const;

export type WorkStatus = (typeof WORK_STATUS_ORDER)[number];
export type WorkPriority = "LOW" | "MEDIUM" | "HIGH";
export type WorkItemType = "TASK" | "BUG" | "STORY";
export type WorkGroupBy = "NONE" | "STATUS" | "ASSIGNEE" | "PRIORITY";

export type WorkPerson = Readonly<{
  id: string;
  name: string;
  initials: string;
}>;

export type WorkItem = Readonly<{
  id: string;
  key: string;
  title: string;
  type: WorkItemType;
  assignee: WorkPerson;
  reporter: WorkPerson;
  priority: WorkPriority;
  status: WorkStatus;
  resolution: "UNRESOLVED" | "RESOLVED";
  createdAt: string;
  dueDate: string | null;
  projectName: string;
  subtasks: Readonly<{ completed: number; total: number }>;
}>;

export type CreatePreviewWorkItem = Readonly<{
  title: string;
  type: WorkItemType;
  priority: WorkPriority;
  assignee: WorkPerson;
  dueDate: string | null;
}>;

export type WorkItemGroup = Readonly<{
  id: string;
  label: string | null;
  labelKind: "text" | "status" | "priority";
  items: readonly WorkItem[];
}>;
