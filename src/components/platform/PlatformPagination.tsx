"use client";
import { useTranslations } from "next-intl";
import PlatformPageControls from "./ui/PlatformPageControls";
import styles from "./ui/jira.module.css";
type PlatformPaginationProps = Readonly<{
  alwaysShow?: boolean;
  pageSize?: number;
  returnedItems?: number;
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
  returnedItems,
  page,
  totalPages,
  totalItems,
  ariaLabel,
  onPageChange,
}: PlatformPaginationProps) {
  const t = useTranslations("platformConsole.pagination");
  if (totalPages <= 1 && !alwaysShow) return null;
  const count = returnedItems ?? pageSize ?? 0;
  return (
    <nav aria-label={ariaLabel} className={styles.pagination}>
      <div className="flex flex-wrap items-center gap-3">
        {pageSize ? (
          <p aria-live="polite">
            {t("range", {
              from: totalItems && count ? (page - 1) * pageSize + 1 : 0,
              to: count
                ? Math.min((page - 1) * pageSize + count, totalItems)
                : 0,
              total: totalItems,
            })}
          </p>
        ) : (
          <p aria-live="polite">
            {t("summary", {
              page,
              totalPages: Math.max(1, totalPages),
              totalItems,
            })}
          </p>
        )}
      </div>
      <PlatformPageControls
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </nav>
  );
}
