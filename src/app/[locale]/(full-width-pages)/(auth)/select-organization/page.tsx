import type { Metadata } from "next";
import AccountOnboarding from "@/components/auth/AccountOnboarding";
import { ArrowRightIcon, GroupIcon } from "@/icons";
import { Link } from "@/i18n/navigation";
import { parseGoogleOrganizationOptions } from "@/lib/auth/google-organization-options";
import styles from "@/components/auth/auth-experience.module.css";
import { getTranslations } from "next-intl/server";

function organizationInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

export const metadata: Metadata = {
  title: "Choose an organization | Continuum AI",
};

export default async function SelectOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ options?: string | string[] }>;
}) {
  const query = await searchParams;
  const organizations = parseGoogleOrganizationOptions(query.options);
  if (!organizations) return <AccountOnboarding />;

  const t = await getTranslations("auth");
  return (
    <main className={styles.organization}>
      <div className={styles.organizationContent}>
        <header className={styles.formHeading}>
          <p className={styles.eyebrow}>{t("onboardingEyebrow")}</p>
          <h1>
            {t("googleSelectOrganization")}
            <span aria-hidden="true">.</span>
          </h1>
          <p className={styles.introduction}>
            {t("googleSelectOrganizationDescription")}
          </p>
        </header>

        <form action="/api/auth/google" method="get" className="space-y-3">
          <ul className="space-y-3">
            {organizations.map(({ id, name }) => (
              <li key={id}>
                <button
                  type="submit"
                  name="organizationId"
                  value={id}
                  className="group flex min-h-18 w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-start shadow-theme-xs transition hover:border-brand-300 hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {organizationInitials(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {name}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {t("onboardingOpenWorkspace")}
                    </span>
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </button>
              </li>
            ))}
          </ul>
        </form>

        <p className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-5 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
          <GroupIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400"
          />
          <span>{t("organizationDataScopeNotice")}</span>
        </p>

        <Link
          href="/signin"
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 rotate-180 rtl:rotate-0"
          />
          {t("backToSignIn")}
        </Link>
      </div>
    </main>
  );
}
