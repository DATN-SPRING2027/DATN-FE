/**
 * Continuum AI — API Client
 * Centralized HTTP client for communication between Next.js (FE) and NestJS (BE).
 */

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server environment (RSC, Route Handlers)
    return process.env.CONTINUUM_API_BASE_URL || "http://localhost:3001/api/v1";
  }
  // Client environment (Browser)
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";
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
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}
