import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const i18nProxy = createMiddleware(routing);

function isPublicPage(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (routing.locales.some((locale) => locale === segments[0])) segments.shift();
  return ["signin", "signup", "error-404"].includes(segments[0] ?? "");
}

export default function proxy(request: NextRequest): NextResponse {
  if (!isPublicPage(request.nextUrl.pathname) && !request.cookies.get("continuum_access")?.value) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  // A cookie only avoids the early redirect. The admin layout verifies /auth/me.
  return i18nProxy(request);
}

export const config = {
  matcher: ["/((?!api/|_next|_vercel|.*\\..*).*)"],
};
