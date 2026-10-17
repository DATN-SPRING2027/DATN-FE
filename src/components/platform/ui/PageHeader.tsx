"use client";

import { ReactNode } from "react";

type PageHeaderProps = {
  category?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
};

export default function PageHeader({
  category = "Platform",
  title,
  description,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-gray-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-gray-800">
      <div className="min-w-0 flex-1 space-y-1">
        {category && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>{category}</span>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-700 dark:text-gray-300">{title}</span>
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="max-w-3xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2.5 pt-1">
          {actions}
        </div>
      )}
    </div>
  );
}
