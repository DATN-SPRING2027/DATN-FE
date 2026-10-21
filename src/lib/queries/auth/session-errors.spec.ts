import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { authKeys } from "./auth.keys";
import { platformSessionQueryKey } from "@/lib/queries/platform/platform-session.key";
import { handleSessionError, currentSessionIdentityKey } from "./session-errors";

describe("protected request session errors", () => {
  afterEach(() => vi.useRealTimers());


  it("recognizes the shared sign-in identity and keeps its terminal error", () => {
    const client = new QueryClient();
    client.setQueryData(authKeys.session(), null);
    client.setQueryData(["users"], [{ id: "private" }]);
    expect(currentSessionIdentityKey(authKeys.session())).toEqual(authKeys.session());
    handleSessionError(client, new ApiError(401, "UNAUTHORIZED", "Expired"), currentSessionIdentityKey(authKeys.session()), authKeys.session());
    expect(client.getQueryData(authKeys.session())).toBeNull();
    expect(client.getQueryData(["users"])).toBeUndefined();
  });

  it("rechecks a previously successful /auth/me when Users receives 401", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    client.setQueryData(authKeys.currentUser(), { id: "user-1" });
    const reset = vi.spyOn(client, "resetQueries").mockResolvedValue(undefined);

    handleSessionError(client, new ApiError(401, "AUTHENTICATION_FAILED", "Expired"));
    expect(client.getQueryData(authKeys.currentUser())).toBeNull();
    await vi.runAllTimersAsync();

    expect(reset).toHaveBeenCalledWith({ queryKey: authKeys.currentUser() });
  });

  it("clears private cached data when /auth/me confirms 401", () => {
    const client = new QueryClient();
    client.setQueryData(authKeys.currentUser(), { id: "user-1" });
    client.setQueryData(["users", "org-1"], [{ id: "user-2" }]);

    handleSessionError(client, new ApiError(401, "AUTHENTICATION_FAILED", "Expired"), true);

    expect(client.getQueryData(["users", "org-1"])).toBeUndefined();
    expect(client.getQueryData(authKeys.currentUser())).toEqual({ id: "user-1" });
  });

  it("keeps a 403 as an authorization error", () => {
    const client = new QueryClient();
    const reset = vi.spyOn(client, "resetQueries");
    handleSessionError(client, new ApiError(403, "FORBIDDEN", "Forbidden"));
    expect(reset).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500, 503])("clears private cache after terminal recovery failure %s without rechecking", (status) => {
    const client = new QueryClient();
    client.setQueryData(authKeys.currentUser(), { id: "user" });
    client.setQueryData(["users"], [{ id: "private-user" }]);
    const reset = vi.spyOn(client, "resetQueries");
    handleSessionError(client, new ApiError(status, "AUTH_REFRESH_FAILED", "Failed", undefined, true), true);
    expect(client.getQueryData(["users"])).toBeUndefined();
    expect(reset).not.toHaveBeenCalled();
  });

  it("keeps the failed Platform identity query while clearing its private data", () => {
    const client = new QueryClient();
    const platformSession = { context: "PLATFORM", id: "operator" };
    client.setQueryData(platformSessionQueryKey, platformSession);
    client.setQueryData(["platform-console", "organizations"], [{ id: "org-1" }]);
    client.setQueryData(["other-private-data"], [{ id: "private-1" }]);

    handleSessionError(client, new ApiError(403, "AUTH_CSRF_INVALID", "Refresh failed", undefined, true), platformSessionQueryKey);

    expect(client.getQueryData(platformSessionQueryKey)).toEqual(platformSession);
    expect(client.getQueryData(["platform-console", "organizations"])).toBeUndefined();
    expect(client.getQueryData(["other-private-data"])).toBeUndefined();
  });

  it("keeps a failed Platform request terminal, clears other private data, and rechecks Platform identity once", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    client.setQueryData(platformSessionQueryKey, { context: "PLATFORM", id: "operator" });
    const failedRequestKey = ["platform-console", "organizations", 1] as const;
    client.setQueryData(failedRequestKey, [{ id: "org-1" }]);
    client.setQueryData(["platform-console", "audit"], [{ action: "private" }]);
    const reset = vi.spyOn(client, "resetQueries").mockResolvedValue(undefined);

    handleSessionError(
      client,
      new ApiError(403, "AUTH_CSRF_INVALID", "Refresh failed", undefined, true),
      undefined,
      failedRequestKey,
    );
    await vi.runAllTimersAsync();

    expect(client.getQueryData(platformSessionQueryKey)).toBeUndefined();
    expect(client.getQueryData(failedRequestKey)).toBeUndefined();
    expect(client.getQueryData(["platform-console", "audit"])).toBeUndefined();
    expect(reset).toHaveBeenCalledWith({ queryKey: platformSessionQueryKey });
  });
});
