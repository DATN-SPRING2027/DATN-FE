"use client";

import BrandLogo from "@/components/common/BrandLogo";
import Alert from "@/components/ui/alert/Alert";
import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
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

export default function AccountOnboarding() {
  const t = useTranslations("auth");
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
      router.replace("/");
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
        className="flex min-h-screen w-full flex-1 items-center justify-center bg-white px-6 dark:bg-gray-900 lg:w-1/2"
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
    <main className="flex min-h-screen w-full flex-1 flex-col overflow-y-auto bg-white px-6 py-8 dark:bg-gray-900 sm:px-10 lg:w-1/2 lg:px-12">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-7 py-4">
        <header>
          <Link href="/" aria-label="Continuum AI home" className="inline-flex h-8">
            <BrandLogo className="h-full" priority />
          </Link>
          <p className="mt-10 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            {t("onboardingEyebrow")}
          </p>
          <h1 className="mt-3 text-title-sm font-semibold tracking-tight text-gray-900 dark:text-white sm:text-title-md">
            {t("onboardingTitle")}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-gray-600 dark:text-gray-400">
            {t("onboardingDescription", { name: current.data.name })}
          </p>
        </header>

        {organizations.isLoading && (
          <div className="space-y-3" aria-busy="true" aria-label={t("onboardingChecking")}>
            {[0, 1].map((item) => (
              <div key={item} className="h-18 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        )}
        {organizations.isError && (
          <Alert variant="error" title={t("onboardingAccessError")} message={t("onboardingAccessErrorDetail")} />
        )}
        {organizations.isSuccess && (
          <OrganizationChoices
            organizations={organizations.data}
            isBusy={select.isPending || create.isPending}
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
        {(create.isError || select.isError) && (
          <Alert variant="error" title={t("onboardingActionError")} message={t("onboardingActionErrorDetail")} />
        )}

        {isAccount && (
          <OrganizationInvitations
            enabled={isAccount}
            onCheckOrganizations={() => void organizations.refetch()}
          />
        )}

        <button
          type="button"
          disabled={logout.isPending}
          onClick={() => void logout.mutateAsync().then(() => router.replace("/signin")).catch(() => undefined)}
          className="self-start rounded-lg px-2 py-1 text-sm text-gray-500 transition hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {t("onboardingSignOut")}
        </button>
      </div>
    </main>
  );
}
