import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./[...path]/route";
import type { NextRequest } from "next/server";

function request(method: string, path: string, cookie?: string): NextRequest {
  return Object.assign(new Request(`http://localhost:3000/api/backend/${path}`, {
    method,
    headers: cookie ? { cookie } : undefined,
  }), { nextUrl: new URL(`http://localhost:3000/api/backend/${path}`) }) as NextRequest;
}

describe("auth BFF cookie journey", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes the login HttpOnly cookie to the browser without a token body", async () => {
    const backend = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ user: { id: "user-1", email: "a@example.com" } }),
      { status: 200, headers: {
        "content-type": "application/json",
        "set-cookie": "continuum_access=private; Path=/; HttpOnly; SameSite=Strict",
      } },
    ));

    const response = await POST(request("POST", "auth/login"), { params: Promise.resolve({ path: ["auth", "login"] }) });

    expect(backend).toHaveBeenCalledWith("http://localhost:3001/api/v1/auth/login", expect.objectContaining({ method: "POST" }));
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.json()).toEqual({ user: { id: "user-1", email: "a@example.com" } });
  });

  it("forwards the cookie on /auth/me and clears it on logout", async () => {
    const backend = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "logged_out" }), {
        status: 200,
        headers: { "set-cookie": "continuum_access=; Path=/; Max-Age=0; HttpOnly" },
      }));

    await GET(request("GET", "auth/me", "continuum_access=private"), { params: Promise.resolve({ path: ["auth", "me"] }) });
    const logout = await POST(request("POST", "auth/logout", "continuum_access=private"), { params: Promise.resolve({ path: ["auth", "logout"] }) });

    expect(((backend.mock.calls[0][1] as RequestInit).headers as Headers).get("cookie")).toBe("continuum_access=private");
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
