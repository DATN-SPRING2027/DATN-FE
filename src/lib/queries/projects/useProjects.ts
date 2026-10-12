"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type Project = Readonly<{
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC";
  status: "ACTIVE" | "ARCHIVED";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}>;
export type CreateProjectInput = Readonly<{
  name: string;
  code: string;
  description?: string;
}>;
export type ProjectListInput = Readonly<{
  page: number;
  pageSize: number;
  status?: Project["status"];
}>;
export type ProjectList = Readonly<{
  data: readonly Project[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>;
}>;
export const projectKeys = {
  scope: (organizationId: string) => ["projects", organizationId] as const,
  list: (organizationId: string, input: ProjectListInput) =>
    ["projects", organizationId, "list", input] as const,
  detail: (organizationId: string, id: string) =>
    ["projects", organizationId, "detail", id] as const,
};
export function useProjectsQuery(
  organizationId: string,
  input: ProjectListInput,
) {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.status) params.set("status", input.status);
  return useQuery({
    queryKey: projectKeys.list(organizationId, input),
    queryFn: ({ signal }) =>
      apiClient<ProjectList>(`/iam/projects?${params}`, {
        signal,
        cache: "no-store",
      }),
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
export function useProjectQuery(organizationId: string, id: string) {
  return useQuery({
    queryKey: projectKeys.detail(organizationId, id),
    queryFn: ({ signal }) =>
      apiClient<Project>(`/iam/projects/${encodeURIComponent(id)}`, {
        signal,
        cache: "no-store",
      }),
    enabled: Boolean(organizationId && id),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
export function useCreateProjectMutation(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ name, code, description }: CreateProjectInput) =>
      apiClient<Project>("/iam/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          code,
          ...(description !== undefined ? { description } : {}),
        }),
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: projectKeys.scope(organizationId) }),
  });
}
