import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

function refreshRequest(): NextRequest {
  const url = "http://localhost:3000/api/v1/auth/refresh";
  return Object.assign(
    new Request(url, {
      method: "POST",
      headers: {
        cookie: "__Host-csrf=csrf-value; __Secure-refresh=private",
        "x-csrf-token": "csrf-value",
      },
    }),
    { nextUrl: new URL(url) },
  ) as NextRequest;
}

describe("public browser refresh BFF route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards Cookie and X-CSRF-Token and preserves separate Set-Cookie fields", async () => {
    const headers = new Headers({
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-csrf-token": "rotated-csrf",
    });
    const access = "continuum_access=private; Path=/; HttpOnly; SameSite=Lax";
    const refresh =
      "__Secure-refresh=private; Path=/api/v1/auth; SameSite=Lax; Secure; HttpOnly";
    headers.append("set-cookie", access);
    headers.append("set-cookie", refresh);
    const backend = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "refreshed" }), {
        status: 200,
        headers,
      }),
    );

    const response = await POST(refreshRequest());

    expect(backend).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST", cache: "no-store", redirect: "manual" }),
    );
    const sentHeaders = (backend.mock.calls[0][1] as RequestInit)
      .headers as Headers;
    expect(sentHeaders.get("cookie")).toContain("__Secure-refresh=");
    expect(sentHeaders.get("x-csrf-token")).toBe("csrf-value");
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([access, refresh]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-csrf-token")).toBe("rotated-csrf");
    expect(await response.json()).toEqual({ status: "refreshed" });
  });

  it("relays an error status and does not invent cookies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "AUTH_CSRF_INVALID" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await POST(refreshRequest());
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await response.json()).toEqual({ code: "AUTH_CSRF_INVALID" });
  });

  it("preserves redirects instead of following them and losing auth headers", async () => {
    const headers = new Headers({
      location: "/signin",
      "x-csrf-token": "rotated-csrf",
    });
    headers.append("set-cookie", "continuum_access=; Path=/; Max-Age=0; HttpOnly");
    headers.append("set-cookie", "continuum_refresh=; Path=/api/v1/auth; Max-Age=0; HttpOnly; SameSite=Lax");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 302, headers }));

    const response = await POST(refreshRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/signin");
    expect(response.headers.get("x-csrf-token")).toBe("rotated-csrf");
    expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
  });
});
