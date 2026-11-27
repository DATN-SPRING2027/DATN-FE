import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, setAuthContextHint } from "@/lib/api-client";
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
    setAuthContextHint(null);
  });

  it("authenticates normal organization users via /auth/login without probing /auth/platform/login", async () => {
    const accountResponse = {
      user: {
        id: "member",
        email: "user@example.test",
        name: "Member",
        context: "ACCOUNT",
      },
    };
    request.mockResolvedValueOnce(accountResponse);
    request.mockResolvedValueOnce([{ id: "org-1", name: "Northstar" }]);

    expect(await loginFromSharedForm(credentials)).toEqual(accountResponse);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/auth/organizations",
      expect.objectContaining({ skipSessionRecovery: true }),
    );
    expect(request).not.toHaveBeenCalledWith(
      "/auth/platform/login",
      expect.anything(),
    );
  });

  it("returns immediately when organizationId is supplied without extra probes", async () => {
    const orgCredentials = { ...credentials, organizationId: "org-1" };
    const orgResponse = {
      user: {
        id: "member",
        email: "user@example.test",
        name: "Member",
        organizationId: "org-1",
        roles: ["MEMBER"],
      },
    };
    request.mockResolvedValueOnce(orgResponse);

    expect(await loginFromSharedForm(orgCredentials)).toEqual(orgResponse);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({ body: JSON.stringify(orgCredentials) }),
    );
  });

  it("upgrades a zero-organization Platform Operator to a verified Platform session", async () => {
    const accountResponse = {
      user: {
        id: "operator",
        email: "op@example.test",
        name: "Operator",
        context: "ACCOUNT",
      },
    };
    const platformResponse = {
      context: "PLATFORM",
      user: { id: "operator", email: "op@example.test", name: "Operator" },
    };
    request.mockResolvedValueOnce(accountResponse);
    request.mockResolvedValueOnce([]);
    request.mockResolvedValueOnce(platformResponse);

    expect(await loginFromSharedForm(credentials)).toEqual(platformResponse);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenNthCalledWith(
      3,
      "/auth/platform/login",
      expect.objectContaining({ body: JSON.stringify(credentials) }),
    );
  });

  it("keeps the ACCOUNT session for a zero-organization user when /auth/platform/login returns uniform 401", async () => {
    const accountResponse = {
      user: {
        id: "new-user",
        email: "new@example.test",
        name: "New User",
        context: "ACCOUNT",
      },
    };
    request.mockResolvedValueOnce(accountResponse);
    request.mockResolvedValueOnce([]);
    request.mockRejectedValueOnce(
      new ApiError(401, "AUTHENTICATION_FAILED", "Invalid credentials"),
    );

    expect(await loginFromSharedForm(credentials)).toEqual(accountResponse);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([401, 422, 429, 500, 503])(
    "fails closed after HTTP %i from /auth/login without extra calls",
    async (status) => {
      const error = new ApiError(status, "FAILED", "Failed");
      request.mockRejectedValue(error);
      await expect(loginFromSharedForm(credentials)).rejects.toBe(error);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it("does not fall back on network errors from /auth/login", async () => {
    const error = new TypeError("offline");
    request.mockRejectedValue(error);
    await expect(loginFromSharedForm(credentials)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("restores an account or organization session first without triggering refresh recovery", async () => {
    const session = { id: "member", context: "ACCOUNT" as const };
    request.mockResolvedValueOnce(session);
    expect(await loadSignInSession()).toEqual(session);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/auth/me",
      expect.objectContaining({ skipSessionRecovery: true }),
    );
  });

  it("restores a verified Platform session after /auth/me returns 401", async () => {
    const platformSession = {
      id: "0123456789abcdef01234567",
      name: "Operator",
      email: "op@example.test",
      context: "PLATFORM" as const,
      permissions: [],
    };
    request.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "No tenant session"),
    );
    request.mockResolvedValueOnce(platformSession);
    expect(await loadSignInSession()).toEqual(platformSession);
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/auth/platform/me",
      expect.objectContaining({ skipSessionRecovery: true }),
    );
  });

  it("probes /auth/platform/me directly without calling /auth/me when PLATFORM context hint is active", async () => {
    const platformSession = {
      id: "0123456789abcdef01234567",
      name: "Operator",
      email: "op@example.test",
      context: "PLATFORM" as const,
      permissions: [],
    };
    setAuthContextHint("PLATFORM");
    request.mockResolvedValueOnce(platformSession);
    expect(await loadSignInSession()).toEqual(platformSession);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/auth/platform/me",
      expect.objectContaining({ skipSessionRecovery: true }),
    );
  });

  it("does not mask a backend outage as a platform session check", async () => {
    request.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "Offline"));
    await expect(loadSignInSession()).rejects.toMatchObject({ status: 503 });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
