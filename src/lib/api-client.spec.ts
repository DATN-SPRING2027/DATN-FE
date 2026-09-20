import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, getApiBaseUrl } from "./api-client";

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

  it("returns default API base URL", () => {
    delete process.env.CONTINUUM_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getApiBaseUrl()).toBe("http://localhost:3001/api/v1");
  });

  it("performs GET request and parses JSON response", async () => {
    const mockData = { status: "ok" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiClient<{ status: string }>("/health");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/health",
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
});
