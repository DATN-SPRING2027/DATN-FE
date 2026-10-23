export const WORK_STATUS_ORDER = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
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

export type WorkSubtaskStep = Readonly<{
  id: string;
  text: string;
  done: boolean;
}>;

export type WorkSubtaskWorklogItem = Readonly<{
  id: string;
  author: string;
  timeSpent: string;
  note: string;
  createdAt: string;
}>;

export type WorkSubtaskHistoryItem = Readonly<{
  id: string;
  author: string;
  action: string;
  createdAt: string;
}>;

export type WorkSubtaskItem = Readonly<{
  id: string;
  key: string;
  summary: string;
  done: boolean;
  status: WorkStatus;
  priority?: WorkPriority;
  assignee?: WorkPerson;
  reporter?: WorkPerson;
  dueDate?: string | null;
  startDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  estimate?: string;
  loggedTime?: string;
  flagged?: boolean;
  labels?: readonly string[];
  steps?: readonly WorkSubtaskStep[];
  comments?: readonly WorkCommentItem[];
  worklogs?: readonly WorkSubtaskWorklogItem[];
  history?: readonly WorkSubtaskHistoryItem[];
}>;

export type WorkCommentItem = Readonly<{
  id: string;
  author: string;
  initials: string;
  createdAt: string;
  text: string;
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
  updatedAt?: string;
  dueDate: string | null;
  startDate?: string | null;
  projectName: string;
  description?: string;
  parent?: Readonly<{ key: string; summary: string }>;
  labels?: readonly string[];
  team?: string;
  flagged?: boolean;
  storyPoints?: number;
  sprint?: string;
  subtasks: Readonly<{ completed: number; total: number }>;
  subtaskItems?: readonly WorkSubtaskItem[];
  comments?: readonly WorkCommentItem[];
  worklogs?: readonly WorkSubtaskWorklogItem[];
  history?: readonly WorkSubtaskHistoryItem[];
}>;

export type WorkFilterOperator = "is" | "is_not" | "contains";
export type WorkFilterField =
  | "status"
  | "priority"
  | "assignee"
  | "type"
  | "reporter";

export type WorkFilterCondition = Readonly<{
  id: string;
  field: WorkFilterField;
  operator: WorkFilterOperator;
  value: string;
}>;

export type WorkListColumnKey =
  | "work"
  | "assignee"
  | "reporter"
  | "priority"
  | "status"
  | "resolution"
  | "created"
  | "updated"
  | "due"
  | "parent"
  | "progress"
  | "labels"
  | "storyPoints"
  | "comments"
  | "team";

export type WorkListColumn = Readonly<{
  key: WorkListColumnKey;
  label: string;
  category: string;
  visible: boolean;
  width: number;
  minWidth: number;
}>;

export type CreatePreviewWorkItem = Readonly<{
  title: string;
  type: WorkItemType;
  priority: WorkPriority;
  assignee: WorkPerson;
  dueDate: string | null;
  description?: string;
  status?: WorkStatus;
}>;

export type WorkItemGroup = Readonly<{
  id: string;
  label: string | null;
  labelKind: "text" | "status" | "priority";
  items: readonly WorkItem[];
}>;

export type WorkTimelineBarColor =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "red";

export type WorkTimelineSubtask = Readonly<{
  key: string;
  summary: string;
  assignee: Readonly<{
    name: string;
    initials: string;
    unassigned?: boolean;
  }>;
  status: WorkStatus;
  startLabel: string;
  endLabel: string;
  barColor: WorkTimelineBarColor;
  barLeft: number;
  barWidth: number;
  startDateRaw: string;
  dueDateRaw: string;
}>;

export type WorkTimelineEpic = Readonly<{
  key: string;
  summary: string;
  assignee: Readonly<{
    name: string;
    initials: string;
    unassigned?: boolean;
  }>;
  status: WorkStatus;
  progress: Readonly<{ done: number; inprog: number; todo: number }>;
  startLabel: string;
  endLabel: string;
  barColor: WorkTimelineBarColor;
  barLeft: number;
  barWidth: number;
  expanded: boolean;
  startDateRaw: string;
  dueDateRaw: string;
  subtasks: readonly WorkTimelineSubtask[];
}>;

export type WorkIntakeFormType = "Epic" | "Task" | "Story" | "Feature" | "Bug";

export type WorkIntakeForm = Readonly<{
  id: string;
  name: string;
  type: WorkIntakeFormType;
  submissions: number;
  status: "Active" | "Draft";
  createdAt: string;
  desc: string;
  fields: readonly string[];
}>;

export type WorkDocArticle = Readonly<{
  id: string;
  category: string;
  categoryKey: "arch" | "contract" | "governance" | "template";
  title: string;
  shortTitle: string;
  excerpt: string;
  icon: string;
  author: string;
  role: string;
  updated: string;
  readTime: string;
  status: "VERIFIED" | "APPROVED" | "DRAFT";
  access: "Specific people" | "Anyone in Org";
  sagChunks: number;
  linkedTasks: readonly string[];
  views: number;
  callout: Readonly<{
    kind: "info" | "success" | "warning";
    text: string;
  }>;
  bullets: readonly string[];
  checklist: readonly Readonly<{
    id: string;
    text: string;
    owner: string;
    done: boolean;
  }>[];
}>;
