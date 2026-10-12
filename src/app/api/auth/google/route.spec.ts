import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";
import { forwardBackendRequest } from "@/app/api/backend/forward";

vi.mock("@/app/api/backend/forward", () => ({
  forwardBackendRequest: vi.fn(),
}));

function request(url = "http://localhost:5000/api/auth/google"): NextRequest {
  return Object.assign(new Request(url), {
    nextUrl: new URL(url),
  }) as NextRequest;
}

describe("Google OAuth start route", () => {
  afterEach(() => vi.resetAllMocks());

  it("keeps the provider redirect in the browser and forwards the state cookie", async () => {
    const responseHeaders = new Headers({
      location: "https://accounts.google.com/o/oauth2/v2/auth?state=opaque",
      "set-cookie":
        "__Host-continuum-google-oauth-state=sealed; Path=/; HttpOnly; SameSite=Lax; Secure",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    });
    vi.mocked(forwardBackendRequest).mockResolvedValue(
      new Response(null, { status: 302, headers: responseHeaders }),
    );

    const response = await GET(
      request(
        "http://localhost:5000/api/auth/google?organizationId=651a2b3c4d5e6f7a8b9c0d1f",
      ),
    );

    expect(forwardBackendRequest).toHaveBeenCalledWith(
      expect.anything(),
      ["auth", "google"],
      { redirect: "manual" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns an OAuth configuration failure to the sign-in screen", async () => {
    vi.mocked(forwardBackendRequest).mockResolvedValue(
      Response.json({ code: "SERVICE_UNAVAILABLE" }, { status: 503 }),
    );
    const response = await GET(request());
    expect(response.status).toBe(302);
    expect(
      new URL(
        response.headers.get("location")!,
        "http://localhost:5000",
      ).searchParams.get("google"),
    ).toBe("failed");
  });
});
