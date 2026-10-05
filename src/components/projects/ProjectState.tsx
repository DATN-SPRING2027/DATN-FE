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
      <div role="status" aria-live="polite" className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("loading")}
        </p>
        <div
          aria-hidden="true"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-52 rounded-xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>
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
