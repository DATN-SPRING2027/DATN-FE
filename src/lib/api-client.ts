/**
 * Continuum AI — API Client
 * Centralized HTTP client for communication with the BFF or backend boundary.
 */

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
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAccessOrResourceUnavailableError(
  error: unknown,
): error is ApiError {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

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

async function recoverSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = apiClient("/api/v1/auth/refresh", { method: "POST" })
      .then(() => { sessionGeneration += 1; })
      .finally(() => { refreshInFlight = undefined; });
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
      await apiClient<void>("/api/v1/auth/logout", { method: "POST", signal });
    })().finally(() => {
      logoutInFlight = undefined;
    });
  }

  return logoutInFlight;
}

export interface ApiRequestOptions extends RequestInit {
  onResponseHeaders?: (headers: Headers) => void;
}

export async function apiClient<T>(
  endpoint: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = normalizedEndpoint.startsWith("/api/v1/")
    ? normalizedEndpoint
    : `${baseUrl}${normalizedEndpoint}`;

  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (options?.method ?? "GET").toUpperCase();
  const safeMethod = ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  if (!safeMethod && typeof document !== "undefined") {
    const csrfCookie = document.cookie.split(";").map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("__Host-csrf="));
    if (csrfCookie && (normalizedEndpoint === "/api/v1/auth/refresh" || !headers.has("X-CSRF-Token"))) {
      headers.set("X-CSRF-Token", csrfCookie.slice("__Host-csrf=".length));
    }
  }

  const { onResponseHeaders, ...fetchOptions } = options ?? {};
  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers,
    credentials: "include",
  };
  const generation = sessionGeneration;
  let response = await fetch(url, requestOptions);
  let recovered = false;
  if (
    typeof window !== "undefined" &&
    [
      "/auth/me",
      "/api/v1/auth/me",
      "/auth/platform/me",
      "/api/v1/auth/platform/me",
    ].includes(normalizedEndpoint) &&
    (options?.method ?? "GET").toUpperCase() === "GET" &&
    response.status === 401
  ) {
    // Only the session probe may be replayed. Mutations never enter this flow.
    if (logoutInFlight) {
      try {
        await logoutInFlight;
      } catch (error) {
        throw recoveryError(error);
      }
    } else if (generation === sessionGeneration) {
      await recoverSession();
    }
    recovered = true;
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
    );
  }

  onResponseHeaders?.(new Headers(response.headers));
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
