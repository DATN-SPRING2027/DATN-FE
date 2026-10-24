import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import Button from "@/components/ui/button/Button";
import { TableSkeleton } from "@/components/platform/ui/LoadingSkeleton";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";

export const box =
  "rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900";
export const input =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-white";
export const cell = "px-5 py-3.5 text-xs text-gray-600 dark:text-gray-300";

export function isReadAccessLost(error: unknown) {
  return isAccessOrResourceUnavailableError(error);
}

export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-5 py-6 text-xs text-rose-600"
      role="alert"
    >
      <span>
        Could not load this Platform data. Check access or connection, then
        retry.
      </span>
      <Button variant="outline" size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}

export function Loading({ columns = 5 }: { columns?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="p-4">
      <span className="sr-only">Loading Platform data</span>
      <div aria-hidden="true">
        <TableSkeleton rows={4} columns={columns} />
      </div>
    </div>
  );
}

export function QueryRefreshStatus({
  hasData,
  isFetching,
  isRefetchError,
  onRetry,
}: {
  hasData: boolean;
  isFetching: boolean;
  isRefetchError: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("common");
  if (!hasData) return null;
  if (isFetching) return <UpdatingStatus>{t("updating")}</UpdatingStatus>;
  if (isRefetchError) {
    return (
      <BackgroundRefreshError retryLabel={t("retry")} onRetry={onRetry}>
        {t("updateFailed")}
      </BackgroundRefreshError>
    );
  }
  return null;
}

export function TextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs break-words text-gray-800 dark:text-gray-200">
        {value || "—"}
      </dd>
    </div>
  );
}

export function DirectoryTable({
  children,
  headers,
}: {
  children: ReactNode;
  headers: readonly string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-5 py-3 text-start">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {children}
        </tbody>
      </table>
    </div>
  );
}
