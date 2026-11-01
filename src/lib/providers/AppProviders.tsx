"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InputFocusPolicy from "@/components/form/InputFocusPolicy";
import { useEffect, useInsertionEffect, useState } from "react";
import { installBrowserExtensionHydrationGuard } from "@/lib/browser-extension-hydration-guard";
import { ApiError } from "@/lib/api-client";
import { currentSessionIdentityKey, handleSessionError } from "@/lib/queries/auth/session-errors";
import { subscribeToAuthSessionChanges } from "@/lib/queries/auth/session-sync";

if (typeof window !== "undefined") {
  installBrowserExtensionHydrationGuard();
}

type AppProvidersProps = Readonly<{
  children: React.ReactNode;
}>;

export function AppProviders({ children }: AppProvidersProps) {
  useInsertionEffect(() => {
    installBrowserExtensionHydrationGuard();
  }, []);
  const [queryClient] = useState(() => {
    const client = new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            handleSessionError(
              client,
              error,
              currentSessionIdentityKey(query.queryKey),
              query.queryKey,
            );
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (!["login", "logout"].includes(String(mutation.options.mutationKey?.[0]))) {
              handleSessionError(client, error, false, mutation.options.mutationKey);
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
  const [sessionGeneration, setSessionGeneration] = useState(0);

  useEffect(
    () => subscribeToAuthSessionChanges(() => {
      queryClient.clear();
      setSessionGeneration((generation) => generation + 1);
    }),
    [queryClient],
  );

  return (
    <QueryClientProvider key={sessionGeneration} client={queryClient}><InputFocusPolicy />{children}</QueryClientProvider>
  );
}
