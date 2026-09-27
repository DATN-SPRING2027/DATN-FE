import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { authKeys } from "./auth.keys";

export function isCurrentUserKey(key: readonly unknown[]): boolean {
  const currentUserKey = authKeys.currentUser();
  return key.length === currentUserKey.length && key.every((part, index) => part === currentUserKey[index]);
}

export function handleSessionError(
  client: QueryClient,
  error: unknown,
  isCurrentUserRequest = false,
): void {
  if (!(error instanceof ApiError) || error.status !== 401) return;

  if (isCurrentUserRequest) {
    client.removeQueries({
      predicate: (query) => !isCurrentUserKey(query.queryKey),
    });
  } else {
    // Hide the cached identity now, then let the layout's active /auth/me
    // observer verify the session after this request has settled.
    client.setQueryData(authKeys.currentUser(), null);
    setTimeout(() => {
      void client.resetQueries({ queryKey: authKeys.currentUser() }).catch(() => {
        // The query itself carries the 401 for the layout guard.
      });
    }, 0);
  }
}
