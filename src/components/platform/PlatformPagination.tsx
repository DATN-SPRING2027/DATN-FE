"use client";

import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";

type PlatformPaginationProps = Readonly<{
  page: number;
  totalPages: number;
  totalItems: number;
  ariaLabel: string;
  onPageChange: (page: number) => void;
}>;

export default function PlatformPagination({
  page,
  totalPages,
  totalItems,
  ariaLabel,
  onPageChange,
}: PlatformPaginationProps) {
  const t = useTranslations("platformConsole.pagination");
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
        {t("summary", { page, totalPages, totalItems })}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t("previous")}</Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>{t("next")}</Button>
      </div>
    </nav>
  );
}
