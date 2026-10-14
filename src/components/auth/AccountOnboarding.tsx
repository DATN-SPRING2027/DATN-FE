"use client";

import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
import {
  useMyOrganizationInvitationsQuery,
  useCreateOrganizationMutation,
  useOrganizationOptionsQuery,
  useSelectOrganizationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";

export default function AccountOnboarding() {
  const t = useTranslations("auth");
  const router = useRouter();
  const current = useCurrentUserQuery();
  const organizations = useOrganizationOptionsQuery(current.data?.context === "ACCOUNT");
  const invitations = useMyOrganizationInvitationsQuery(current.data?.context === "ACCOUNT");
  const create = useCreateOrganizationMutation();
  const select = useSelectOrganizationMutation();
  const logout = useLogoutMutation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (current.data && current.data.context !== "ACCOUNT") router.replace("/");
    if (current.isError) router.replace("/signin");
  }, [current.data, current.isError, router]);

  async function selectAndEnter(id: string) {
    try {
      await select.mutateAsync(id);
      router.replace("/");
    } catch {
      // The mutation error is shown below the form.
    }
  }

  async function createAndEnter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await create.mutateAsync({ name: name.trim(), slug: slug.trim() });
      await selectAndEnter(result.id);
    } catch {
      // The mutation error is shown below the form.
    }
  }

  if (!current.data || current.data.context !== "ACCOUNT")
    return <main className="min-h-screen bg-white dark:bg-gray-900" aria-busy="true" />;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">{t("onboardingTitle")}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("onboardingDescription", { name: current.data.name })}</p>
      </div>

      {organizations.isLoading && <p className="text-sm text-gray-500" aria-busy="true">{t("onboardingChecking")}</p>}
      {organizations.isError && <Alert variant="error" title={t("onboardingAccessError")} message={t("onboardingAccessErrorDetail")} />}
      {organizations.data && organizations.data.length > 0 && (
        <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
          <h2 className="font-medium text-gray-900 dark:text-white">{t("onboardingAvailable")}</h2>
          <div className="mt-4 flex flex-col gap-3">
            {organizations.data.map((organization) => (
              <button key={organization.id} type="button" disabled={select.isPending} onClick={() => void selectAndEnter(organization.id)} className="rounded-lg border border-gray-300 px-4 py-3 text-start text-sm text-gray-800 hover:border-brand-500 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
                {organization.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {organizations.data?.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">{t("onboardingNoOrganization")}</p>}

      <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
        <h2 className="font-medium text-gray-900 dark:text-white">{t("onboardingCreate")}</h2>
        <form className="mt-4 space-y-4" onSubmit={(event) => void createAndEnter(event)}>
          <div><Label htmlFor="organization-name">{t("onboardingName")}</Label><Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} /></div>
          <div><Label htmlFor="organization-slug">{t("onboardingSlug")}</Label><Input id="organization-slug" value={slug} onChange={(event) => setSlug(event.target.value)} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
          <Button disabled={create.isPending || select.isPending}>{t("onboardingCreateAction")}</Button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
        <h2 className="font-medium text-gray-900 dark:text-white">{t("onboardingInvited")}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("onboardingInvitedDescription")}</p>
        {invitations.isLoading && <p className="mt-3 text-sm text-gray-500" aria-busy="true">{t("onboardingInvitationChecking")}</p>}
        {invitations.isError && <Alert variant="error" title={t("onboardingInvitationError")} message={t("onboardingAccessErrorDetail")} />}
        {invitations.data && invitations.data.data.length > 0 && (
          <ul className="mt-4 space-y-3">
            {invitations.data.data.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{invitation.organizationName}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{t("onboardingInvitationExpiry", { date: new Date(invitation.expiresAt).toISOString().slice(0, 10) })}</p>
                  <p role="status" className="mt-2 text-sm text-warning-700 dark:text-warning-400">{t("onboardingInvitationUnavailable")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {invitations.data && invitations.data.data.length === 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400" role="status">
            {t("onboardingNoInvitations")}
          </p>
        )}
        <button type="button" onClick={() => { void organizations.refetch(); void invitations.refetch(); }} className="mt-3 text-sm font-medium text-brand-500 hover:text-brand-600">{t("onboardingCheckAgain")}</button>
      </section>
      {(create.isError || select.isError) && <Alert variant="error" title={t("onboardingActionError")} message={t("onboardingActionErrorDetail")} />}
      <button type="button" onClick={() => void logout.mutateAsync().then(() => router.replace("/signin")).catch(() => undefined)} className="self-start text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400">{t("onboardingSignOut")}</button>
    </main>
  );
}
