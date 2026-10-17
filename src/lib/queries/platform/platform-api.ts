import { ApiError, apiClient, logoutSession } from "@/lib/api-client";

export const PLATFORM_API_TIMEOUT_MS = 15_000;

export type PlatformErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "validation"
  | "rateLimited"
  | "server"
  | "network"
  | "timeout"
  | "unknown";

export class PlatformRequestError extends Error {
  constructor(public readonly kind: "network" | "timeout") {
    super(kind === "timeout" ? "Platform request timed out" : "Platform API is unreachable");
    this.name = "PlatformRequestError";
  }
}

export function getPlatformErrorKind(error: unknown): PlatformErrorKind {
  if (error instanceof PlatformRequestError) return error.kind;
  if (error instanceof ApiError) {
    if (error.status === 401) return "unauthenticated";
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "notFound";
    if (error.status === 409) return "conflict";
    if (error.status === 422) return "validation";
    if (error.status === 429) return "rateLimited";
    if (error.status === 408) return "timeout";
    if (error.status >= 500 && error.status <= 599) return "server";
  }
  if (error instanceof TypeError) return "network";
  return "unknown";
}

export function platformErrorMessageKey(error: unknown, fallback: string): string {
  const kind = getPlatformErrorKind(error);
  const messageKeys: Partial<Record<PlatformErrorKind, string>> = {
    unauthenticated: "errors.sessionExpired",
    forbidden: "errors.forbidden",
    notFound: "errors.notFound",
    conflict: "errors.conflict",
    validation: "errors.validation",
    rateLimited: "errors.rateLimited",
    server: "errors.server",
    network: "errors.network",
    timeout: "errors.timeout",
  };
  return messageKeys[kind] ?? fallback;
}

export async function withPlatformApiTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = PLATFORM_API_TIMEOUT_MS,
  parentSignal?: AbortSignal,
): Promise<T> {
  if (parentSignal?.aborted) throw parentSignal.reason ?? new DOMException("The operation was aborted", "AbortError");
  const controller = new AbortController();
  let timedOut = false;
  let rejectTimeout!: (error: PlatformRequestError) => void;
  let rejectAborted!: (error: unknown) => void;
  const timeout = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = reject;
  });
  const abortFromParent = () => {
    controller.abort(parentSignal?.reason);
    rejectAborted(parentSignal?.reason ?? new DOMException("The operation was aborted", "AbortError"));
  };
  parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectTimeout(new PlatformRequestError("timeout"));
  }, timeoutMs);

  try {
    return await Promise.race([Promise.resolve().then(() => request(controller.signal)), timeout, aborted]);
  } catch (error) {
    if (parentSignal?.aborted) throw parentSignal.reason ?? error;
    if (timedOut) throw new PlatformRequestError("timeout");
    if (error instanceof ApiError || error instanceof PlatformRequestError) throw error;
    if (error instanceof TypeError) throw new PlatformRequestError("network");
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export function platformApiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { signal: parentSignal, ...requestOptions } = options ?? {};
  return withPlatformApiTimeout(
    (signal) => apiClient<T>(endpoint, { ...requestOptions, signal }),
    PLATFORM_API_TIMEOUT_MS,
    parentSignal ?? undefined,
  );
}

export function platformLogout(): Promise<void> {
  return withPlatformApiTimeout((signal) => logoutSession(signal));
}
