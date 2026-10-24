"use client";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import Button from "@/components/ui/button/Button";
import { TeamRecoveryRequiredError } from "@/lib/queries/teams/team.contract";

export function ambiguousTeamFailure(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500;
}
export default function TeamState({
  error,
  retry,
  loading = false,
}: {
  error?: unknown;
  retry?: () => void;
  loading?: boolean;
}) {
  const t = useTranslations("teamFoundation");
  if (loading)
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="space-y-4 text-sm text-gray-600 dark:text-gray-400"
      >
        <p>{t("loading")}</p>
        <div
          aria-hidden="true"
          className="h-24 rounded-lg bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
        />
      </div>
    );
  const codes: Record<string, string> = {
    TEAM_POLICY_NOT_READY: "policy",
    RETRY_LATER: "retryLater",
    TEAM_ARCHIVED: "archivedError",
    AUTH_CSRF_INVALID: "csrf",
  };
  const statuses: Record<number, string> = {
    401: "unauthorized",
    403: "denied",
    404: "notFound",
    409: "conflict",
    412: "stale",
    428: "stale",
    422: "validation",
    503: "policy",
  };
  const message =
    error instanceof TeamRecoveryRequiredError
      ? "reconcile"
      : error instanceof ApiError
        ? (codes[error.code ?? ""] ?? statuses[error.status] ?? "failure")
        : "network";
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-error-200 p-4 text-sm text-error-700 dark:border-error-800 dark:text-error-400"
    >
      <p>{t(message)}</p>
      {retry && (
        <Button type="button" variant="outline" onClick={retry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
