import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import proxy from "./proxy";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

describe("route proxy", () => {
  it("redirects an anonymous dashboard request before rendering", () => {
    const response = proxy(new NextRequest("http://localhost:3000/users"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/signin");
  });

  it("allows sign-in and lets the authenticated layout verify a present cookie", () => {
    const signIn = proxy(new NextRequest("http://localhost:3000/signin"));
    const localizedSignIn = proxy(new NextRequest("http://localhost:3000/en/signin"));
    const cookie = proxy(new NextRequest("http://localhost:3000/users", {
      headers: { cookie: "continuum_access=present" },
    }));
    expect(signIn.status).toBe(200);
    expect(localizedSignIn.status).toBe(200);
    expect(cookie.status).toBe(200);
  });
});
