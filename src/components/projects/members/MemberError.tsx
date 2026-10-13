"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import Alert from "@/components/ui/alert/Alert";

export function isMemberActionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
export default function MemberError({
  error,
  action,
}: {
  error: unknown;
  action: "list" | "add" | "remove";
}) {
  const t = useTranslations("projectMembers");
  let key = "network";
  if (error instanceof ApiError) {
    if (error.code === "INVALID_PROJECT_MEMBER_RESPONSE")
      key = "invalidResponse";
    else if (error.status === 403) key = `${action}Denied`;
    else if (
      error.status === 409 &&
      action === "remove" &&
      error.code === "PROJECT_LEADER_MUST_BE_REVOKED_FIRST"
    )
      key = "leaderConflict";
    else
      key =
        (
          {
            401: "unauthorized",
            404: "notFound",
            409: "conflict",
            422: "validation",
            429: "rateLimit",
          } as Record<number, string>
        )[error.status] ?? "failure";
  }
  return (
    <div role="alert">
      <Alert variant="error" title={t("errorTitle")} message={t(key)} />
    </div>
  );
}
