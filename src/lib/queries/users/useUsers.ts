"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { authKeys } from "../auth/auth.keys";
import type { CurrentUserResponse } from "../auth/useAuth";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING_INVITE";
export type RoleCode = "ADMIN" | "TEAM_LEADER" | "MEMBER";
export type DirectoryUser = Readonly<{
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus;
  roleCodes: readonly RoleCode[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;
export type UserList = Readonly<{
  data: readonly DirectoryUser[];
  pagination: Readonly<{ page: number; pageSize: number; totalItems: number; totalPages: number }>;
}>;
export type UserListInput = Readonly<{ page: number; pageSize: number; status?: UserStatus; roleCode?: RoleCode }>;
export type UserUpdateInput = Readonly<{ userId: string; fullName?: string; avatarUrl?: string | null; status?: UserStatus }>;

export const userKeys = {
  all: ["users"] as const,
  list: (organizationId: string, input: UserListInput) => ["users", organizationId, "list", input] as const,
  detail: (organizationId: string, userId: string) => ["users", organizationId, "detail", userId] as const,
};

function listSearchParams(input: UserListInput): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  return params.toString();
}

export function useUsersQuery(organizationId: string, input: UserListInput) {
  return useQuery({
    queryKey: userKeys.list(organizationId, input),
    queryFn: () => apiClient<UserList>(`/iam/users?${listSearchParams(input)}`),
    enabled: Boolean(organizationId),
    retry: false,
  });
}

export function useUserQuery(organizationId: string, userId: string) {
  return useQuery({
    queryKey: userKeys.detail(organizationId, userId),
    queryFn: () => apiClient<DirectoryUser>(`/iam/users/${encodeURIComponent(userId)}`),
    enabled: Boolean(organizationId && userId),
    retry: false,
  });
}

export function useUpdateUserMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...changes }: UserUpdateInput) => apiClient<DirectoryUser>(`/iam/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),
    onSuccess: (updated) => {
      client.invalidateQueries({ queryKey: userKeys.all });
      const current = client.getQueryData<CurrentUserResponse>(authKeys.currentUser());
      if (current?.id === updated.id) client.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
  });
}
