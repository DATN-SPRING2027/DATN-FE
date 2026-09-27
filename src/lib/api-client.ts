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
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    let detail: { code?: string; message?: string } = {};
    try {
      detail = JSON.parse(errorBody);
    } catch {
      // Preserve the raw response for non-JSON errors.
    }
    throw new ApiError(
      response.status,
      detail.code,
      detail.message ?? `API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
