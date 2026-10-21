import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { platformSessionQueryKey } from "@/lib/queries/platform/platform-session.key";
import { authKeys } from "./auth.keys";

export function isCurrentUserKey(key: readonly unknown[]): boolean {
  const currentUserKey = authKeys.currentUser();
  return key.length === currentUserKey.length && key.every((part, index) => part === currentUserKey[index]);
}

function matchesQueryKey(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function schedulePlatformSessionRecheck(client: QueryClient): void {
  setTimeout(() => {
    void client.resetQueries({ queryKey: platformSessionQueryKey }).catch(() => {
      // The Platform identity query carries the terminal error for the route guard.
    });
  }, 0);
}

export function currentSessionIdentityKey(key: readonly unknown[]): readonly unknown[] | undefined {
  if (isCurrentUserKey(key)) return authKeys.currentUser();
  if (matchesQueryKey(key, authKeys.session())) return authKeys.session();
  if (matchesQueryKey(key, platformSessionQueryKey)) return platformSessionQueryKey;
  return undefined;
}

export function handleSessionError(
  client: QueryClient,
  error: unknown,
  currentIdentityKey: readonly unknown[] | boolean = false,
  requestKey?: readonly unknown[],
): void {
  if (!(error instanceof ApiError)) return;
  const activeIdentityKey = currentIdentityKey === true
    ? authKeys.currentUser()
    : Array.isArray(currentIdentityKey) ? currentIdentityKey : undefined;
  const fallbackIdentityKey = activeIdentityKey ?? authKeys.currentUser();
  const isPlatformRequest = requestKey?.[0] === "platform-console";
  const isPlatformIdentityRequest = Boolean(requestKey && matchesQueryKey(requestKey, platformSessionQueryKey));

  if (isPlatformRequest && !isPlatformIdentityRequest && (error.sessionRecoveryFailed || error.status === 401)) {
    client.setQueryData(platformSessionQueryKey, null);
    client.removeQueries({
      predicate: (query) => !matchesQueryKey(query.queryKey, platformSessionQueryKey),
    });
    schedulePlatformSessionRecheck(client);
    return;
  }

  if (error.sessionRecoveryFailed) {
    client.removeQueries({
      predicate: (query) =>
        !matchesQueryKey(query.queryKey, fallbackIdentityKey) &&
        !(requestKey && matchesQueryKey(query.queryKey, requestKey)),
    });
    return;
  }
  if (error.status !== 401) return;

  if (activeIdentityKey) {
    client.removeQueries({
      predicate: (query) => !matchesQueryKey(query.queryKey, activeIdentityKey),
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
