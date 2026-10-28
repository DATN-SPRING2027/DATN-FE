// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { forwardBackendRequest } from "./forward";
import { GET, POST } from "./[...path]/route";

describe("BFF file downloads", () => {
  afterEach(() => vi.unstubAllGlobals());

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
});
