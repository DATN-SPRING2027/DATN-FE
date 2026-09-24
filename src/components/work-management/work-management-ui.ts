import type { WorkItemPriority, WorkItemStatus } from "@/lib/queries/work-management/work-management.types";

export const statuses: readonly WorkItemStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
export const priorities: readonly WorkItemPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

export const controlClassName =
  "h-11 w-full rounded-lg border border-gray-300 bg-white ps-3 pe-3 text-sm text-gray-800 shadow-theme-xs outline-hidden transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";

export const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";

export function isResourceId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value.trim());
}

export function isAuthUnavailable(error: Error | null | undefined): boolean {
  return Boolean(error?.message.includes("503"));
}

export function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}
