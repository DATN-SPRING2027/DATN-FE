"use client";
import { useTranslations } from "next-intl";
import styles from "./jira.module.css";
export default function PlatformPageControls({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("platformConsole.pagination");
  const last = Math.max(1, totalPages);
  const pages = [
    ...new Set([
      1,
      ...Array.from({ length: 5 }, (_, i) => page + i - 2).filter(
        (p) => p > 1 && p < last,
      ),
      last,
    ]),
  ].sort((a, b) => a - b);
  return (
    <div className={styles.paginationControls}>
      <button
        type="button"
        aria-label={t("previous")}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span className="rtl:rotate-180" aria-hidden="true">
          ‹
        </span>
      </button>
      {pages.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && p - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <button
            type="button"
            aria-current={page === p ? "page" : undefined}
            disabled={disabled}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        type="button"
        aria-label={t("next")}
        disabled={disabled || page >= last}
        onClick={() => onPageChange(page + 1)}
      >
        <span className="rtl:rotate-180" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  );
}
