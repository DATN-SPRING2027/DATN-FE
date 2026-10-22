"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type BackendTaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED";

export type BackendTaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type BackendTaskType = "TASK" | "BUG" | "STORY";
export type BackendSprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export type BackendChecklistStep = Readonly<{
  id: string;
  text: string;
  done: boolean;
}>;

export type BackendSubtaskCounts = Readonly<{
  total: number;
  done: number;
}>;

export type BackendTask = Readonly<{
  id: string;
  projectId: string;
  key: string;
  title: string;
  type: BackendTaskType;
  status: BackendTaskStatus;
  priority: BackendTaskPriority;
  assigneeId: string | null;
  createdBy: string;
  parentId: string | null;
  sprintId: string | null;
  labels: readonly string[];
  subtaskCounts: BackendSubtaskCounts;
  dueDate: string | null;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}>;

export type BackendTaskDetail = BackendTask &
  Readonly<{
    description: string | null;
    steps: readonly BackendChecklistStep[];
    completedAt: string | null;
  }>;

export type BackendOrganizationTask = BackendTask &
  Readonly<{
    projectName: string;
    projectCode: string;
  }>;

export type BackendTaskListResponse = Readonly<{
  items: readonly BackendTask[];
  nextAfterId: string | null;
  nextCursor: string | null;
}>;

export type BackendOrganizationTaskListResponse = Readonly<{
  items: readonly BackendOrganizationTask[];
  nextAfterId: string | null;
  nextCursor: string | null;
}>;

export type BackendTaskComment = Readonly<{
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  body: string;
  createdAt: string;
}>;

export type BackendTaskCommentListResponse = Readonly<{
  items: readonly BackendTaskComment[];
  nextAfterId: string | null;
}>;

export type BackendTaskWorklog = Readonly<{
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  minutes: number;
  note: string | null;
  loggedAt: string;
  createdAt: string;
}>;

export type BackendTaskWorklogListResponse = Readonly<{
  items: readonly BackendTaskWorklog[];
  totalMinutes: number;
  nextAfterId: string | null;
}>;

export type BackendTaskHistoryEvent = Readonly<{
  id: string;
  type:
    | "TASK_CREATED"
    | "TASK_STATUS_TRANSITIONED"
    | "TASK_UPDATED"
    | "TASK_COMMENT_ADDED"
    | "TASK_WORKLOG_ADDED";
  actor: Readonly<{
    id: string;
    fullName: string;
  }> | null;
  occurredAt: string;
  version: number;
  fromStatus?: BackendTaskStatus;
  toStatus?: BackendTaskStatus;
  reason?: string;
  changedFields?: readonly string[];
  fromSprintId?: string | null;
  toSprintId?: string | null;
  commentId?: string;
  worklogId?: string;
  minutes?: number;
}>;

export type BackendTaskHistoryResponse = Readonly<{
  data: readonly BackendTaskHistoryEvent[];
  pagination: Readonly<{
    page: number;
    limit: number;
    hasNext: boolean;
  }>;
}>;

export type BackendProjectSprint = Readonly<{
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: BackendSprintStatus;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  version: number;
  counts: Readonly<{
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    todoTasks: number;
  }>;
}>;

export type BackendProjectSprintListResponse = Readonly<{
  items: readonly BackendProjectSprint[];
}>;

export type BackendProjectTaskSummary = Readonly<{
  asOf: string;
  total: number;
  byStatus: readonly { key: string | null; count: number }[];
  byPriority: readonly { key: string | null; count: number }[];
  byType: readonly { key: string | null; count: number }[];
  byAssignee: readonly { key: string | null; count: number }[];
  overdue: number;
  dueNext7Days: number;
  completedLast7Days: number;
  createdLast7Days: number;
}>;

export type BackendOrganizationTaskSummary = Readonly<{
  asOf: string;
  totals: Readonly<{
    total: number;
    inProgress: number;
    overdue: number;
  }>;
  projects: readonly {
    projectId: string;
    projectName: string;
    projectCode: string;
    total: number;
    inProgress: number;
    overdue: number;
    byStatus: readonly { key: string | null; count: number }[];
  }[];
  nextCursor: string | null;
}>;

