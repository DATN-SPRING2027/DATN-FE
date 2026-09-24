import { useTranslations } from "next-intl";
import { secondaryButtonClassName } from "./work-management-ui";

type WorkItemsPaginationProps = Readonly<{
  page: number;
  totalPages: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
}>;

export default function WorkItemsPagination({
  page,
  totalPages,
  isFetching,
  onPageChange,
}: WorkItemsPaginationProps) {
  const t = useTranslations("workManagement");

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t("pagination")}
    >
      <button
        type="button"
        className={secondaryButtonClassName}
        disabled={page <= 1 || isFetching}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        {t("previousPage")}
      </button>
      <span
        className="text-sm text-gray-600 dark:text-gray-400"
        aria-live="polite"
      >
        {t("pageOf", { page, totalPages })}
      </span>
      <button
        type="button"
        className={secondaryButtonClassName}
        disabled={page >= totalPages || isFetching}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        {t("nextPage")}
      </button>
    </nav>
  );
}
