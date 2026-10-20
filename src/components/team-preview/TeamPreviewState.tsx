"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";

export default function TeamPreviewState({
  state,
  onRetry,
}: {
  state: "loading" | "empty" | "denied" | "network";
  onRetry?: () => void;
}) {
  const t = useTranslations("teamPreview");
  return (
    <div
      role={state === "denied" || state === "network" ? "alert" : "status"}
      className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
    >
      <p>{t(state)}</p>
      {state === "loading" && (
        <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-11 rounded-lg bg-gray-200 dark:bg-gray-800"
            />
          ))}
        </div>
      )}
      {state === "network" && onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
