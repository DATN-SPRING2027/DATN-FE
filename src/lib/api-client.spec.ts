import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  apiClient,
  getApiBaseUrl,
  getServerApiBaseUrl,
  logoutSession,
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
        headers: expect.any(Headers),
        credentials: "include",
      }),
    );
    expect(result).toEqual(mockData);
    expect((vi.mocked(global.fetch).mock.calls[0][1]?.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("sends only the readable CSRF cookie value to the public refresh route", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("other=value; __Host-csrf=csrf-value");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "refreshed" }), { status: 200 }),
    );

    await expect(apiClient("/api/v1/auth/refresh", { method: "POST" })).resolves.toEqual({ status: "refreshed" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/refresh");
    const options = fetchMock.mock.calls[0][1]!;
    expect((options.headers as Headers).get("X-CSRF-Token")).toBe("csrf-value");
    expect(options.credentials).toBe("include");
    expect(options.body).toBeUndefined();
  });

  it("leaves missing CSRF validation to NestJS without retrying rejection", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "AUTH_CSRF_INVALID", message: "Invalid CSRF" }), { status: 403 }),
    );

    await expect(apiClient("/api/v1/auth/refresh", { method: "POST" })).rejects.toMatchObject({ status: 403, code: "AUTH_CSRF_INVALID" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]!.headers as Headers).has("X-CSRF-Token")).toBe(false);
  });

  it.each([401, 500])("does not automatically retry a failed refresh (%s)", async (status) => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: status === 401 ? "AUTH_REFRESH_INVALID" : "AUTH_REFRESH_FAILED", message: "Refresh failed" }), { status }),
    );
    await expect(apiClient("/api/v1/auth/refresh", { method: "POST" })).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers an expired session and replays only the session probe once", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"status":"refreshed"}'))
      .mockResolvedValueOnce(new Response('{"id":"current-user"}'));
    await expect(apiClient("/auth/me")).resolves.toEqual({ id: "current-user" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/backend/auth/me", "/api/v1/auth/refresh", "/api/backend/auth/me",
    ]);
  });

  it("does not refresh again when the retried session probe is still unauthorized", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"status":"refreshed"}'))
      .mockResolvedValueOnce(new Response('{"code":"AUTHENTICATION_FAILED"}', { status: 401 }));
    await expect(apiClient("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([401, 403, 500])("stops recovery and exposes the refresh failure (%s)", async (status) => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"message":"Cannot recover"}', { status }));
    await expect(apiClient("/auth/me")).rejects.toMatchObject({ status, sessionRecoveryFailed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exposes refresh network failure without replaying the probe", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockRejectedValueOnce(new TypeError("Offline"));
    await expect(apiClient("/auth/me")).rejects.toMatchObject({ status: 503, sessionRecoveryFailed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("marks a network failure of the replayed probe as terminal recovery failure", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"status":"refreshed"}'))
      .mockRejectedValueOnce(new TypeError("Offline"));
    await expect(apiClient("/auth/me")).rejects.toMatchObject({ status: 503, sessionRecoveryFailed: true });
  });

  it("shares one refresh across concurrent expired session probes", async () => {
    let probeCalls = 0;
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url === "/api/v1/auth/refresh") return new Response('{"status":"refreshed"}');
      probeCalls += 1;
      return probeCalls <= 2 ? new Response('{}', { status: 401 }) : new Response('{"id":"user"}');
    });
    await Promise.all([apiClient("/auth/me"), apiClient("/auth/me")]);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/auth/refresh")).toHaveLength(1);
    expect(probeCalls).toBe(4);
  });

  it("waits for refresh rotation before logout and blocks recovery until logout settles", async () => {
    let finishRefresh!: (response: Response) => void;
    let finishLogout!: (response: Response) => void;
    let refreshCookie = "refresh-old";
    let logoutCookie: string | undefined;
    let probeCalls = 0;
    const calls: string[] = [];
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/auth/refresh") {
        calls.push("refresh");
        return new Promise<Response>((resolve) => {
          finishRefresh = (response) => {
            refreshCookie = "refresh-rotated";
            resolve(response);
          };
        });
      }
      if (url === "/api/v1/auth/logout") {
        calls.push("logout");
        logoutCookie = refreshCookie;
        return new Promise<Response>((resolve) => { finishLogout = resolve; });
      }
      probeCalls += 1;
      calls.push(`probe-${probeCalls}`);
      return probeCalls === 3
        ? new Response('{"id":"current-user"}')
        : new Response("{}", { status: 401 });
    });

    const recoveringProbe = apiClient("/auth/me");
    await vi.waitFor(() => expect(calls).toContain("refresh"));
    const logout = logoutSession();
    const probeDuringLogout = apiClient("/auth/me");
    await vi.waitFor(() => expect(calls).toContain("probe-2"));

    expect(calls).not.toContain("logout");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/auth/refresh")).toHaveLength(1);

    finishRefresh(new Response('{"status":"refreshed"}'));
    await expect(recoveringProbe).resolves.toEqual({ id: "current-user" });
    await vi.waitFor(() => expect(calls).toContain("logout"));
    expect(logoutCookie).toBe("refresh-rotated");
    expect(calls.indexOf("refresh")).toBeLessThan(calls.indexOf("logout"));

    finishLogout(new Response('{"status":"logged_out"}'));
    await logout;
    await expect(probeDuringLogout).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("honors logout cancellation while waiting for refresh", async () => {
    let finishRefresh!: (response: Response) => void;
    let probeCalls = 0;
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/v1/auth/refresh") {
        return new Promise<Response>((resolve) => { finishRefresh = resolve; });
      }
      if (String(input) === "/api/v1/auth/logout") return new Response('{"status":"logged_out"}');
      probeCalls += 1;
      return probeCalls === 1
        ? new Response("{}", { status: 401 })
        : new Response('{"id":"current-user"}');
    });

    const recoveringProbe = apiClient("/auth/me");
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === "/api/v1/auth/refresh")).toBe(true));
    const controller = new AbortController();
    const logout = logoutSession(controller.signal);
    controller.abort();

    await expect(logout).rejects.toMatchObject({ name: "AbortError" });
    finishRefresh(new Response('{"status":"refreshed"}'));
    await expect(recoveringProbe).resolves.toEqual({ id: "current-user" });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/v1/auth/logout")).toBe(false);
  });

  it("rechecks a delayed 401 without rotating again after another probe recovered", async () => {
    let finishDelayedProbe!: (response: Response) => void;
    let probes = 0;
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url === "/api/v1/auth/refresh") return new Response('{"status":"refreshed"}');
      probes += 1;
      if (probes === 1) return new Promise<Response>((resolve) => { finishDelayedProbe = resolve; });
      if (probes === 2) return new Response('{}', { status: 401 });
      return new Response('{"id":"user"}');
    });
    const delayed = apiClient("/auth/me");
    await apiClient("/auth/me");
    finishDelayedProbe(new Response('{}', { status: 401 }));
    await delayed;
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/v1/auth/refresh")).toHaveLength(1);
    expect(probes).toBe(4);
  });

  it.each(["/auth/login", "/api/v1/auth/logout", "/iam/users/user-1"])("never refreshes or replays mutation %s", async (endpoint) => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(apiClient(endpoint, { method: "POST" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    it.each(["/protected", "/auth/refresh", "/auth/login"])(
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
