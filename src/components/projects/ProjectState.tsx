"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";

export default function ProjectState({
  error,
  retry,
  variant = "grid",
}: {
  error?: unknown;
  retry?: () => void;
  variant?: "grid" | "detail";
}) {
  const t = useTranslations("projects");
  if (!error)
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        {/* Sleek Enterprise Status Pill with Dual-Ring Orbital Spinner */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-brand-100 bg-brand-50/70 px-3.5 py-1.5 text-xs font-medium text-brand-700 shadow-theme-xs dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
          <span className="relative flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full border-2 border-brand-200 dark:border-brand-400/25" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-600 border-r-brand-500 dark:border-t-brand-300 dark:border-r-brand-400" />
          </span>
          <span>{t("loading")}</span>
        </div>

        {variant === "detail" ? (
          <div aria-hidden="true" className="space-y-5">
            {/* Project Detail Header & Tab Bar Shimmer */}
            <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="continuum-shimmer h-28 w-full opacity-70" />
              <div className="space-y-4 px-5 pb-4 pt-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="continuum-shimmer h-12 w-12 rounded-2xl" />
                    <div className="space-y-2">
                      <div className="continuum-shimmer h-5 w-44 rounded-lg" />
                      <div className="continuum-shimmer h-3.5 w-28 rounded-md" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="continuum-shimmer h-8 w-24 rounded-xl" />
                    <div className="continuum-shimmer h-8 w-28 rounded-xl" />
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <div className="continuum-shimmer h-7 w-24 rounded-lg" />
                  <div className="continuum-shimmer h-7 w-32 rounded-lg" />
                  <div className="continuum-shimmer h-7 w-20 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Project Detail 2-Column Content Shimmer */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
                <div className="continuum-shimmer h-4 w-36 rounded-md" />
                <div className="space-y-2.5">
                  <div className="continuum-shimmer h-3.5 w-full rounded-md" />
                  <div className="continuum-shimmer h-3.5 w-11/12 rounded-md" />
                  <div className="continuum-shimmer h-3.5 w-3/4 rounded-md" />
                </div>
              </div>
              <div className="space-y-3.5 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="continuum-shimmer h-4 w-28 rounded-md" />
                <div className="continuum-shimmer h-10 w-full rounded-xl" />
                <div className="continuum-shimmer h-10 w-full rounded-xl" />
              </div>
            </div>
          </div>
        ) : (
          /* Realistic 3-Card B2B Shimmer Grid matching ProjectCard anatomy */
          <div
            aria-hidden="true"
            className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="continuum-shimmer h-10 w-10 shrink-0 rounded-xl" />
                      <div className="space-y-2">
                        <div className="continuum-shimmer h-4 w-32 rounded-md" />
                        <div className="continuum-shimmer h-3 w-16 rounded-md" />
                      </div>
                    </div>
                    <div className="continuum-shimmer h-6 w-16 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="continuum-shimmer h-3 w-full rounded-md" />
                    <div className="continuum-shimmer h-3 w-4/5 rounded-md" />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3.5 dark:border-gray-800">
                  <div className="flex items-center -space-x-1.5">
                    <div className="continuum-shimmer h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-900" />
                    <div className="continuum-shimmer h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-900" />
                    <div className="continuum-shimmer h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-900" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="continuum-shimmer h-7 w-18 rounded-lg" />
                    <div className="continuum-shimmer h-7 w-22 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
