import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { type Locale, routing } from "./i18n/routing";

const i18nProxy = createMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse {
  // Missing access cookies must reach the layout's /auth/me -> refresh flow.
  // NestJS verifies the session; the layout hides protected content until then.
  // Next.js can run the proxy again for next-intl's internal locale rewrite.
  // Let that rewrite reach the route rather than redirecting /en back to /.
  const localeSegment = request.nextUrl.pathname.split("/")[1];
  if (
    routing.locales.includes(localeSegment as Locale) &&
    request.headers.get("x-next-intl-locale") === localeSegment
  ) {
    return NextResponse.next();
  }
  return i18nProxy(request);
}

export const config = {
  matcher: ["/((?!api/|_next|_vercel|.*\\..*).*)"],
};
