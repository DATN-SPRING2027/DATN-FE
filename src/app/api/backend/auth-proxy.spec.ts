import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./[...path]/route";
import { forwardBackendRequest } from "./forward";
import type { NextRequest } from "next/server";

function request(method: string, path: string, cookie?: string): NextRequest {
  return Object.assign(
    new Request(`http://localhost:3000/api/backend/${path}`, {
      method,
      headers: cookie ? { cookie } : undefined,
    }),
    { nextUrl: new URL(`http://localhost:3000/api/backend/${path}`) },
  ) as NextRequest;
}

describe("auth BFF cookie journey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("forwards only the trusted edge client IP on login", async () => {
    vi.stubEnv("CONTINUUM_TRUSTED_EDGE_HOPS", "1");
    const backend = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));
    const source = Object.assign(
      new Request("http://localhost:3000/api/backend/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.9, 203.0.113.7" },
      }),
      { nextUrl: new URL("http://localhost:3000/api/backend/auth/login") },
    ) as NextRequest;
    await POST(source, {
      params: Promise.resolve({ path: ["auth", "login"] }),
    });
    expect(
      ((backend.mock.calls[0][1] as RequestInit).headers as Headers).get(
        "x-forwarded-for",
      ),
    ).toBe("203.0.113.7");
  });

  it("forwards only the trusted edge client IP on Platform Operator login", async () => {
    vi.stubEnv("CONTINUUM_TRUSTED_EDGE_HOPS", "1");
    const backend = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const source = Object.assign(
      new Request("http://localhost:3000/api/backend/auth/platform/login", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.9, 203.0.113.7" },
      }),
      { nextUrl: new URL("http://localhost:3000/api/backend/auth/platform/login") },
    ) as NextRequest;
    await POST(source, { params: Promise.resolve({ path: ["auth", "platform", "login"] }) });
    expect(((backend.mock.calls[0][1] as RequestInit).headers as Headers).get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it.each(["auth/password-reset/request", "auth/password-reset/confirm"])(
    "forwards only the trusted edge client IP on %s",
    async (path) => {
      vi.stubEnv("CONTINUUM_TRUSTED_EDGE_HOPS", "1");
      const backend = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(null, { status: path.endsWith("request") ? 202 : 204 }),
        );
      const source = Object.assign(
        new Request(`http://localhost:3000/api/backend/${path}`, {
          method: "POST",
          headers: { "x-forwarded-for": "192.0.2.9, 203.0.113.7" },
        }),
        { nextUrl: new URL(`http://localhost:3000/api/backend/${path}`) },
      ) as NextRequest;
      await POST(source, {
        params: Promise.resolve({ path: path.split("/") }),
      });
      expect(
        ((backend.mock.calls[0][1] as RequestInit).headers as Headers).get(
          "x-forwarded-for",
        ),
      ).toBe("203.0.113.7");
    },
  );

  it("stops login when the configured edge did not supply a client IP", async () => {
    vi.stubEnv("CONTINUUM_TRUSTED_EDGE_HOPS", "1");
    const backend = vi.spyOn(globalThis, "fetch");
    const response = await POST(request("POST", "auth/login"), {
      params: Promise.resolve({ path: ["auth", "login"] }),
    });
    expect(response.status).toBe(503);
    expect(backend).not.toHaveBeenCalled();
  });

  it("does not silently share a source quota when production proxy trust is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONTINUUM_TRUSTED_EDGE_HOPS", "0");
    const backend = vi.spyOn(globalThis, "fetch");
    const response = await POST(request("POST", "auth/login"), {
      params: Promise.resolve({ path: ["auth", "login"] }),
    });
    expect(response.status).toBe(503);
    expect(backend).not.toHaveBeenCalled();
  });

  it("passes the login HttpOnly cookie to the browser without a token body", async () => {
    const backend = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ user: { id: "user-1", email: "a@example.com" } }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie":
              "continuum_access=private; Path=/; HttpOnly; SameSite=Strict",
          },
        },
      ),
    );

    const response = await POST(request("POST", "auth/login"), {
      params: Promise.resolve({ path: ["auth", "login"] }),
    });

    expect(backend).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.json()).toEqual({
      user: { id: "user-1", email: "a@example.com" },
    });
  });

  it("forwards the cookie on /auth/me", async () => {
    const backend = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "user-1" }), { status: 200 }),
      );

    await GET(request("GET", "auth/me", "continuum_access=private"), {
      params: Promise.resolve({ path: ["auth", "me"] }),
    });

    expect(
      ((backend.mock.calls[0][1] as RequestInit).headers as Headers).get(
        "cookie",
      ),
    ).toBe("continuum_access=private");
  });

  it("forwards If-Match and preserves conditional mutation response headers", async () => {
    const backend = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: {
          etag: '"resource:resource-1:2"',
          "idempotency-replayed": "true",
          "retry-after": "1",
        },
      }),
    );
    const source = Object.assign(
      new Request("http://localhost:3000/api/backend/resource/resource-1", {
        method: "PATCH",
        headers: {
          "if-match": '"resource:resource-1:1"',
          "idempotency-key": "operation-1",
        },
      }),
      {
        nextUrl: new URL(
          "http://localhost:3000/api/backend/resource/resource-1",
        ),
      },
    ) as NextRequest;

    const response = await forwardBackendRequest(source, [
      "resource",
      "resource-1",
    ]);
    const forwarded = backend.mock.calls[0][1] as RequestInit;

    expect((forwarded.headers as Headers).get("if-match")).toBe(
      '"resource:resource-1:1"',
    );
    expect((forwarded.headers as Headers).get("idempotency-key")).toBe(
      "operation-1",
    );
    expect(response.headers.get("etag")).toBe('"resource:resource-1:2"');
    expect(response.headers.get("idempotency-replayed")).toBe("true");
    expect(response.headers.get("retry-after")).toBe("1");
  });

  it("preserves separate Set-Cookie headers including an Expires comma", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    const access =
      "continuum_access=private; Path=/; HttpOnly; SameSite=Strict";
    const clear =
      "continuum_refresh=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly";
    headers.append("set-cookie", access);
    headers.append("set-cookie", clear);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200, headers }),
    );

    const response = await POST(request("POST", "auth/login"), {
      params: Promise.resolve({ path: ["auth", "login"] }),
    });

    expect(response.headers.getSetCookie()).toEqual([access, clear]);
  });

  it("relays all three Login cookies independently for the refresh bootstrap", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    const access = "continuum_access=private; Path=/; HttpOnly; SameSite=Lax";
    const refresh =
      "__Secure-refresh=private; Path=/api/v1/auth/refresh; Secure; HttpOnly";
    const csrf = "__Host-csrf=readable; Path=/; Secure; SameSite=Lax";
    for (const cookie of [access, refresh, csrf])
      headers.append("set-cookie", cookie);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200, headers }),
    );
    const response = await POST(request("POST", "auth/login"), {
      params: Promise.resolve({ path: ["auth", "login"] }),
    });
    expect(response.headers.getSetCookie()).toEqual([access, refresh, csrf]);
  });

  it.each(["auth/refresh", "auth/logout"])(
    "does not expose %s through the legacy generic BFF path",
    async (path) => {
      const backend = vi.spyOn(globalThis, "fetch");
      const segments = path.split("/");
      const response = await POST(request("POST", path), {
        params: Promise.resolve({ path: segments }),
      });
      expect(response.status).toBe(404);
      expect(backend).not.toHaveBeenCalled();
    },
  );
});
