import { forwardBackendRequest } from "@/app/api/backend/forward";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface OrganizationOption {
  id: string;
  name: string;
}

type CallbackStatus = "started" | "succeeded" | "failed" | "skipped";

function logCallbackStage(input: {
  requestId: string;
  stage: string;
  status: CallbackStatus;
  httpStatus?: number;
  errorCode?: string;
}): void {
  const line = JSON.stringify({
    event: "google_oauth.callback",
    requestId: input.requestId,
    stage: input.stage,
    status: input.status,
    ...(input.httpStatus === undefined ? {} : { httpStatus: input.httpStatus }),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  });

  if (input.status === "failed") {
    console.warn(line);
    return;
  }
  console.info(line);
}

function readOrganizationOptions(value: unknown): OrganizationOption[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 50) {
    return null;
  }
  const options = value.filter(
    (entry): entry is OrganizationOption =>
      typeof entry === "object" &&
      entry !== null &&
      "id" in entry &&
      typeof entry.id === "string" &&
      /^[a-f\d]{24}$/i.test(entry.id) &&
      "name" in entry &&
      typeof entry.name === "string" &&
      entry.name.length > 0 &&
      entry.name.length <= 120,
  );
  return options.length === value.length ? options : null;
}

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  cookies: string[],
  requestId: string,
): NextResponse {
  const response = NextResponse.redirect(new URL(pathname, request.url), 302);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-request-id", requestId);
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  logCallbackStage({
    requestId,
    stage: "bff_callback_received",
    status: "started",
  });

  let backend: Response;
  try {
    backend = await forwardBackendRequest(
      request,
      ["auth", "google", "callback"],
      { redirect: "manual", requestId },
    );
  } catch {
    logCallbackStage({
      requestId,
      stage: "bff_backend_forward",
      status: "failed",
      errorCode: "IAM_CALLBACK_UNREACHABLE",
    });
    throw new Error("Google callback backend request failed.");
  }

  backend.headers.set("x-request-id", requestId);
  const cookies = backend.headers.getSetCookie();
  const location = backend.headers.get("location");
  const callbackFailed =
    backend.status >= 500 ||
    (backend.status === 302 && location === "/signin?google=failed");
  const isSuccessfulLoginRedirect =
    location === "/" || location === "/select-organization";
  logCallbackStage({
    requestId,
    stage: "bff_backend_response",
    status: callbackFailed ? "failed" : "succeeded",
    httpStatus: backend.status,
    ...(callbackFailed
      ? {
          errorCode:
            backend.status >= 500
              ? "IAM_CALLBACK_HTTP_ERROR"
              : "GOOGLE_CALLBACK_FAILED",
        }
      : {}),
  });

  if (backend.status === 302 && isSuccessfulLoginRedirect) {
    const cookieNames = cookies.map((cookie) =>
      cookie.slice(0, cookie.indexOf("=")).trim().toLowerCase(),
    );
    const hasSessionCookies = ["access", "refresh", "csrf"].every((part) =>
      cookieNames.some((name) => name.includes(part)),
    );
    logCallbackStage({
      requestId,
      stage: "bff_session_cookie_relay",
      status: hasSessionCookies ? "succeeded" : "failed",
      ...(!hasSessionCookies ? { errorCode: "SESSION_COOKIE_MISSING" } : {}),
    });
  } else {
    logCallbackStage({
      requestId,
      stage: "bff_session_cookie_relay",
      status: "skipped",
    });
  }

  if (backend.status !== 403 && backend.status !== 409) return backend;

  let payload: { code?: unknown; details?: { organizations?: unknown } } = {};
  try {
    payload = await backend.clone().json();
  } catch {
    return redirectWithCookies(
      request,
      "/signin?google=failed",
      cookies,
      requestId,
    );
  }

  if (
    backend.status === 409 &&
    payload.code === "ORGANIZATION_SELECTION_REQUIRED"
  ) {
    const organizations = readOrganizationOptions(
      payload.details?.organizations,
    );
    if (organizations) {
      const encodedOptions = Buffer.from(
        JSON.stringify(organizations),
        "utf8",
      ).toString("base64url");
      if (encodedOptions.length <= 6000) {
        return redirectWithCookies(
          request,
          `/select-organization?options=${encodedOptions}`,
          cookies,
          requestId,
        );
      }
    }
  }

  if (
    backend.status === 403 &&
    payload.code === "ORGANIZATION_ACCESS_REQUIRED"
  ) {
    return redirectWithCookies(
      request,
      "/signin?google=organization-required",
      cookies,
      requestId,
    );
  }

  return redirectWithCookies(
    request,
    "/signin?google=failed",
    cookies,
    requestId,
  );
}
