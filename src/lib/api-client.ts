/**
 * Continuum AI — API Client
 * Centralized HTTP client for communication with the BFF or backend boundary.
 */

import {
  notifyAuthSessionChanged,
  syncCurrentAuthSessionCookie,
} from "@/lib/queries/auth/session-sync";

export function getServerApiBaseUrl(): string {
  const configuredBaseUrl =
    process.env.CONTINUUM_API_BASE_URL || "http://localhost:3001";
  const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, "");

  return normalizedBaseUrl.endsWith("/api/v1")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api/v1`;
}

export function getApiBaseUrl(): string {
  return typeof window === "undefined" ? getServerApiBaseUrl() : "/api/backend";
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly organizations?: readonly { id: string; name: string }[],
    public readonly sessionRecoveryFailed = false,
    public readonly details?: Readonly<Record<string, unknown>>,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseRetryAfterMs(headerValue: string | null | undefined): number | undefined {
  if (!headerValue) return undefined;
  const trimmed = headerValue.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(Math.max(Math.round(seconds * 1_000), 1_000), 300_000);
  }
  const targetMs = Date.parse(trimmed);
  if (!Number.isNaN(targetMs)) {
    const delta = targetMs - Date.now();
    if (delta > 0) {
      return Math.min(Math.max(Math.round(delta), 1_000), 300_000);
    }
  }
  return undefined;
}

export function isAccessOrResourceUnavailableError(
  error: unknown,
): error is ApiError {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

const CSRF_COOKIE_PREFIXES = [
  "__Host-csrf=",
  "continuum_csrf=",
  "csrf_token=",
] as const;

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((cookie) => cookie.trim());
  for (const prefix of CSRF_COOKIE_PREFIXES) {
    const entry = parts.find((cookie) => cookie.startsWith(prefix));
    if (entry) {
      const rawValue = entry.slice(prefix.length);
      if (!rawValue) continue;
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
}

export function hasClientSessionHint(): boolean {
  return Boolean(getCsrfToken());
}

let expectedOrganizationId: string | null = null;
let activeUserIdHint: string | null = null;
const AUTH_CONTEXT_HINT_KEY = "continuum:auth-context";
let authContextHint: "PLATFORM" | null | undefined;
const authContextHintListeners = new Set<() => void>();

function readStoredAuthContextHint(): "PLATFORM" | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(AUTH_CONTEXT_HINT_KEY) === "PLATFORM"
      ? "PLATFORM"
      : null;
  } catch {
    return null;
  }
}

export function getAuthContextHint(): "PLATFORM" | null {
  if (authContextHint === undefined) {
    authContextHint = readStoredAuthContextHint();
  }
  return authContextHint;
}

export function setAuthContextHint(context: "PLATFORM" | null): void {
  const next = context === "PLATFORM" ? "PLATFORM" : null;
  const current = getAuthContextHint();
  authContextHint = next;
  if (typeof window !== "undefined") {
    try {
      if (next === "PLATFORM") {
        window.sessionStorage.setItem(AUTH_CONTEXT_HINT_KEY, "PLATFORM");
      } else {
        window.sessionStorage.removeItem(AUTH_CONTEXT_HINT_KEY);
      }
    } catch {
      // Ignore storage access errors in restricted environments.
    }
  }
  if (current !== next) {
    for (const listener of authContextHintListeners) {
      listener();
    }
  }
}

export function subscribeAuthContextHint(listener: () => void): () => void {
  authContextHintListeners.add(listener);
  return () => {
    authContextHintListeners.delete(listener);
  };
}

export function setExpectedOrganizationId(organizationId: string | null): void {
  const trimmed = organizationId?.trim();
  expectedOrganizationId = trimmed ? trimmed : null;
}

export function getExpectedOrganizationId(): string | null {
  return expectedOrganizationId;
}

export function setActiveUserIdHint(userId: string | null): void {
  const trimmed = userId?.trim();
  activeUserIdHint = trimmed ? trimmed : null;
}

export function getActiveUserIdHint(): string | null {
  return activeUserIdHint;
}

const AUTH_NO_RECOVERY_ENDPOINTS = new Set([
  "/auth/login",
  "/api/v1/auth/login",
  "/auth/platform/login",
  "/api/v1/auth/platform/login",
  "/auth/refresh",
  "/api/v1/auth/refresh",
  "/auth/logout",
  "/api/v1/auth/logout",
  "/auth/registrations",
  "/api/v1/auth/registrations",
  "/auth/registrations/verify",
  "/api/v1/auth/registrations/verify",
  "/auth/password-reset/request",
  "/api/v1/auth/password-reset/request",
  "/auth/password-reset/confirm",
  "/api/v1/auth/password-reset/confirm",
]);

function isOrgScopedEndpoint(normalizedEndpoint: string): boolean {
  if (
    normalizedEndpoint.startsWith("/auth/") ||
    normalizedEndpoint.startsWith("/api/v1/auth/") ||
    normalizedEndpoint.startsWith("/iam/platform/") ||
    normalizedEndpoint === "/health" ||
    normalizedEndpoint === "/api/v1/health" ||
    normalizedEndpoint === "/iam/organizations" ||
    normalizedEndpoint.startsWith("/iam/organizations/slug-availability")
  ) {
    return false;
  }
  return true;
}

function shouldSkipDefaultJsonContentType(body: BodyInit | null | undefined): boolean {
  if (body == null) return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (typeof Blob !== "undefined" && body instanceof Blob) return true;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return true;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return true;
  return false;
}

const CROSS_TAB_REFRESH_LOCK_NAME = "continuum:auth-refresh";
const CROSS_TAB_REFRESH_AT_KEY = "continuum:auth-refresh-at";
const CROSS_TAB_REFRESH_LEASE_KEY = "continuum:auth-refresh-lease";
const CROSS_TAB_REFRESH_CHANNEL = "continuum:auth-refresh-channel";
const CROSS_TAB_RECENT_REFRESH_WINDOW_MS = 2_500;
const CROSS_TAB_LEASE_TTL_MS = 10_000;

let refreshInFlight: Promise<unknown> | undefined;
let sessionGeneration = 0;
let logoutInFlight: Promise<void> | undefined;

function recoveryError(error: unknown): ApiError {
  return new ApiError(
    error instanceof ApiError ? error.status : 503,
    error instanceof ApiError ? error.code : "SESSION_RECOVERY_FAILED",
    error instanceof Error ? error.message : "Session recovery failed",
    undefined,
    true,
  );
}

function readLastCrossTabRefreshAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CROSS_TAB_REFRESH_AT_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function markCrossTabRefreshSucceeded(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  try {
    window.localStorage.setItem(CROSS_TAB_REFRESH_AT_KEY, String(now));
  } catch {
    // Ignore storage restriction
  }
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(CROSS_TAB_REFRESH_CHANNEL);
      channel.postMessage({ type: "refreshed", at: now });
      channel.close();
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

async function runWithCrossTabRefreshLock<T>(
  work: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(CROSS_TAB_REFRESH_LOCK_NAME, work);
  }
  if (typeof window === "undefined") {
    return work();
  }

  const tabToken =
    window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const waitDeadline = Date.now() + 4_000;
  let acquired = false;
  try {
    while (Date.now() < waitDeadline) {
      const rawLease = window.localStorage.getItem(CROSS_TAB_REFRESH_LEASE_KEY);
      let leaseExpired = true;
      if (rawLease) {
        try {
          const parsed = JSON.parse(rawLease) as { token?: string; expiresAt?: number };
          leaseExpired = !parsed.expiresAt || parsed.expiresAt <= Date.now();
        } catch {
          leaseExpired = true;
        }
      }
      if (leaseExpired) {
        window.localStorage.setItem(
          CROSS_TAB_REFRESH_LEASE_KEY,
          JSON.stringify({ token: tabToken, expiresAt: Date.now() + CROSS_TAB_LEASE_TTL_MS }),
        );
        const verify = window.localStorage.getItem(CROSS_TAB_REFRESH_LEASE_KEY);
        if (verify && verify.includes(tabToken)) {
          acquired = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  } catch {
    // Storage unavailable; proceed with in-tab single-flight mutex.
  }

  try {
    return await work();
  } finally {
    if (acquired) {
      try {
        const current = window.localStorage.getItem(CROSS_TAB_REFRESH_LEASE_KEY);
        if (current && current.includes(tabToken)) {
          window.localStorage.removeItem(CROSS_TAB_REFRESH_LEASE_KEY);
        }
      } catch {
        // Ignore
      }
    }
  }
}

export async function recoverAuthSession(): Promise<void> {
  if (logoutInFlight) {
    try {
      await logoutInFlight;
    } catch (error) {
      throw recoveryError(error);
    }
    throw new ApiError(401, "SESSION_LOGGED_OUT", "Session ended", undefined, true);
  }

  if (!refreshInFlight) {
    const startedAt = Date.now();
    refreshInFlight = runWithCrossTabRefreshLock(async () => {
      const lastRefreshAt = readLastCrossTabRefreshAt();
      if (
        lastRefreshAt > startedAt &&
        Date.now() - lastRefreshAt < CROSS_TAB_RECENT_REFRESH_WINDOW_MS
      ) {
        sessionGeneration += 1;
        syncCurrentAuthSessionCookie();
        return;
      }
      try {
        await apiClient("/api/v1/auth/refresh", {
          method: "POST",
          skipSessionRecovery: true,
        });
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          error.code === "AUTH_REFRESH_CONCURRENT"
        ) {
          // Another tab rotated the refresh token inside the backend grace window.
          // Yield briefly so the browser finishes persisting the sibling tab's Set-Cookie.
          await new Promise((resolve) => setTimeout(resolve, 60));
        } else {
          throw error;
        }
      }
      sessionGeneration += 1;
      syncCurrentAuthSessionCookie();
      markCrossTabRefreshSucceeded();
    }).finally(() => {
      refreshInFlight = undefined;
    });
  }
  try {
    await refreshInFlight;
  } catch (error) {
    throw recoveryError(error);
  }
}

function waitForRefresh(
  pendingRefresh: Promise<unknown> | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!pendingRefresh) return Promise.resolve();

  const refreshSettled = pendingRefresh.then(() => undefined, () => undefined);
  if (!signal) return refreshSettled;

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    void refreshSettled.then(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    });
  });
}

export function logoutSession(signal?: AbortSignal): Promise<void> {
  if (!logoutInFlight) {
    const pendingRefresh = refreshInFlight;
    logoutInFlight = (async () => {
      // Rotation may replace the cookie, so logout must revoke after it settles.
      await waitForRefresh(pendingRefresh, signal);
      await apiClient<void>("/api/v1/auth/logout", {
        method: "POST",
        signal,
        skipSessionRecovery: true,
      });
      setAuthContextHint(null);
    })().finally(() => {
      logoutInFlight = undefined;
    });
  }

  return logoutInFlight;
}

export interface ApiRequestOptions extends RequestInit {
  onResponseHeaders?: (headers: Headers) => void;
  skipSessionRecovery?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const endpointPath = normalizedEndpoint.split("?")[0] ?? normalizedEndpoint;
  const url = normalizedEndpoint.startsWith("/api/v1/")
    ? normalizedEndpoint
    : `${baseUrl}${normalizedEndpoint}`;

  const headers = new Headers(options?.headers);
  if (
    !headers.has("Content-Type") &&
    !shouldSkipDefaultJsonContentType(options?.body)
  ) {
    headers.set("Content-Type", "application/json");
  }
  const method = (options?.method ?? "GET").toUpperCase();
  const safeMethod = ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  if (!safeMethod && typeof document !== "undefined") {
    const csrfToken = getCsrfToken();
    if (
      csrfToken &&
      (endpointPath === "/api/v1/auth/refresh" || !headers.has("X-CSRF-Token"))
    ) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }
  if (
    expectedOrganizationId &&
    !headers.has("X-Expected-Organization-Id") &&
    isOrgScopedEndpoint(endpointPath)
  ) {
    headers.set("X-Expected-Organization-Id", expectedOrganizationId);
  }

  const { onResponseHeaders, skipSessionRecovery, ...fetchOptions } = options ?? {};
  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers,
    credentials: "include",
  };
  const generation = sessionGeneration;
  let response = await fetch(url, requestOptions);
  let recovered = false;

  const canAttemptRecovery =
    typeof window !== "undefined" &&
    !skipSessionRecovery &&
    !AUTH_NO_RECOVERY_ENDPOINTS.has(endpointPath) &&
    response.status === 401;

  if (canAttemptRecovery) {
    if (logoutInFlight) {
      try {
        await logoutInFlight;
      } catch (error) {
        throw recoveryError(error);
      }
    } else if (generation === sessionGeneration) {
      await recoverAuthSession();
    }
    recovered = true;
    // Refresh CSRF token on unsafe retries because /auth/refresh rotates the CSRF cookie.
    if (!safeMethod && typeof document !== "undefined") {
      const freshCsrf = getCsrfToken();
      if (freshCsrf) {
        headers.set("X-CSRF-Token", freshCsrf);
      }
    }
    try {
      response = await fetch(url, requestOptions);
    } catch (error) {
      throw recoveryError(error);
    }
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    let detail: {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
    } = {};
    try {
      detail = JSON.parse(errorBody);
    } catch {
      // Preserve the raw response for non-JSON errors.
    }
    const parsedDetails =
      typeof detail.details === "object" &&
      detail.details !== null &&
      !Array.isArray(detail.details)
        ? detail.details
        : undefined;
    if (
      response.status === 409 &&
      detail.code === "ORGANIZATION_CONTEXT_MISMATCH"
    ) {
      notifyAuthSessionChanged();
    }
    const retryAfterMs = parseRetryAfterMs(
      typeof response.headers?.get === "function"
        ? response.headers.get("retry-after")
        : null,
    );
    throw new ApiError(
      response.status,
      detail.code,
      detail.message ??
        `API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
      response.status === 409 &&
        detail.code === "ORGANIZATION_SELECTION_REQUIRED" &&
        Array.isArray(parsedDetails?.organizations)
        ? parsedDetails.organizations.filter(
            (item): item is { id: string; name: string } =>
              typeof item === "object" &&
              item !== null &&
              typeof item.id === "string" &&
              typeof item.name === "string",
          )
        : undefined,
      recovered,
      parsedDetails,
      retryAfterMs,
    );
  }

  onResponseHeaders?.(new Headers(response.headers));
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
