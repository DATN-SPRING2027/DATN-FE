import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const i18nProxy = createMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse {
  // Missing access cookies must reach the layout's /auth/me -> refresh flow.
  // NestJS verifies the session; the layout hides protected content until then.
  return i18nProxy(request);
}

export const config = {
  matcher: ["/((?!api/|_next|_vercel|.*\\..*).*)"],
};
