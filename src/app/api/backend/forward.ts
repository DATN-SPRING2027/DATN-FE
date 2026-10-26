import { getServerApiBaseUrl } from "@/lib/api-client";
import {
  buildBackendUrl,
  createForwardHeaders,
  trustedEdgeHops,
} from "@/lib/bff-proxy";
import type { NextRequest } from "next/server";
import { isTeamPath } from "@/lib/teams-development";

export async function forwardBackendRequest(
  request: NextRequest,
  path: readonly string[],
  options: {
    redirect?: RequestRedirect;
    requestId?: string;
    streamBody?: boolean;
  } = {},
): Promise<Response> {
  let headers: Headers;
  try {
    const trustedAuthMutation =
      request.method === "POST" &&
      [
        "auth/login",
        "auth/platform/login",
        "auth/password-reset/request",
        "auth/password-reset/confirm",
        "auth/registrations",
        "auth/registrations/verify",
      ].includes(path.join("/"));
    const edgeHops = trustedAuthMutation
      ? trustedEdgeHops(process.env.CONTINUUM_TRUSTED_EDGE_HOPS)
      : 0;
    if (
      trustedAuthMutation &&
      process.env.NODE_ENV === "production" &&
      edgeHops === 0
    ) {
      throw new Error("Trusted client IP is required in production");
    }
    headers = createForwardHeaders(request.headers, edgeHops);
    if (options.requestId) headers.set("x-request-id", options.requestId);
  } catch {
    return Response.json(
      {
        code: "SOURCE_IP_UNAVAILABLE",
        message: "Trusted client IP is unavailable.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const streamBody = options.streamBody && !["GET", "HEAD"].includes(request.method);
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : streamBody
      ? request.body
      : await request.arrayBuffer();
  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      buildBackendUrl(getServerApiBaseUrl(), path, request.nextUrl.search),
      {
        method: request.method,
        headers,
        body,
        ...(streamBody ? { duplex: "half" } : {}),
        cache: "no-store",
        redirect: options.redirect ?? "manual",
      },
    );
  } catch (error) {
    if (!isTeamPath(path)) throw error;
    return Response.json(
      {
        code: "RETRY_LATER",
        message: "Team service is unavailable.",
        details: {},
        requestId: headers.get("x-request-id"),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const responseHeaders = new Headers();
  const requestId = headers.get("x-request-id");
  if (requestId) responseHeaders.set("x-request-id", requestId);
  for (const name of [
    "cache-control",
    "content-type",
    "content-disposition",
    "location",
    "referrer-policy",
    "x-content-type-options",
    "x-csrf-token",
    "etag",
    "idempotency-replayed",
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-reset",
  ]) {
    const value = backendResponse.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const cookie of backendResponse.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }
  if (isTeamPath(path)) responseHeaders.set("cache-control", "no-store");
  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}
