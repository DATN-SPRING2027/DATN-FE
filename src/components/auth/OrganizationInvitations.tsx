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
  if (error.status === 404 || error.status === 422)
    return "onboardingInvitationInvalid";
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
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<
    string | null
  >(null);
  const [acceptanceError, setAcceptanceError] = useState<{
    invitationId: string;
    error: unknown;
  } | null>(null);
  const [acceptedInvitationId, setAcceptedInvitationId] = useState<
    string | null
  >(null);

  async function acceptInvitation(invitation: RecipientInvitation) {
    if (invitation.status !== "PENDING" || acceptingInvitationId) return;
    setAcceptingInvitationId(invitation.id);
    setAcceptanceError(null);
    try {
      const { storageKey, idempotencyKey } =
        getOrganizationInvitationAcceptanceKey(
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

  const invitationItems = invitations.data?.data ?? [];
  const isEmpty = Boolean(
    invitations.data && invitationItems.length === 0 && !invitations.isError,
  );

  if (isEmpty) {
    return (
      <section
        aria-labelledby="organization-invitations-title"
        className="rounded-2xl border border-dashed border-gray-200/90 bg-gray-50/70 px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900/40"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-white text-gray-500 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              <GroupIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <h2
                id="organization-invitations-title"
                className="text-xs font-semibold text-gray-800 dark:text-gray-200"
              >
                {t("onboardingInvited")}
              </h2>
              <p
                className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                role="status"
              >
                {t("onboardingNoInvitations")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void invitations.refetch();
              void onCheckOrganizations();
            }}
            className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-gray-200/90 bg-white px-3 py-1.5 text-xs font-medium text-brand-600 shadow-2xs transition hover:border-brand-300 hover:bg-brand-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:self-center dark:border-gray-700 dark:bg-gray-800 dark:text-brand-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
          >
            {t("onboardingCheckAgain")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="organization-invitations-title"
      className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-500/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20"
          >
            <GroupIcon className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="organization-invitations-title"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                {t("onboardingInvited")}
              </h2>
              {invitationItems.length > 0 && (
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-50 px-1.5 text-[11px] font-semibold text-warning-700 tabular-nums ring-1 ring-inset ring-warning-600/20 dark:bg-warning-500/15 dark:text-warning-300"
                >
                  {invitationItems.length}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("onboardingInvitedDescription")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void invitations.refetch();
            void onCheckOrganizations();
          }}
          className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-gray-200/90 bg-gray-50 px-3 py-1.5 text-xs font-medium text-brand-600 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          {t("onboardingCheckAgain")}
        </button>
      </div>

      {invitations.isLoading && (
        <p
          className="mt-4 text-xs text-gray-500 dark:text-gray-400"
          aria-busy="true"
        >
          {t("onboardingInvitationChecking")}
        </p>
      )}
      {invitations.isError && (
        <div className="mt-4">
          <Alert
            variant="error"
            title={t("onboardingInvitationError")}
            message={t("onboardingAccessErrorDetail")}
          />
        </div>
      )}
      {invitationItems.length > 0 && (
        <ul className="mt-4 space-y-3">
          {invitationItems.map((invitation) => (
            <li
              key={invitation.id}
              className="rounded-xl border border-gray-200/90 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {invitation.organizationName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                    {t("onboardingInvitationExpiry", {
                      date: new Date(invitation.expiresAt)
                        .toISOString()
                        .slice(0, 10),
                    })}
                  </p>
                </div>
                {invitation.status === "PENDING" && (
                  <p
                    className="inline-flex items-center rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-inset ring-warning-600/20 dark:bg-warning-500/15 dark:text-warning-400"
                    role="status"
                  >
                    {t("onboardingInvitationPending")}
                  </p>
                )}
              </div>

              {acceptanceError?.invitationId === invitation.id && (
                <p
                  className="mt-3 text-xs font-medium text-error-600 dark:text-error-400"
                  role="alert"
                >
                  {t(acceptanceErrorKey(acceptanceError.error))}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {acceptedInvitationId === invitation.id ? (
                  <p
                    className="text-xs font-medium text-success-700 dark:text-success-400"
                    role="status"
                  >
                    {t("onboardingInvitationAccepted")}
                  </p>
                ) : invitation.status === "PENDING" ? (
                  <button
                    type="button"
                    disabled={acceptingInvitationId !== null}
                    onClick={() => void acceptInvitation(invitation)}
                    className="inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {acceptingInvitationId === invitation.id
                      ? t("onboardingAcceptingInvitation")
                      : t("onboardingAcceptInvitation")}
                  </button>
                ) : (
                  <p
                    className="text-xs text-gray-500 dark:text-gray-400"
                    role="status"
                  >
                    {t("onboardingInvitationNotPending")}
                  </p>
                )}

                <Link
                  className="inline-flex min-h-9 items-center rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
                  href={
                    `/organization/invitations?invitationId=${encodeURIComponent(invitation.id)}` as never
                  }
                >
                  {t("onboardingOpenInvitation")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
