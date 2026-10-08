import { Link } from "@/i18n/navigation";

interface BreadcrumbProps {
  pageTitle: string;
  homeLabel?: string;
  items?: readonly { label: string; href: string }[];
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  homeLabel = "Home",
  items = [],
}) => {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        {pageTitle}
      </h2>
      <nav>
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
          {items.map((item) => (
            <li
              key={item.href}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
            >
              <Link
                href={item.href}
                className="hover:text-brand-600 dark:hover:text-brand-400"
              >
                {item.label}
              </Link>
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
