"use client";

import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";

type PlatformPaginationProps = Readonly<{
  alwaysShow?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  page: number;
  totalPages: number;
  totalItems: number;
  ariaLabel: string;
  onPageChange: (page: number) => void;
}>;

export default function PlatformPagination({
  alwaysShow = false,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  totalItems,
  ariaLabel,
  onPageChange,
}: PlatformPaginationProps) {
  const t = useTranslations("platformConsole.pagination");
  if (totalPages <= 1 && !alwaysShow) return null;

  if (onPageSizeChange && pageSize)
    return (
      <nav
        aria-label={ariaLabel}
        className="flex flex-wrap items-center justify-between gap-4 px-1 py-3 text-sm text-gray-600 dark:text-gray-400"
      >
        <label className="flex items-center gap-3">
          {t("showBy")}
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded border border-gray-200 bg-transparent px-2 text-gray-950 dark:border-gray-700 dark:text-white"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t("previous")}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="grid size-9 place-items-center rounded disabled:invisible"
          >
            ‹
          </button>
          <span
            aria-current="page"
            className="grid size-9 place-items-center rounded border border-gray-200 text-gray-950 dark:border-gray-700 dark:text-white"
          >
            {page}
          </span>
          <span aria-live="polite">/ {Math.max(1, totalPages)}</span>
          <button
            type="button"
            aria-label={t("next")}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="grid size-9 place-items-center rounded text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </nav>
    );
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800"
    >
      <p
        className="text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        {t("summary", {
          page,
          totalPages: Math.max(1, totalPages),
          totalItems,
        })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("previous")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
        </Button>
      </div>
    </nav>
  );
}
