import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError, apiClient, getApiBaseUrl, getServerApiBaseUrl } from "./api-client";

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
      })
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
      "API request failed: 500 Internal Server Error - Server crashed"
    );
  });

  it("exposes auth status and code without treating an error body as a session", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: () => Promise.resolve(JSON.stringify({ code: "ORGANIZATION_SELECTION_REQUIRED", message: "Select an organization to continue.", details: { organizations: [{ id: "org-a", name: "Alpha" }] } })),
    } as Response);

    await expect(apiClient("/auth/login")).rejects.toMatchObject({
      status: 409,
      code: "ORGANIZATION_SELECTION_REQUIRED",
      message: "Select an organization to continue.",
      organizations: [{ id: "org-a", name: "Alpha" }],
    } satisfies Partial<ApiError>);
  });

  describe("session recovery", () => {
    const originalWindow = global.window;

    beforeEach(() => {
      global.window = {} as any;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it("retries request automatically on 401 when refresh succeeds", async () => {
      const mockData = { data: "success" };
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth/refresh")) {
          return Promise.resolve({ ok: true } as Response);
        }
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve("Unauthorized"),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockData),
        } as Response);
      });

      const result = await apiClient<{ data: string }>("/protected");

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "/api/backend/protected",
        expect.anything()
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "/api/v1/auth/refresh",
        expect.anything()
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        "/api/backend/protected",
        expect.anything()
      );
      expect(result).toEqual(mockData);
    });

    it("fails and throws original error if refresh fails", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth/refresh")) {
          return Promise.resolve({
            ok: false,
            status: 401,
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: () => Promise.resolve(JSON.stringify({ message: "Expired" })),
        } as Response);
      });

      await expect(apiClient("/protected")).rejects.toThrow(
        "Expired"
      );
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry if endpoint is auth/refresh", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve(""),
      } as Response);

      await expect(apiClient("/auth/refresh")).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
