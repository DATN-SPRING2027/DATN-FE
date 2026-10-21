"use client";
import type { ReactNode } from "react";
export default function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-6 dark:border-gray-800">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-gray-100">
            {title}
          </h1>
          {badge}
        </div>
        {description && <p className="sr-only">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
