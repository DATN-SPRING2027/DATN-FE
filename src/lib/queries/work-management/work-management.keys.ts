import type { WorkItemFilter } from "./work-management.types";

export const workManagementKeys = {
  all: ["work-management"] as const,
  project: (projectId: string | null) =>
    [...workManagementKeys.all, "project", projectId] as const,
  items: (projectId: string | null, filter: WorkItemFilter = {}) =>
    [...workManagementKeys.project(projectId), "items", filter] as const,
  comments: (projectId: string | null, workItemId: string | null) =>
    [...workManagementKeys.project(projectId), "comments", workItemId] as const,
  activity: (projectId: string | null, workItemId: string | null) =>
    [...workManagementKeys.project(projectId), "activity", workItemId] as const,
};
