import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";
import { forwardBackendRequest } from "@/app/api/backend/forward";

vi.mock("@/app/api/backend/forward", () => ({
  forwardBackendRequest: vi.fn(),
}));

function request(
  url = "http://localhost:5000/api/auth/google/callback?code=auth-code&state=state",
): NextRequest {
  return Object.assign(new Request(url), {
    nextUrl: new URL(url),
  }) as NextRequest;
}

describe("Google OAuth callback BFF route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("forwards the callback without following the backend app redirect", async () => {
    const headers = new Headers({ location: "/", "cache-control": "no-store" });
    headers.append("set-cookie", "continuum_access=session; Path=/; HttpOnly");
    headers.append("set-cookie", "__Secure-refresh=refresh; Path=/; Secure");
    headers.append("set-cookie", "__Host-csrf=csrf; Path=/; Secure");
    vi.mocked(forwardBackendRequest).mockResolvedValue(
      new Response(null, { status: 302, headers }),
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await GET(request());
    const requestId = vi.mocked(forwardBackendRequest).mock.calls[0]?.[2]
      ?.requestId;

    expect(forwardBackendRequest).toHaveBeenCalledWith(
      expect.anything(),
      ["auth", "google", "callback"],
      {
        redirect: "manual",
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      },
    );
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toContain(
      "continuum_access=session",
    );
    const logLines = info.mock.calls.map(([line]) => String(line)).join("\n");
    expect(logLines).toContain('"stage":"bff_backend_response"');
    expect(logLines).toContain('"stage":"bff_session_cookie_relay"');
    expect(logLines).toContain('"status":"succeeded"');
    expect(logLines).not.toContain("auth-code");
    expect(logLines).not.toContain("state=state");
    expect(logLines).not.toContain("refresh; Path");
    expect(logLines).toContain(requestId);
  });

  it("reports a missing session cookie when the backend redirects as if login succeeded", async () => {
    vi.mocked(forwardBackendRequest).mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "/" } }),
    );
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await GET(request());

    const events = warning.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(events).toContainEqual(
      expect.objectContaining({
        event: "google_oauth.callback",
        stage: "bff_session_cookie_relay",
        status: "failed",
        errorCode: "SESSION_COOKIE_MISSING",
      }),
    );
  });

  it("redirects a multi-organization identity to an encoded selection page", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append(
      "set-cookie",
      "__Host-continuum-google-oauth-state=; Max-Age=0; Path=/; Secure",
    );
    vi.mocked(forwardBackendRequest).mockResolvedValue(
      Response.json(
        {
          code: "ORGANIZATION_SELECTION_REQUIRED",
          details: {
            organizations: [
              { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Alpha" },
              { id: "651a2b3c4d5e6f7a8b9c0d20", name: "Beta" },
            ],
          },
        },
        { status: 409, headers },
      ),
    );

    const response = await GET(request());
    const location = new URL(
      response.headers.get("location")!,
      "http://localhost:5000",
    );
    expect(location.pathname).toBe("/select-organization");
    expect(
      JSON.parse(
        Buffer.from(
          location.searchParams.get("options")!,
          "base64url",
        ).toString("utf8"),
      ),
    ).toHaveLength(2);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("routes users without membership back to sign-in with a clear message key", async () => {
    vi.mocked(forwardBackendRequest).mockResolvedValue(
      Response.json({ code: "ORGANIZATION_ACCESS_REQUIRED" }, { status: 403 }),
    );
    const response = await GET(request());
    expect(
      new URL(response.headers.get("location")!, "http://localhost:5000")
        .pathname,
    ).toBe("/signin");
    expect(
      new URL(
        response.headers.get("location")!,
        "http://localhost:5000",
      ).searchParams.get("google"),
    ).toBe("organization-required");
  });
});
