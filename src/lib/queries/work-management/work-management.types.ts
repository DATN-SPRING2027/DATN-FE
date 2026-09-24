export type WorkItemStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type WorkItemPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type WorkItem = Readonly<{
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  assigneeId: string | null;
  dueDate: string | null;
  labels: readonly string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  revision: number;
}>;

export type WorkItemComment = Readonly<{
  id: string;
  workItemId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
}>;

export type WorkItemEvent = Readonly<{
  id: string;
  workItemId: string;
  actorUserId: string;
  eventType: "CREATED" | "UPDATED" | "COMMENT_ADDED" | "ARCHIVED";
  changes: Readonly<Record<string, unknown>> | null;
  occurredAt: string;
}>;

export type Page<T> = Readonly<{
  data: readonly T[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>;
}>;

export type CreateWorkItemInput = Readonly<{
  title: string;
  description?: string;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labels?: readonly string[];
}>;

export type UpdateWorkItemInput = Readonly<{
  title?: string;
  description?: string;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labels?: readonly string[];
}>;

export type WorkItemFilter = Readonly<{
  page?: number;
  pageSize?: number;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  includeArchived?: boolean;
}>;
