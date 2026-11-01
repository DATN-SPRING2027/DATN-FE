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
import { notifyAuthSessionChanged } from "./session-sync";

export type LoginInput = Readonly<{
  email: string;
  password: string;
  organizationId?: string;
}>;

export type LoginResponse = Readonly<{
  user: CurrentUserResponse;
}>;

export type PasswordResetRequestInput = Readonly<{ email: string }>;
export type PasswordResetRequestResponse = Readonly<{ status: "accepted" }>;
export type PasswordResetConfirmInput = Readonly<{
  token: string;
  password: string;
}>;
export type EmailRegistrationRequestInput = Readonly<{
  fullName: string;
  email: string;
}>;
export type EmailRegistrationRequestResponse = Readonly<{
  status: "accepted";
}>;
export type EmailRegistrationVerifyInput = Readonly<{
  token: string;
  password: string;
}>;

export type CurrentUserResponse =
  | Readonly<{
      id: string;
      email: string;
      name: string;
      context: "ACCOUNT";
      organizationId?: never;
      roles?: never;
    }>
  | Readonly<{
      id: string;
      email: string;
      name: string;
      context?: "ORGANIZATION";
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
      // Tenant-scoped cached data may belong to a different account using the
      // same browser. Drop it before the protected shell loads for this login.
      queryClient.removeQueries();
      notifyAuthSessionChanged();
      options?.onSuccess?.(...args);
    },
  });
}

export function useRequestPasswordResetMutation(
  options?: Omit<
    UseMutationOptions<
      PasswordResetRequestResponse,
      Error,
      PasswordResetRequestInput
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationKey: ["password-reset-request"],
    retry: false,
    mutationFn: ({ email }) =>
      apiClient<PasswordResetRequestResponse>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
  });
}

export function useCompletePasswordResetMutation(
  options?: Omit<
    UseMutationOptions<void, Error, PasswordResetConfirmInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationKey: ["password-reset-confirm"],
    retry: false,
    mutationFn: ({ token, password }) =>
      apiClient<void>("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
  });
}

export function useRequestEmailRegistrationMutation(
  options?: Omit<
    UseMutationOptions<
      EmailRegistrationRequestResponse,
      Error,
      EmailRegistrationRequestInput
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationKey: ["email-registration-request"],
    retry: false,
    mutationFn: ({ fullName, email }) =>
      apiClient<EmailRegistrationRequestResponse>("/auth/registrations", {
        method: "POST",
        body: JSON.stringify({ fullName, email }),
      }),
  });
}

export function useVerifyEmailRegistrationMutation(
  options?: Omit<
    UseMutationOptions<void, Error, EmailRegistrationVerifyInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationKey: ["email-registration-verify"],
    retry: false,
    mutationFn: ({ token, password }) =>
      apiClient<void>("/auth/registrations/verify", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
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
      notifyAuthSessionChanged();
      options?.onSuccess?.(...args);
    },
  });
}
