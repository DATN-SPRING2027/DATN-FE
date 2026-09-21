"use client";

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type BackendHealthResponse = Readonly<{
  status: "ok";
}>;

export const backendQueryKeys = {
  health: ["backend", "health"] as const,
};

export function useBackendHealthQuery() {
  return useQuery({
    queryKey: backendQueryKeys.health,
    queryFn: () => apiClient<BackendHealthResponse>("/health"),
  });
}

export type BackendMutationInput<TBody> = Readonly<{
  endpoint: string;
  body?: TBody;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
}>;

export function useBackendMutation<
  TResponse,
  TBody = unknown,
  TError = Error,
>(
  options?: Omit<
    UseMutationOptions<
      TResponse,
      TError,
      BackendMutationInput<TBody>,
      unknown
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: ({ endpoint, body, method = "POST" }) =>
      apiClient<TResponse>(endpoint, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
  });
}
