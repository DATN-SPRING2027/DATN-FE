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
  const streamUpload =
    request.method === "PUT" &&
    ((path.length === 6 &&
      path[0] === "capture" &&
      path[1] === "projects" &&
      (path[3] === "documents" || path[3] === "work-reports") &&
      path[5] === "file") ||
      (path.length === 6 &&
        path[0] === "chat" &&
        path[1] === "conversations" &&
        path[3] === "uploads" &&
        path[5] === "content"));
  return forwardBackendRequest(request, path, { streamBody: streamUpload });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
