import { forwardBackendRequest } from "../forward";
import type { NextRequest } from "next/server";
import {
  allowedTeamMethod,
  isTeamPath,
  teamDevelopmentEnabled,
} from "@/lib/teams-development";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  if (
    path.some(
      (segment) => segment === "." || segment === ".." || /[\\/]/.test(segment),
    )
  ) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  if (
    isTeamPath(path) &&
    (!teamDevelopmentEnabled() || !allowedTeamMethod(path, request.method))
  ) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }
  if (["auth/refresh", "auth/logout"].includes(path.join("/"))) {
    return new Response(null, { status: 404 });
  }
  return forwardBackendRequest(request, path);
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
