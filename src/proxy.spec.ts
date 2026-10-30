import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import proxy from "./proxy";

const localeMiddleware = vi.hoisted(() => vi.fn());
vi.mock("next-intl/middleware", () => ({ default: () => localeMiddleware }));

beforeEach(() => {
  localeMiddleware.mockReset();
  localeMiddleware.mockImplementation(() => NextResponse.next());
});

describe("route proxy", () => {
  it.each(["en", "vi"])(
    "lets an internal %s locale rewrite reach the page without restarting locale redirects",
    (locale) => {
      const response = proxy(
        new NextRequest(`http://localhost:3000/${locale}`, {
          headers: { "x-next-intl-locale": locale },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(localeMiddleware).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/en", undefined],
    ["/vi", undefined],
    ["/en", "vi"],
    ["/de", "de"],
    ["/", "en"],
    ["/", "vi"],
  ])(
    "keeps normal locale handling for %s with locale header %s",
    (pathname, locale) => {
      proxy(
        new NextRequest(`http://localhost:3000${pathname}`, {
          headers: locale ? { "x-next-intl-locale": locale } : {},
        }),
      );
      expect(localeMiddleware).toHaveBeenCalledOnce();
    },
  );

  it("allows a dashboard request without an access cookie to reach server-verified session recovery", () => {
    const response = proxy(new NextRequest("http://localhost:3000/users"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows sign-in and lets the authenticated layout verify a present cookie", () => {
    const signIn = proxy(new NextRequest("http://localhost:3000/signin"));
    const localizedSignIn = proxy(
      new NextRequest("http://localhost:3000/en/signin"),
    );
    const localizedViSignIn = proxy(
      new NextRequest("http://localhost:3000/vi/signin"),
    );
    const cookie = proxy(
      new NextRequest("http://localhost:3000/users", {
        headers: { cookie: "continuum_access=present" },
      }),
    );
    expect(signIn.status).toBe(200);
    expect(localizedSignIn.status).toBe(200);
    expect(localizedViSignIn.status).toBe(200);
    expect(cookie.status).toBe(200);
  });
});
