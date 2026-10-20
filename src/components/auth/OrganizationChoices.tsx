"use client";

import { ArrowRightIcon, GroupIcon } from "@/icons";
import { useTranslations } from "next-intl";
import type { OrganizationOption } from "@/lib/queries/auth/useAccountOnboarding";

function organizationInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

export default function OrganizationChoices({
  organizations,
  isBusy,
  onSelect,
}: {
  organizations: readonly OrganizationOption[];
  isBusy: boolean;
  onSelect: (organizationId: string) => void;
}) {
  const t = useTranslations("auth");

  if (organizations.length === 0) {
    return (
      <section
        role="status"
        className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
          >
            <GroupIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("onboardingNoOrganizationTitle")}
            </h2>
            <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-400">
              {t("onboardingNoOrganization")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="organization-list-title" className="space-y-3">
      <div>
        <div>
          <h2 id="organization-list-title" className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("onboardingAvailable")}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("onboardingChooseHint")}
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {organizations.map((organization) => (
          <li key={organization.id}>
            <button
              type="button"
              disabled={isBusy}
              aria-busy={isBusy}
              onClick={() => onSelect(organization.id)}
              className="group flex min-h-18 w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-start shadow-theme-xs transition hover:border-brand-300 hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
            >
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {organizationInitials(organization.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {organization.name}
                </span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                  {t("onboardingOpenWorkspace")}
                </span>
              </span>
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
