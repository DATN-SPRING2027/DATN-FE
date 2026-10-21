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

  useEffect(() => {
    if (current.isError) router.replace("/signin");
  }, [current.data, current.isError, router]);

  async function selectAndEnter(id: string) {
    try {
      await select.mutateAsync(id);
      router.replace("/dashboard");
    } catch {
      // The mutation error is shown below the organization choices.
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
            className="space-y-3"
            aria-busy="true"
            aria-label={t("onboardingChecking")}
          >
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-18 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
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
        {showCreateForm && (
          <OrganizationCreateForm
            disabled={create.isPending || select.isPending}
            onCreate={(input) => void createAndEnter(input)}
            onCancel={() => setShowCreateForm(false)}
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

        <button
          type="button"
          disabled={logout.isPending}
          onClick={() =>
            void logout
              .mutateAsync()
              .then(() => router.replace("/signin"))
              .catch(() => undefined)
          }
          className="self-start rounded-lg px-2 py-1 text-sm text-gray-500 transition hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {t("onboardingSignOut")}
        </button>
      </div>
    </main>
  );
}
