import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  getPlatformErrorKind,
  platformErrorMessageKey,
  withPlatformApiTimeout,
} from "./platform-api";

describe("getPlatformErrorKind", () => {
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "notFound"],
    [409, "conflict"],
    [422, "validation"],
    [429, "rateLimited"],
    [500, "server"],
    [599, "server"],
    [408, "timeout"],
  ] as const)("normalizes HTTP %s to %s", (status, expected) => {
    expect(getPlatformErrorKind(new ApiError(status, "PRIVATE_CODE", "private stack trace"))).toBe(expected);
  });

  it("distinguishes network failures from unknown errors", () => {
    expect(getPlatformErrorKind(new TypeError("Failed to fetch"))).toBe("network");
    expect(getPlatformErrorKind(new Error("unexpected"))).toBe("unknown");
  });

  it("maps errors to safe translation keys instead of backend messages", () => {
    expect(platformErrorMessageKey(new ApiError(500, "PRIVATE_CODE", "secret backend stack"), "errors.health"))
      .toBe("errors.server");
  });
});

describe("withPlatformApiTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("aborts and reports a timed out request", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const request = withPlatformApiTimeout((signal) => {
      requestSignal = signal;
      return new Promise<never>(() => {});
    }, 1_000);
    const rejected = expect(request).rejects.toMatchObject({ kind: "timeout" });

    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;

    expect(requestSignal?.aborted).toBe(true);
  });

  it("propagates query cancellation and settles even when the request ignores AbortSignal", async () => {
    const parent = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const request = withPlatformApiTimeout((signal) => {
      requestSignal = signal;
      return new Promise<never>(() => {});
    }, 10_000, parent.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });

    parent.abort();
    await rejected;

    expect(requestSignal?.aborted).toBe(true);
  });
});
