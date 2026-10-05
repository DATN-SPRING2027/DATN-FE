"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";

export default function ProjectState({
  error,
  retry,
}: {
  error?: unknown;
  retry?: () => void;
}) {
  const t = useTranslations("projects");
  if (!error)
    return (
      <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
        {t("loading")}
      </p>
    );
  const messages: Record<number, string> = {
    401: "unauthorized",
    403: "forbidden",
    404: "notFound",
    409: "conflict",
    422: "validation",
    429: "rateLimit",
  };
  const key =
    error instanceof ApiError
      ? (messages[error.status] ?? "failure")
      : "failure";
  return (
    <div role="alert" className="space-y-3">
      <Alert variant="error" title={t("errorTitle")} message={t(key)} />
      {retry && (
        <Button variant="outline" onClick={retry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
