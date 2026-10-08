import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

describe("public browser logout BFF route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards the refresh cookie and relays cookie clearing independently", async () => {
    const url = "http://localhost:3000/api/v1/auth/logout";
    const request = Object.assign(
      new Request(url, {
        method: "POST",
        headers: {
          cookie: "__Secure-refresh=private; continuum_access=private",
        },
      }),
      { nextUrl: new URL(url) },
    ) as NextRequest;
    const headers = new Headers({
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    const clearAccess = "continuum_access=; Path=/; Max-Age=0; HttpOnly";
    const clearRefresh =
      "__Secure-refresh=; Path=/api/v1/auth; Max-Age=0; HttpOnly; Secure";
    headers.append("set-cookie", clearAccess);
    headers.append("set-cookie", clearRefresh);
    const backend = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "logged_out" }), {
        status: 200,
        headers,
      }),
    );

    const response = await POST(request);

    expect(backend).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    const sentHeaders = (backend.mock.calls[0][1] as RequestInit)
      .headers as Headers;
    expect(sentHeaders.get("cookie")).toContain("__Secure-refresh=private");
    expect(response.headers.getSetCookie()).toEqual([
      clearAccess,
      clearRefresh,
    ]);
    expect(await response.json()).toEqual({ status: "logged_out" });
  });
});
