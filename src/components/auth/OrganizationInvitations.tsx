"use client";

import Alert from "@/components/ui/alert/Alert";
import { GroupIcon } from "@/icons";
import { useMyOrganizationInvitationsQuery } from "@/lib/queries/auth/useAccountOnboarding";
import { useTranslations } from "next-intl";

export default function OrganizationInvitations({
  enabled,
  onCheckOrganizations,
}: {
  enabled: boolean;
  onCheckOrganizations: () => void;
}) {
  const t = useTranslations("auth");
  const invitations = useMyOrganizationInvitationsQuery(enabled);

  return (
    <section aria-labelledby="organization-invitations-title" className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <GroupIcon className="size-4" />
        </span>
        <div>
          <h2 id="organization-invitations-title" className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("onboardingInvited")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-400">
            {t("onboardingInvitedDescription")}
          </p>
        </div>
      </div>
      {invitations.isLoading && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400" aria-busy="true">
          {t("onboardingInvitationChecking")}
        </p>
      )}
      {invitations.isError && (
        <Alert variant="error" title={t("onboardingInvitationError")} message={t("onboardingAccessErrorDetail")} />
      )}
      {invitations.data && invitations.data.data.length > 0 && (
        <ul className="mt-4 space-y-3">
          {invitations.data.data.map((invitation) => (
            <li key={invitation.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{invitation.organizationName}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("onboardingInvitationExpiry", { date: new Date(invitation.expiresAt).toISOString().slice(0, 10) })}
              </p>
              <p role="status" className="mt-2 text-sm text-warning-700 dark:text-warning-400">
                {t("onboardingInvitationUnavailable")}
              </p>
            </li>
          ))}
        </ul>
      )}
      {invitations.data && invitations.data.data.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400" role="status">
          {t("onboardingNoInvitations")}
        </p>
      )}
      <button
        type="button"
        onClick={() => { void invitations.refetch(); onCheckOrganizations(); }}
        className="mt-4 min-h-9 rounded-lg px-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
      >
        {t("onboardingCheckAgain")}
      </button>
    </section>
  );
}