export type CreateBackendTaskInput = Readonly<{
  title: string;
  description?: string | null;
  type?: BackendTaskType;
  priority?: BackendTaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  labels?: readonly string[];
  steps?: readonly BackendChecklistStep[];
}>;

export type UpdateBackendTaskInput = Readonly<{
  title?: string;
  description?: string | null;
  type?: BackendTaskType;
  priority?: BackendTaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  parentId?: string | null;
  sprintId?: string | null;
  labels?: readonly string[];
  steps?: readonly BackendChecklistStep[];
}>;

export type TransitionBackendTaskInput = Readonly<{
  fromStatus?: BackendTaskStatus;
  toStatus: BackendTaskStatus;
  reason?: string;
}>;

export const taskKeys = {
  projectScope: (projectId: string) => ["tasks", "project", projectId] as const,
  projectList: (projectId: string, filters?: Record<string, string>) =>
    ["tasks", "project", projectId, "list", filters ?? {}] as const,
  projectDetail: (projectId: string, taskId: string) =>
    ["tasks", "project", projectId, "detail", taskId] as const,
  projectSprints: (projectId: string) =>
    ["tasks", "project", projectId, "sprints"] as const,
  projectSummary: (projectId: string) =>
    ["tasks", "project", projectId, "summary"] as const,
  orgTasks: (filters?: Record<string, string>) =>
    ["tasks", "organization", "list", filters ?? {}] as const,
  orgSummary: (cursor?: string) =>
    ["tasks", "organization", "summary", cursor ?? "first"] as const,
};

function resolveCsrfToken(): string {
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    for (const prefix of [
      "__Host-csrf=",
      "continuum_csrf=",
      "csrf_token=",
    ]) {
      const match = cookies.find((c) => c.startsWith(prefix));
      if (match) {
        try {
          return decodeURIComponent(match.slice(prefix.length));
        } catch {
          return match.slice(prefix.length);
        }
      }
    }
  }
  return "continuum-workspace-csrf-token";
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildMutationHeaders(options?: {
  ifMatch?: string;
  idempotencyKey?: string;
  requireIdempotency?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-CSRF-Token": resolveCsrfToken(),
  };
  if (options?.ifMatch) {
    headers["If-Match"] = options.ifMatch;
  }
  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  } else if (options?.requireIdempotency) {
    headers["Idempotency-Key"] = generateIdempotencyKey();
  }
  return headers;
}

export function formatTaskIfMatch(taskId: string, version: number): string {
  return `"task:${taskId}:${version}"`;
}

export function formatSprintIfMatch(sprintId: string, version: number): string {
  return `"sprint:${sprintId}:${version}"`;
}

const MAX_PROJECT_TASK_PAGES = 20;

