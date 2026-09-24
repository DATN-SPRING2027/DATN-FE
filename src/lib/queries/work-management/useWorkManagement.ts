"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { workManagementKeys } from "./work-management.keys";
import type {
  CreateWorkItemInput,
  Page,
  WorkItem,
  WorkItemComment,
  WorkItemEvent,
  WorkItemFilter,
  UpdateWorkItemInput,
} from "./work-management.types";

function projectItemsPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/work-items`;
}

function requireProjectId(projectId: string | null): string {
  if (!projectId) throw new Error("A project must be selected first.");
  return projectId;
}

export function useWorkItemsQuery(
  projectId: string | null,
  filter: WorkItemFilter = {},
  options?: Omit<UseQueryOptions<Page<WorkItem>>, "queryKey" | "queryFn">,
) {
  return useQuery({
    ...options,
    queryKey: workManagementKeys.items(projectId, filter),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    placeholderData:
      options?.placeholderData ?? ((previousData) => previousData),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filter.page ?? 1),
        pageSize: String(filter.pageSize ?? 20),
      });
      if (filter.status) params.set("status", filter.status);
      if (filter.priority) params.set("priority", filter.priority);
      if (filter.includeArchived) params.set("includeArchived", "true");

      return apiClient<Page<WorkItem>>(
        `${projectItemsPath(requireProjectId(projectId))}?${params.toString()}`,
      );
    },
  });
}

export function useCreateWorkItemMutation(
  projectId: string | null,
  options?: Omit<
    UseMutationOptions<WorkItem, Error, CreateWorkItemInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (input) =>
      apiClient<WorkItem>(projectItemsPath(requireProjectId(projectId)), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: workManagementKeys.project(projectId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

type UpdateVariables = Readonly<{
  workItemId: string;
  input: UpdateWorkItemInput;
}>;

export function useUpdateWorkItemMutation(
  projectId: string | null,
  options?: Omit<
    UseMutationOptions<WorkItem, Error, UpdateVariables>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: ({ workItemId, input }) =>
      apiClient<WorkItem>(
        `${projectItemsPath(requireProjectId(projectId))}/${encodeURIComponent(workItemId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: workManagementKeys.project(projectId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

type ArchiveVariables = Readonly<{ workItemId: string }>;

export function useArchiveWorkItemMutation(
  projectId: string | null,
  options?: Omit<
    UseMutationOptions<void, Error, ArchiveVariables>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: ({ workItemId }) =>
      apiClient<void>(
        `${projectItemsPath(requireProjectId(projectId))}/${encodeURIComponent(workItemId)}`,
        { method: "DELETE" },
      ),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: workManagementKeys.project(projectId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

export function useWorkItemCommentsQuery(
  projectId: string | null,
  workItemId: string | null,
  options?: Omit<
    UseQueryOptions<Page<WorkItemComment>>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    ...options,
    queryKey: workManagementKeys.comments(projectId, workItemId),
    enabled: Boolean(projectId && workItemId) && (options?.enabled ?? true),
    queryFn: () => {
      const endpoint = `${projectItemsPath(requireProjectId(projectId))}/${encodeURIComponent(requireWorkItemId(workItemId))}/comments?page=1&pageSize=100`;
      return apiClient<Page<WorkItemComment>>(endpoint);
    },
  });
}

export function useCreateWorkItemCommentMutation(
  projectId: string | null,
  workItemId: string | null,
  options?: Omit<
    UseMutationOptions<WorkItemComment, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (body) =>
      apiClient<WorkItemComment>(
        `${projectItemsPath(requireProjectId(projectId))}/${encodeURIComponent(requireWorkItemId(workItemId))}/comments`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: workManagementKeys.comments(projectId, workItemId),
      });
      queryClient.invalidateQueries({
        queryKey: workManagementKeys.activity(projectId, workItemId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

export function useWorkItemActivityQuery(
  projectId: string | null,
  workItemId: string | null,
  options?: Omit<UseQueryOptions<Page<WorkItemEvent>>, "queryKey" | "queryFn">,
) {
  return useQuery({
    ...options,
    queryKey: workManagementKeys.activity(projectId, workItemId),
    enabled: Boolean(projectId && workItemId) && (options?.enabled ?? true),
    queryFn: () =>
      apiClient<Page<WorkItemEvent>>(
        `${projectItemsPath(requireProjectId(projectId))}/${encodeURIComponent(requireWorkItemId(workItemId))}/activity?page=1&pageSize=100`,
      ),
  });
}

function requireWorkItemId(workItemId: string | null): string {
  if (!workItemId) throw new Error("A Work Item must be selected first.");
  return workItemId;
}
