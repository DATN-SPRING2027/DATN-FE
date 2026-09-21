"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { authKeys } from "./auth.keys";

export type LoginInput = Readonly<{
  email: string;
  password: string;
}>;

export type AuthSession = Readonly<{
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
}>;

export type CurrentUserResponse = Readonly<{
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: readonly string[];
}>;

export function useCurrentUserQuery(
  options?: Omit<UseQueryOptions<CurrentUserResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    ...options,
    queryKey: authKeys.currentUser(),
    queryFn: () => apiClient<CurrentUserResponse>("/users/me"),
  });
}

export function useLoginMutation(
  options?: Omit<UseMutationOptions<AuthSession, Error, LoginInput>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (credentials: LoginInput) =>
      apiClient<AuthSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useLogoutMutation(
  options?: Omit<UseMutationOptions<void, Error, void>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: () =>
      apiClient<void>("/auth/logout", {
        method: "POST",
      }),
    onSuccess: (...args) => {
      queryClient.clear();
      options?.onSuccess?.(...args);
    },
  });
}
