import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  apiClient,
  getApiBaseUrl,
  getServerApiBaseUrl,
} from "./api-client";

describe("apiClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("normalizes the server-only backend base URL", () => {
    delete process.env.CONTINUUM_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getServerApiBaseUrl()).toBe("http://localhost:3001/api/v1");
  });

  it("uses the BFF path in the browser", () => {
    expect(getApiBaseUrl()).toBe("/api/backend");
  });

  it("uses the public auth BFF path when an endpoint starts with /api/v1", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "logged_out" }),
    } as Response);

    await apiClient("/api/v1/auth/logout", { method: "POST" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("performs GET request and parses JSON response", async () => {
    const mockData = { status: "ok" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiClient<{ status: string }>("/health");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/backend/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        credentials: "include",
      }),
    );
    expect(result).toEqual(mockData);
  });

  it("throws descriptive error when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("Server crashed"),
    } as Response);

    await expect(apiClient("/health")).rejects.toThrow(
      "API request failed: 500 Internal Server Error - Server crashed",
    );
  });

  it("exposes auth status and code without treating an error body as a session", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: () =>
        Promise.resolve(
          JSON.stringify({
            code: "ORGANIZATION_SELECTION_REQUIRED",
            message: "Select an organization to continue.",
            details: { organizations: [{ id: "org-a", name: "Alpha" }] },
          }),
        ),
    } as Response);

    await expect(apiClient("/auth/login")).rejects.toMatchObject({
      status: 409,
      code: "ORGANIZATION_SELECTION_REQUIRED",
      message: "Select an organization to continue.",
      organizations: [{ id: "org-a", name: "Alpha" }],
    } satisfies Partial<ApiError>);
  });

  describe("unauthorized responses", () => {
    it.each(["/protected", "/auth/me", "/auth/refresh", "/auth/login"])(
      "propagates 401 from %s without refreshing or replaying the request",
      async (endpoint) => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Expired" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        );

        await expect(apiClient(endpoint)).rejects.toMatchObject({
          name: "ApiError",
          status: 401,
          code: "UNAUTHORIZED",
          message: "Expired",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
          `/api/backend${endpoint}`,
          expect.objectContaining({ credentials: "include" }),
        );
      },
    );

    it("does not replay an unauthorized mutation", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Expired" }), { status: 401 }),
      );
      const body = JSON.stringify({ name: "Project", code: "PR" });

      await expect(apiClient("/iam/projects", { method: "POST", body })).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/backend/iam/projects",
        expect.objectContaining({ method: "POST", body }),
      );
    });
  });
});
