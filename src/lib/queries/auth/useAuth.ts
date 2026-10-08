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
  organizationId?: string;
}>;

export type LoginResponse = Readonly<{
  user: CurrentUserResponse;
}>;

export type CurrentUserResponse = Readonly<{
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: readonly string[];
}>;

export function useCurrentUserQuery(
  options?: Omit<UseQueryOptions<CurrentUserResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    ...options,
    queryKey: authKeys.currentUser(),
    queryFn: () => apiClient<CurrentUserResponse>("/auth/me"),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useLoginMutation(
  options?: Omit<
    UseMutationOptions<LoginResponse, Error, LoginInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationKey: ["login"],
    mutationFn: (credentials: LoginInput) =>
      apiClient<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: (...args) => {
      queryClient.removeQueries({ queryKey: authKeys.currentUser() });
      options?.onSuccess?.(...args);
    },
  });
}

export function useLogoutMutation(
  options?: Omit<UseMutationOptions<void, Error, void>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: () =>
      apiClient<void>("/api/v1/auth/logout", {
        method: "POST",
      }),
    onSuccess: (...args) => {
      queryClient.clear();
      options?.onSuccess?.(...args);
    },
  });
}
