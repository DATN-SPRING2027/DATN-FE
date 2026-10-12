"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { handleSessionError, isCurrentUserKey } from "@/lib/queries/auth/session-errors";

type AppProvidersProps = Readonly<{
  children: React.ReactNode;
}>;

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            handleSessionError(
              client,
              error,
              isCurrentUserKey(query.queryKey),
            );
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (!["login", "logout"].includes(String(mutation.options.mutationKey?.[0]))) {
              handleSessionError(client, error);
            }
          },
        }),
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
              !(error instanceof ApiError && (error.status === 401 || error.sessionRecoveryFailed)) && failureCount < 1,
            staleTime: 30_000,
          },
        },
      });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
