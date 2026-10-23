import { ApiError } from "@/lib/api-client";

export function platformProjectErrorKey(error: unknown) {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "AUTH_CSRF_INVALID") return "csrf";
  if (error.code === "PROJECT_CODE_CONFLICT") return "duplicate";
  switch (error.status) {
    case 401:
      return "expired";
    case 403:
      return "denied";
    case 404:
      return "missing";
    case 409:
      return "conflict";
    case 422:
      return "validation";
    default:
      return error.status >= 500 ? "service" : "network";
  }
}
