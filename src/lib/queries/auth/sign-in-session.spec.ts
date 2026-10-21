import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "@/lib/api-client";
import { loginFromSharedForm, loadSignInSession } from "./sign-in-session";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const request = vi.mocked(apiClient);
const credentials = { email: "user@example.test", password: "secret" };
describe("shared sign-in", () => {
  beforeEach(() => {
    request.mockReset();
  });
  it("uses the server-issued Platform context without a tenant login", async () => {
    const response = { context: "PLATFORM", user: { id: "operator" } };
    request.mockResolvedValue(response);
    expect(await loginFromSharedForm(credentials)).toEqual(response);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/auth/platform/login",
      expect.objectContaining({ body: JSON.stringify(credentials) }),
    );
  });
  it("continues with account login only for the explicit platform permission denial", async () => {
    request.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "Denied"));
    request.mockResolvedValueOnce({ user: { id: "member" } });
    await loginFromSharedForm(credentials);
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/auth/login",
      expect.objectContaining({ body: JSON.stringify(credentials) }),
    );
  });
  it.each([401, 422, 429, 500, 503])(
    "does not retry credentials after HTTP %i",
    async (status) => {
      const error = new ApiError(status, "FAILED", "Failed");
      request.mockRejectedValue(error);
      await expect(loginFromSharedForm(credentials)).rejects.toBe(error);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("does not fall back on network errors or other forbidden errors", async () => {
    for (const error of [
      new TypeError("offline"),
      new ApiError(403, "AUTH_CSRF_INVALID", "Denied"),
    ]) {
      request.mockReset().mockRejectedValue(error);
      await expect(loginFromSharedForm(credentials)).rejects.toBe(error);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it("restores a verified Platform session without probing tenant identity", async () => {
    const session = {
      id: "0123456789abcdef01234567",
      name: "Operator",
      email: "op@example.test",
      context: "PLATFORM",
      permissions: [],
    };
    request.mockResolvedValue(session);
    expect(await loadSignInSession()).toEqual(session);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("restores the account session after a platform-context 401", async () => {
    request.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "No platform session"),
    );
    request.mockResolvedValueOnce({ id: "member", context: "ACCOUNT" });
    expect(await loadSignInSession()).toEqual({
      id: "member",
      context: "ACCOUNT",
    });
    expect(request).toHaveBeenLastCalledWith("/auth/me");
  });
  it("does not mask a platform identity outage as a tenant session", async () => {
    request.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "Offline"));
    await expect(loadSignInSession()).rejects.toMatchObject({ status: 503 });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
