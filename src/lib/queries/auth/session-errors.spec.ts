import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { authKeys } from "./auth.keys";
import { handleSessionError } from "./session-errors";

describe("protected request session errors", () => {
  afterEach(() => vi.useRealTimers());

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
});
