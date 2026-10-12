import { forwardBackendRequest } from "@/app/api/backend/forward";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const backend = await forwardBackendRequest(request, ["auth", "google"], {
    redirect: "manual",
  });
  if (backend.status !== 503) return backend;

  const response = NextResponse.redirect(
    new URL("/signin?google=failed", request.url),
    302,
  );
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  for (const cookie of backend.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
