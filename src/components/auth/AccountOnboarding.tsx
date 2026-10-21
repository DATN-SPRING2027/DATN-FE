"use client";

import Alert from "@/components/ui/alert/Alert";
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
      >
        <div className="w-full max-w-lg space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-10 w-3/4 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </main>
    );

  return (
    <main className={styles.organization}>
      <div className={styles.organizationContent}>
        <header className={styles.formHeading}>
          <p className={styles.eyebrow}>{t("onboardingEyebrow")}</p>
          <h1>
            {ui("organizationTitle")}
            <span aria-hidden="true">.</span>
          </h1>
          <p className={styles.introduction}>
            {t("onboardingDescription", { name: current.data.name })}
          </p>
        </header>

        {organizations.isLoading && (
          <div
            className="space-y-2.5"
            aria-busy="true"
            aria-label={t("onboardingChecking")}
          >
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-18 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        )}
        {organizations.isError && (
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
        {showCreateForm && (
          <OrganizationCreateForm
            disabled={create.isPending || select.isPending}
            onCreate={(input) => void createAndEnter(input)}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {isAccount && (
          <OrganizationInvitations
            enabled={isAccount}
            onCheckOrganizations={() => organizations.refetch()}
          />
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
            className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-2xs transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              className="size-3.5"
            >
              <path
                d="M6 14H3.333A1.333 1.333 0 0 1 2 12.667V3.333A1.333 1.333 0 0 1 3.333 2H6M10.667 11.333 14 8l-3.333-3.333M14 8H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("onboardingSignOut")}
          </button>
        </div>
      </div>
    </main>
  );
}
