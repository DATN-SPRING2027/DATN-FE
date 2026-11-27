// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { forwardBackendRequest } from "./forward";
import { GET, POST } from "./[...path]/route";

describe("BFF file downloads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams generic mutation bodies through the BFF without buffering them in memory", async () => {
    const payload = JSON.stringify({ note: "a normal JSON mutation" });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const path = ["iam", "users", "user-1"];
    const request = new NextRequest(
      `http://localhost:3000/api/backend/${path.join("/")}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      },
    );
    const arrayBuffer = vi.spyOn(request, "arrayBuffer");

    const response = await POST(request, { params: Promise.resolve({ path }) });

    const forwarded = fetchMock.mock.calls[0]?.[1] as RequestInit & { duplex?: string };
    expect(response.status).toBe(200);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(forwarded.body).toBe(request.body);
    expect(forwarded.duplex).toBe("half");
    expect(await new Response(forwarded.body).text()).toBe(payload);
  });

  it("preserves the attachment filename and PDF bytes from the backend", async () => {
    const disposition = "attachment; filename*=UTF-8''project-design.pdf";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("%PDF-1.4", {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": disposition,
            "cache-control": "no-store",
          },
        }),
      ),
    );
    const response = await forwardBackendRequest(
      new NextRequest(
        "http://localhost:3000/api/backend/capture/projects/project/documents/document/file",
      ),
      ["capture", "projects", "project", "documents", "document", "file"],
    );

    expect(response.headers.get("content-disposition")).toBe(disposition);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.text()).toBe("%PDF-1.4");
  });
});

describe("BFF Platform rate-limit route responses", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["GET", "POST"] as const)(
    "preserves status, body and rate-limit metadata for %s requests",
    async (method) => {
      const body = {
        code: "TOO_MANY_REQUESTS",
        message: "Platform request limit exceeded.",
        requestId: "rate-limit-test",
      };
      const fetchMock = vi.fn().mockResolvedValue(
        Response.json(body, {
          status: 429,
          headers: {
            "Retry-After": "45",
            "X-RateLimit-Limit": "120",
            "X-RateLimit-Reset": "1792972860",
            "Cache-Control": "no-store",
            "X-Upstream-Secret": "must-not-be-forwarded",
          },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const path = ["iam", "platform", "services"];
      const request = new NextRequest(
        `http://localhost:3000/api/backend/${path.join("/")}`,
        { method },
      );
      const route = method === "GET" ? GET : POST;
      const response = await route(request, {
        params: Promise.resolve({ path }),
      });

      expect(response.status).toBe(429);
      expect(await response.json()).toEqual(body);
      expect(response.headers.get("retry-after")).toBe("45");
      expect(response.headers.get("x-ratelimit-limit")).toBe("120");
      expect(response.headers.get("x-ratelimit-reset")).toBe("1792972860");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.has("x-upstream-secret")).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves budget headers on a successful response without inventing Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { data: [] },
          {
            headers: {
              "X-RateLimit-Limit": "120",
              "X-RateLimit-Reset": "1792972860",
            },
          },
        ),
      ),
    );
    const path = ["iam", "platform", "services"];
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/backend/${path.join("/")}`),
      { params: Promise.resolve({ path }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-limit")).toBe("120");
    expect(response.headers.get("x-ratelimit-reset")).toBe("1792972860");
    expect(response.headers.has("retry-after")).toBe(false);
  });

  it("does not fabricate rate-limit metadata when upstream omits it", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: "PLATFORM_RATE_LIMIT_UNAVAILABLE" },
            { status: 503 },
          ),
        ),
    );
    const path = ["iam", "platform", "services"];
    const response = await GET(
      new NextRequest(`http://localhost:3000/api/backend/${path.join("/")}`),
      { params: Promise.resolve({ path }) },
    );
    expect(response.status).toBe(503);
    for (const name of [
      "retry-after",
      "x-ratelimit-limit",
      "x-ratelimit-reset",
    ])
      expect(response.headers.has(name)).toBe(false);
  });
});

