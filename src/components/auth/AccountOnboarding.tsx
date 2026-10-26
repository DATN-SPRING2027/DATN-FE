"use client";

import Alert from "@/components/ui/alert/Alert";
import { LogOutIcon } from "@/icons";
import { useRouter } from "@/i18n/navigation";
import {
  useCurrentUserQuery,
  useLogoutMutation,
} from "@/lib/queries/auth/useAuth";
import {
  useCreateOrganizationMutation,
  useOrganizationOptionsQuery,
  useSelectOrganizationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import OrganizationChoices from "./OrganizationChoices";
import OrganizationCreateForm from "./OrganizationCreateForm";
import OrganizationInvitations from "./OrganizationInvitations";
import styles from "./auth-experience.module.css";

function userInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
      .join("") || "U"
  );
}

export default function AccountOnboarding() {
  const t = useTranslations("auth");
  const ui = useTranslations("authExperience");
  const router = useRouter();
  const current = useCurrentUserQuery();
  const isAccount = current.data?.context === "ACCOUNT";
  const canSelectOrganization = Boolean(current.data);
  const organizations = useOrganizationOptionsQuery(canSelectOrganization);
  const create = useCreateOrganizationMutation();
  const select = useSelectOrganizationMutation();
  const logout = useLogoutMutation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (new URLSearchParams(window.location.search).get("mode") === "create") {
        setShowCreateForm(true);
      }
    }
  }, []);

  useEffect(() => {
    if (current.isError) router.replace("/signin");
  }, [current.data, current.isError, router]);

  async function selectAndEnter(id: string) {
    setSelectingId(id);
    try {
      await select.mutateAsync(id);
      router.replace("/dashboard");
    } catch {
      // The mutation error is shown below the organization choices.
    } finally {
      setSelectingId(null);
    }
  }

  async function createAndEnter(input: { name: string; slug: string }) {
    try {
      const result = await create.mutateAsync(input);
      await selectAndEnter(result.id);
    } catch {
      // Keep the form open and show the mutation error below it.
    }
  }

  if (!current.data)
    return (
      <main
        className={styles.pending}
        aria-busy="true"
        aria-label={t("checkingSession")}
        suppressHydrationWarning
      >
        <div className="w-full max-w-lg space-y-4" suppressHydrationWarning>
          <div
            className="h-8 w-40 motion-safe:animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
            suppressHydrationWarning
          />
          <div
            className="h-10 w-3/4 motion-safe:animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
            suppressHydrationWarning
          />
          <div
            className="h-20 motion-safe:animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            suppressHydrationWarning
          />
        </div>
      </main>
    );

  return (
    <main className={styles.organization} suppressHydrationWarning>
      <div className={styles.organizationContent} suppressHydrationWarning>
        <header className={styles.formHeading}>
          <p className={styles.eyebrow}>{t("onboardingEyebrow")}</p>
          <h1>
            {showCreateForm ? t("onboardingCreate") : ui("organizationTitle")}
            <span aria-hidden="true">.</span>
          </h1>
          <p className={styles.introduction}>
            {showCreateForm
              ? t("onboardingCreateDescription")
              : t("onboardingDescription", { name: current.data.name })}
          </p>
        </header>

        {organizations.isLoading && !showCreateForm && (
          <div
            className="space-y-2.5"
            aria-busy="true"
            aria-label={t("onboardingChecking")}
            suppressHydrationWarning
          >
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-18 motion-safe:animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
                suppressHydrationWarning
              />
            ))}
          </div>
        )}
        {organizations.isError && !showCreateForm && (
          <Alert
            variant="error"
            title={t("onboardingAccessError")}
            message={t("onboardingAccessErrorDetail")}
          />
        )}
        {(create.isError || select.isError) && (
          <Alert
            variant="error"
            title={t("onboardingActionError")}
            message={t("onboardingActionErrorDetail")}
          />
        )}

        {showCreateForm ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={create.isPending || select.isPending}
              onClick={() => setShowCreateForm(false)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-2xs transition hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="size-4 shrink-0 rtl:rotate-180"
              >
                <path
                  d="M12.6667 8H3.33333M3.33333 8L7.33333 4M3.33333 8L7.33333 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t("onboardingBackToOrganizations")}</span>
            </button>

            <OrganizationCreateForm
              disabled={create.isPending || select.isPending}
              onCreate={(input) => void createAndEnter(input)}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        ) : (
          <>
            {organizations.isSuccess && (
              <OrganizationChoices
                organizations={organizations.data}
                isBusy={select.isPending || create.isPending}
                selectingId={selectingId}
                currentOrganizationId={current.data.organizationId}
                onSelect={(id) => void selectAndEnter(id)}
                onCreate={() => setShowCreateForm(true)}
              />
            )}

            {isAccount && (
              <OrganizationInvitations
                enabled={isAccount}
                onCheckOrganizations={() => organizations.refetch()}
              />
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-200/80 pt-4 dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
            >
              {userInitials(current.data.name, current.data.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                {current.data.name}
              </p>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {current.data.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={logout.isPending}
            onClick={() =>
              void logout
                .mutateAsync()
                .then(() => router.replace("/signin"))
                .catch(() => undefined)
            }
            className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <LogOutIcon aria-hidden="true" className="size-3.5" />
            {t("onboardingSignOut")}
          </button>
        </div>
      </div>
    </main>
  );
}
