"use client";

import { ArrowRightIcon, GroupIcon, PlusIcon } from "@/icons";
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
  selectingId = null,
  currentOrganizationId,
  onSelect,
  onCreate,
}: {
  organizations: readonly OrganizationOption[];
  isBusy: boolean;
  selectingId?: string | null;
  currentOrganizationId?: string;
  onSelect: (organizationId: string) => void;
  onCreate: () => void;
}) {
  const t = useTranslations("auth");

  if (organizations.length === 0) {
    return (
      <section
        role="status"
        className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-gray-900/50"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-500/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20"
          >
            <GroupIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("onboardingNoOrganizationTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("onboardingNoOrganization")}
            </p>
            <button
              type="button"
              disabled={isBusy}
              onClick={onCreate}
              className="mt-3.5 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {t("onboardingCreateStartAction")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="organization-list-title" className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2
              id="organization-list-title"
              className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t("onboardingAvailable")}
            </h2>
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 tabular-nums ring-1 ring-inset ring-brand-600/15 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-400/25"
            >
              {organizations.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t("onboardingChooseHint")}
          </p>
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={onCreate}
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 self-start rounded-xl border border-gray-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
        >
          <PlusIcon aria-hidden="true" className="size-3.5" />
          {t("onboardingCreateAdditionalAction")}
        </button>
      </div>

      <ul className="space-y-2.5">
        {organizations.map((organization) => {
          const isSelectingThis = selectingId === organization.id;
          const isCurrentOrg = currentOrganizationId === organization.id;

          return (
            <li key={organization.id}>
              <button
                type="button"
                disabled={isBusy}
                aria-busy={isSelectingThis || isBusy}
                onClick={() => onSelect(organization.id)}
                className={`group flex min-h-17 w-full cursor-pointer items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-start transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait ${
                  isSelectingThis
                    ? "border-brand-400 bg-brand-25/90 shadow-theme-sm ring-2 ring-brand-500/15 dark:border-brand-500/60 dark:bg-brand-500/10"
                    : "border-gray-200/90 bg-white shadow-theme-xs hover:border-brand-300 hover:bg-brand-25/50 hover:shadow-theme-sm disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold tracking-tight text-white shadow-2xs ring-1 ring-inset ring-white/20"
                >
                  {organizationInitials(organization.name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
                      {organization.name}
                    </span>
                    {isCurrentOrg && (
                      <span
                        aria-hidden="true"
                        className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25"
                      >
                        Active
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {t("onboardingOpenWorkspace")}
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-gray-50 text-gray-500 transition-all duration-200 group-hover:border-brand-500 group-hover:bg-brand-500 group-hover:text-white dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400 dark:group-hover:border-brand-500 dark:group-hover:bg-brand-500 dark:group-hover:text-white"
                >
                  {isSelectingThis ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
