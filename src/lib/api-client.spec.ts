import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, getApiBaseUrl, getServerApiBaseUrl } from "./api-client";

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

  it("accepts a 204 response for commands without a response body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);

    await expect(
      apiClient<void>("/projects/project-1/work-items/item-1", {
        method: "DELETE",
      }),
    ).resolves.toBeUndefined();
  });
});