describe("BFF AI Chat SSE streaming", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streams text/event-stream frames with x-accel-buffering and no-store cache headers", async () => {
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: started\ndata: {"runId":"r1"}\n\n'),
        );
        controller.enqueue(
          encoder.encode('event: delta\ndata: {"text":"Hello"}\n\n'),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(sseStream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "x-accel-buffering": "no",
            "x-sag-internal": "never-leak",
          },
        }),
      ),
    );

    const path = ["ai-chat", "projects", "proj-1", "threads", "t-1", "ask"];
    const response = await POST(
      new NextRequest(`http://localhost:3000/api/backend/${path.join("/")}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "Hello?" }),
      }),
      { params: Promise.resolve({ path }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("x-sag-internal")).toBe(false);
    expect(await response.text()).toContain('event: delta\ndata: {"text":"Hello"}');
  });

  it("forwards request AbortSignal on ai-chat routes and returns structured 503 BACKEND_UNAVAILABLE on network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const path = ["ai-chat", "projects", "proj-1", "threads"];
    const req = new NextRequest(
      `http://localhost:3000/api/backend/${path.join("/")}`,
    );
    const response = await GET(req, { params: Promise.resolve({ path }) });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/ai-chat/projects/proj-1/threads"),
      expect.objectContaining({ signal: req.signal }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      code: "BACKEND_UNAVAILABLE",
      message: "AI Chat service is temporarily unavailable.",
    });
  });

  it("returns 499 REQUEST_ABORTED without throwing unhandled ResponseAborted errors when a non-chat request is cancelled", async () => {
    const abortError = new Error("ResponseAborted");
    abortError.name = "ResponseAborted";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(abortError));

    const controller = new AbortController();
    controller.abort();
    const path = ["tasks", "projects", "proj-1", "tasks"];
    const req = new NextRequest(
      `http://localhost:3000/api/backend/${path.join("/")}`,
      { signal: controller.signal },
    );
    const response = await GET(req, { params: Promise.resolve({ path }) });

    expect(response.status).toBe(499);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      code: "REQUEST_ABORTED",
      message: "Backend request was cancelled.",
    });
  });

  it("returns structured 503 BACKEND_UNAVAILABLE with requestId when non-chat backend routes are unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new TypeError("connect ECONNREFUSED")),
    );

    const path = ["iam", "projects"];
    const req = new NextRequest(
      `http://localhost:3000/api/backend/${path.join("/")}`,
      { headers: { "x-request-id": "req-outage-1" } },
    );
    const response = await GET(req, { params: Promise.resolve({ path }) });

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      code: "BACKEND_UNAVAILABLE",
      message: "Backend service is temporarily unavailable.",
      requestId: "req-outage-1",
    });
  });

  it("returns structured 504 BACKEND_TIMEOUT when an upstream non-chat request times out", async () => {
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(timeoutError));

    const path = ["capture", "projects", "proj-1", "documents"];
    const req = new NextRequest(
      `http://localhost:3000/api/backend/${path.join("/")}`,
      { headers: { "x-request-id": "req-timeout-1" } },
    );
    const response = await GET(req, { params: Promise.resolve({ path }) });

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      code: "BACKEND_TIMEOUT",
      message: "Backend request timed out.",
      requestId: "req-timeout-1",
    });
  });

  it("relays MCP Streamable HTTP request and response headers on /api/backend/mcp", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } },
        {
          status: 200,
          headers: {
            "mcp-session-id": "sess-99",
            "mcp-protocol-version": "2025-03-26",
            allow: "POST, DELETE, OPTIONS",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/backend/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer ctm_mcp_testsecret",
        "content-type": "application/json",
        "mcp-session-id": "sess-99",
        "mcp-protocol-version": "2025-03-26",
        "last-event-id": "evt-7",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });

    const response = await POST(req, {
      params: Promise.resolve({ path: ["mcp"] }),
    });

    const forwardedHeaders = new Headers(
      (fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers,
    );
    expect(forwardedHeaders.get("authorization")).toBe(
      "Bearer ctm_mcp_testsecret",
    );
    expect(forwardedHeaders.get("mcp-session-id")).toBe("sess-99");
    expect(forwardedHeaders.get("mcp-protocol-version")).toBe("2025-03-26");
    expect(forwardedHeaders.get("last-event-id")).toBe("evt-7");

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBe("sess-99");
    expect(response.headers.get("mcp-protocol-version")).toBe("2025-03-26");
    expect(response.headers.get("allow")).toBe("POST, DELETE, OPTIONS");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns JSON-RPC 2.0 503 error envelope when /api/backend/mcp upstream fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")),
    );

    const req = new NextRequest("http://localhost:3000/api/backend/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });

    const response = await POST(req, {
      params: Promise.resolve({ path: ["mcp"] }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: "Continuum MCP backend is temporarily unavailable.",
      },
    });
  });

  it("handles 204 No Content safely with null response body and omits streamBody on empty DELETE", async () => {
    const nonNullEmptyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const fakeUpstream204 = {
      status: 204,
      body: nonNullEmptyStream,
      headers: {
        get: (name: string) =>
          name === "mcp-session-id" ? "sess-closed" : null,
        getSetCookie: () => [] as string[],
      },
    } as unknown as Response;

    const fetchMock = vi.fn().mockResolvedValueOnce(fakeUpstream204);
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/backend/mcp", {
      method: "DELETE",
      headers: {
        "mcp-session-id": "sess-closed",
        "content-length": "0",
      },
      body: new ReadableStream({
        start(c) {
          c.close();
        },
      }),
      duplex: "half",
    });

    const response = await forwardBackendRequest(req, ["mcp"]);
    const forwardedInit = fetchMock.mock.calls[0]?.[1] as RequestInit & {
      duplex?: string;
    };

    expect(forwardedInit.body).toBeUndefined();
    expect(forwardedInit.duplex).toBeUndefined();
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("mcp-session-id")).toBe("sess-closed");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("buffers POST /api/backend/mcp JSON-RPC payloads as Uint8Array without duplex and relays 401 WWW-Authenticate", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32001, message: "Authentication required." },
        },
        {
          status: 401,
          headers: {
            "www-authenticate": 'Bearer realm="continuum-mcp"',
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const req = new NextRequest("http://localhost:3000/api/backend/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload)),
      },
      body: payload,
    });

    const response = await POST(req, {
      params: Promise.resolve({ path: ["mcp"] }),
    });

    const forwardedInit = fetchMock.mock.calls[0]?.[1] as RequestInit & {
      duplex?: string;
    };
    const forwardedHeaders = new Headers(forwardedInit?.headers);

    expect(forwardedInit.body).toBeInstanceOf(Uint8Array);
    expect(forwardedInit.duplex).toBeUndefined();
    expect(forwardedHeaders.has("content-length")).toBe(false);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="continuum-mcp"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
