"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InputFocusPolicy from "@/components/form/InputFocusPolicy";
import { useEffect, useState } from "react";
import {
  installBrowserExtensionHydrationGuard,
  teardownBrowserExtensionHydrationGuard,
} from "@/lib/browser-extension-hydration-guard";
import {
  ApiError,
  setActiveUserIdHint,
  setExpectedOrganizationId,
} from "@/lib/api-client";
import { currentSessionIdentityKey, handleSessionError } from "@/lib/queries/auth/session-errors";
import { subscribeToAuthSessionChanges } from "@/lib/queries/auth/session-sync";
import { clearAllClientSessionCaches } from "@/lib/session-cleanup";

const HYDRATION_GUARD_TEARDOWN_DELAY_MS = 1_500;

if (typeof window !== "undefined") {
  installBrowserExtensionHydrationGuard();
}

type AppProvidersProps = Readonly<{
  children: React.ReactNode;
}>;

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    installBrowserExtensionHydrationGuard();
    const timer = window.setTimeout(() => {
      teardownBrowserExtensionHydrationGuard();
    }, HYDRATION_GUARD_TEARDOWN_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      teardownBrowserExtensionHydrationGuard();
    };
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
            !(error instanceof ApiError && (error.status === 401 || error.sessionRecoveryFailed)) &&
            failureCount < 1,
          staleTime: 30_000,
        },
      },
    });
    return client;
  });

  useEffect(
    () =>
      subscribeToAuthSessionChanges(() => {
        setExpectedOrganizationId(null);
        setActiveUserIdHint(null);
        clearAllClientSessionCaches();
        queryClient.removeQueries({
          predicate: (query) => query.getObserversCount() === 0,
        });
        void queryClient.resetQueries();
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <InputFocusPolicy />
      {children}
    </QueryClientProvider>
  );
}
