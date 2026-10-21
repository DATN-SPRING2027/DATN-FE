"use client";

import Alert from "@/components/ui/alert/Alert";
import { ApiError } from "@/lib/api-client";
import { GroupIcon } from "@/icons";
import {
  useAcceptOrganizationInvitationMutation,
  useMyOrganizationInvitationsQuery,
} from "@/lib/queries/auth/useAccountOnboarding";
import type { RecipientInvitation } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  clearOrganizationInvitationAcceptanceKey,
  getOrganizationInvitationAcceptanceKey,
} from "@/lib/queries/organization-memberships/organization-invitation-acceptance-idempotency";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useState } from "react";

function acceptanceErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "onboardingInvitationAcceptError";
  if (error.status === 503) return "onboardingInvitationUnavailable";
  if (error.status === 409) return "onboardingInvitationConflict";
  if (error.status === 403) return "onboardingInvitationForbidden";
  if (error.status === 410) return "onboardingInvitationExpired";
  if (error.status === 404 || error.status === 422) return "onboardingInvitationInvalid";
  return "onboardingInvitationAcceptError";
}

export default function OrganizationInvitations({
  enabled,
  onCheckOrganizations,
}: {
  enabled: boolean;
  onCheckOrganizations: () => Promise<unknown>;
}) {
  const t = useTranslations("auth");
  const invitations = useMyOrganizationInvitationsQuery(enabled);
  const accept = useAcceptOrganizationInvitationMutation();
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<string | null>(null);
  const [acceptanceError, setAcceptanceError] = useState<{ invitationId: string; error: unknown } | null>(null);
  const [acceptedInvitationId, setAcceptedInvitationId] = useState<string | null>(null);

  async function acceptInvitation(invitation: RecipientInvitation) {
    if (invitation.status !== "PENDING" || acceptingInvitationId) return;
    setAcceptingInvitationId(invitation.id);
    setAcceptanceError(null);
    try {
      const { storageKey, idempotencyKey } = getOrganizationInvitationAcceptanceKey(
        invitation.id,
        invitation.version,
      );
      await accept.mutateAsync({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        expectedInvitationVersion: invitation.version,
        idempotencyKey,
      });
      clearOrganizationInvitationAcceptanceKey(storageKey);
      setAcceptedInvitationId(invitation.id);
      await Promise.all([
        invitations.refetch().catch(() => undefined),
        onCheckOrganizations().catch(() => undefined),
      ]);
    } catch (error) {
      setAcceptanceError({ invitationId: invitation.id, error });
    } finally {
      setAcceptingInvitationId(null);
    }
  }

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
              {invitation.status === "PENDING" && (
                <p className="mt-2 text-xs font-medium text-warning-700 dark:text-warning-400" role="status">
                  {t("onboardingInvitationPending")}
                </p>
              )}
              {acceptanceError?.invitationId === invitation.id && (
                <p className="mt-3 text-sm text-error-600 dark:text-error-400" role="alert">
                  {t(acceptanceErrorKey(acceptanceError.error))}
                </p>
              )}
              {acceptedInvitationId === invitation.id ? (
                <p className="mt-3 text-sm text-success-700 dark:text-success-400" role="status">
                  {t("onboardingInvitationAccepted")}
                </p>
              ) : invitation.status === "PENDING" ? (
                <button
                  type="button"
                  disabled={acceptingInvitationId !== null}
                  onClick={() => void acceptInvitation(invitation)}
                  className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {acceptingInvitationId === invitation.id
                    ? t("onboardingAcceptingInvitation")
                    : t("onboardingAcceptInvitation")}
                </button>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400" role="status">
                  {t("onboardingInvitationNotPending")}
                </p>
              )}
              <Link className="mt-3 ms-2 inline-flex min-h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5" href={`/organization/invitations?invitationId=${encodeURIComponent(invitation.id)}` as never}>
                {t("onboardingOpenInvitation")}
              </Link>
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
        onClick={() => { void invitations.refetch(); void onCheckOrganizations(); }}
        className="mt-4 min-h-9 rounded-lg px-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
      >
        {t("onboardingCheckAgain")}
      </button>
    </section>
  );
}
