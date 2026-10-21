import { Link } from "@/i18n/navigation";

interface BreadcrumbProps {
  pageTitle: string;
  homeLabel?: string;
  items?: readonly { label: string; href?: string }[];
  showTitle?: boolean;
  breadcrumbLabel?: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  homeLabel = "Home",
  items = [],
  showTitle = true,
  breadcrumbLabel,
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${showTitle ? "mb-6 justify-between" : "mb-2 justify-end"}`}>
      {showTitle && (
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {pageTitle}
        </h2>
      )}
      <nav aria-label={breadcrumbLabel}>
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
              href="/"
            >
              {homeLabel}
              <svg
                className="stroke-current rtl:rotate-180"
                width="17"
                height="16"
                viewBox="0 0 17 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                  stroke=""
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
          {items.map((item, index) => (
            <li
              key={`${item.href ?? "current"}:${item.label}:${index}`}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
            >
              {item.href ? (
                <Link href={item.href} className="hover:text-brand-600 dark:hover:text-brand-400">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              <span aria-hidden="true" className="rtl:rotate-180">
                ›
              </span>
            </li>
          ))}
          <li
            aria-current="page"
            className="text-sm text-gray-800 dark:text-white/90"
          >
            {pageTitle}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