export async function fetchProjectTasksPage(
  projectId: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<BackendTaskListResponse> {
  const search = new URLSearchParams({ limit: "100", ...(params ?? {}) });
  return apiClient<BackendTaskListResponse>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks?${search}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function fetchProjectTasks(
  projectId: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<BackendTaskListResponse> {
  const hasExplicitCursor = Boolean(params?.afterId || params?.cursor);
  const firstPage = await fetchProjectTasksPage(projectId, params, signal);
  if (
    hasExplicitCursor ||
    (!firstPage.nextAfterId && !firstPage.nextCursor)
  ) {
    return firstPage;
  }

  const seenIds = new Set<string>(firstPage.items.map((item) => item.id));
  const mergedItems: BackendTask[] = [...firstPage.items];
  let nextAfterId = firstPage.nextAfterId;
  let nextCursor = firstPage.nextCursor;

  for (let page = 1; page < MAX_PROJECT_TASK_PAGES; page += 1) {
    if (signal?.aborted || (!nextAfterId && !nextCursor)) {
      break;
    }
    const nextParams: Record<string, string> = { ...(params ?? {}) };
    if (nextCursor) {
      nextParams.cursor = nextCursor;
      delete nextParams.afterId;
    } else if (nextAfterId) {
      nextParams.afterId = nextAfterId;
      delete nextParams.cursor;
    }
    const currentPage = await fetchProjectTasksPage(
      projectId,
      nextParams,
      signal,
    );
    let addedCount = 0;
    for (const item of currentPage.items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        mergedItems.push(item);
        addedCount += 1;
      }
    }
    nextAfterId = currentPage.nextAfterId;
    nextCursor = currentPage.nextCursor;
    if (addedCount === 0 || (!nextAfterId && !nextCursor)) {
      break;
    }
  }

  return {
    items: mergedItems,
    nextAfterId,
    nextCursor,
  };
}

export async function fetchProjectTaskDetail(
  projectId: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<BackendTaskDetail> {
  return apiClient<BackendTaskDetail>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function createProjectTaskApi(
  projectId: string,
  input: CreateBackendTaskInput,
  idempotencyKey?: string,
): Promise<BackendTaskDetail> {
  return apiClient<BackendTaskDetail>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks`,
    {
      method: "POST",
      headers: buildMutationHeaders({
        idempotencyKey,
        requireIdempotency: true,
      }),
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectTaskApi(
  projectId: string,
  taskId: string,
  version: number,
  input: UpdateBackendTaskInput,
): Promise<BackendTaskDetail> {
  return apiClient<BackendTaskDetail>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: buildMutationHeaders({
        ifMatch: formatTaskIfMatch(taskId, version),
      }),
      body: JSON.stringify(input),
    },
  );
}

export async function transitionProjectTaskApi(
  projectId: string,
  taskId: string,
  version: number,
  input: TransitionBackendTaskInput,
): Promise<BackendTaskDetail> {
  return apiClient<BackendTaskDetail>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/transitions`,
    {
      method: "POST",
      headers: buildMutationHeaders({
        ifMatch: formatTaskIfMatch(taskId, version),
        requireIdempotency: true,
      }),
      body: JSON.stringify(input),
    },
  );
}

export async function fetchTaskComments(
  projectId: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<BackendTaskCommentListResponse> {
  return apiClient<BackendTaskCommentListResponse>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments?limit=100`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function createTaskCommentApi(
  projectId: string,
  taskId: string,
  body: string,
): Promise<BackendTaskComment> {
  return apiClient<BackendTaskComment>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`,
    {
      method: "POST",
      headers: buildMutationHeaders({ requireIdempotency: true }),
      body: JSON.stringify({ body }),
    },
  );
}

export async function fetchTaskWorklogs(
  projectId: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<BackendTaskWorklogListResponse> {
  return apiClient<BackendTaskWorklogListResponse>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/worklogs?limit=100`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function createTaskWorklogApi(
  projectId: string,
  taskId: string,
  input: { minutes: number; note?: string | null; loggedAt?: string },
): Promise<BackendTaskWorklog> {
  return apiClient<BackendTaskWorklog>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/worklogs`,
    {
      method: "POST",
      headers: buildMutationHeaders({ requireIdempotency: true }),
      body: JSON.stringify(input),
    },
  );
}

export async function fetchTaskHistory(
  projectId: string,
  taskId: string,
  page = 1,
  limit = 50,
  signal?: AbortSignal,
): Promise<BackendTaskHistoryResponse> {
  return apiClient<BackendTaskHistoryResponse>(
    `/tasks/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/history?page=${page}&limit=${limit}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function fetchProjectSprints(
  projectId: string,
  status?: BackendSprintStatus,
  signal?: AbortSignal,
): Promise<BackendProjectSprintListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiClient<BackendProjectSprintListResponse>(
    `/tasks/projects/${encodeURIComponent(projectId)}/sprints${qs}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function createProjectSprintApi(
  projectId: string,
  input: {
    name: string;
    goal?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<BackendProjectSprint> {
  return apiClient<BackendProjectSprint>(
    `/tasks/projects/${encodeURIComponent(projectId)}/sprints`,
    {
      method: "POST",
      headers: buildMutationHeaders({ requireIdempotency: true }),
      body: JSON.stringify(input),
    },
  );
}

export async function updateProjectSprintApi(
  projectId: string,
  sprintId: string,
  version: number,
  input: {
    name?: string;
    goal?: string | null;
    status?: "PLANNED" | "ACTIVE";
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<BackendProjectSprint> {
  return apiClient<BackendProjectSprint>(
    `/tasks/projects/${encodeURIComponent(projectId)}/sprints/${encodeURIComponent(sprintId)}`,
    {
      method: "PATCH",
      headers: buildMutationHeaders({
        ifMatch: formatSprintIfMatch(sprintId, version),
      }),
      body: JSON.stringify(input),
    },
  );
}

export async function completeProjectSprintApi(
  projectId: string,
  sprintId: string,
  version: number,
  moveIncompleteToSprintId?: string | null,
): Promise<BackendProjectSprint> {
  return apiClient<BackendProjectSprint>(
    `/tasks/projects/${encodeURIComponent(projectId)}/sprints/${encodeURIComponent(sprintId)}/complete`,
    {
      method: "POST",
      headers: buildMutationHeaders({
        ifMatch: formatSprintIfMatch(sprintId, version),
        requireIdempotency: true,
      }),
      body: JSON.stringify({
        moveIncompleteToSprintId: moveIncompleteToSprintId ?? null,
      }),
    },
  );
}

export async function fetchProjectTaskSummary(
  projectId: string,
  signal?: AbortSignal,
): Promise<BackendProjectTaskSummary> {
  return apiClient<BackendProjectTaskSummary>(
    `/tasks/projects/${encodeURIComponent(projectId)}/task-summary`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function fetchOrganizationTasks(
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<BackendOrganizationTaskListResponse> {
  const search = new URLSearchParams({ limit: "100", ...(params ?? {}) });
  return apiClient<BackendOrganizationTaskListResponse>(
    `/tasks/organization/tasks?${search}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function fetchOrganizationTaskSummary(
  cursor?: string,
  signal?: AbortSignal,
): Promise<BackendOrganizationTaskSummary> {
  const search = new URLSearchParams({ limit: "50" });
  if (cursor) search.set("cursor", cursor);
  return apiClient<BackendOrganizationTaskSummary>(
    `/tasks/organization/task-summary?${search}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export function useProjectTasksQuery(
  projectId: string,
  filters?: Record<string, string>,
) {
  return useQuery({
    queryKey: taskKeys.projectList(projectId, filters),
    queryFn: ({ signal }) => fetchProjectTasks(projectId, filters, signal),
    enabled: Boolean(projectId) && /^[0-9a-f]{24}$/i.test(projectId),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useProjectSprintsQuery(projectId: string) {
  return useQuery({
    queryKey: taskKeys.projectSprints(projectId),
    queryFn: ({ signal }) => fetchProjectSprints(projectId, undefined, signal),
    enabled: Boolean(projectId) && /^[0-9a-f]{24}$/i.test(projectId),
    retry: false,
    staleTime: 0,
  });
}

export function useProjectTaskSummaryQuery(projectId: string) {
  return useQuery({
    queryKey: taskKeys.projectSummary(projectId),
    queryFn: ({ signal }) => fetchProjectTaskSummary(projectId, signal),
    enabled: Boolean(projectId) && /^[0-9a-f]{24}$/i.test(projectId),
    retry: false,
    staleTime: 0,
  });
}

export function useOrganizationTasksQuery(
  filters?: Record<string, string>,
  enabled = true,
) {
  return useQuery({
    queryKey: taskKeys.orgTasks(filters),
    queryFn: ({ signal }) => fetchOrganizationTasks(filters, signal),
    enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useOrganizationTaskSummaryQuery(
  cursor?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: taskKeys.orgSummary(cursor),
    queryFn: ({ signal }) => fetchOrganizationTaskSummary(cursor, signal),
    enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useCreateProjectTaskMutation(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBackendTaskInput) =>
      createProjectTaskApi(projectId, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: taskKeys.projectScope(projectId) }),
  });
}
