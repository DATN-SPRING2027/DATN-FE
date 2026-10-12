"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiClient, logoutSession } from "@/lib/api-client";
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
    refetchOnWindowFocus: (query) => query.state.status !== "error",
    refetchOnReconnect: (query) => query.state.status !== "error",
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
    retry: false,
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
    mutationKey: ["logout"],
    retry: false,
    // Report offline failure instead of leaving logout queued until reconnect.
    networkMode: "always",
    mutationFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        await logoutSession(controller.signal);
      } finally {
        clearTimeout(timeout);
      }
    },
    onSuccess: (...args) => {
      queryClient.clear();
      options?.onSuccess?.(...args);
    },
  });
}
