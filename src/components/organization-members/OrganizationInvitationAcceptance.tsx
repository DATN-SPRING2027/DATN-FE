"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
import {
  acceptOrganizationInvitation,
  getOrganizationInvitation,
  invitationReturnTo,

  resolveOrganizationInvitation,
  type ResolvedOrganizationInvitation,
} from "@/lib/queries/organization-memberships/organization-invitations";
import {
  clearOrganizationInvitationAcceptanceKey,
  getOrganizationInvitationAcceptanceKey,
} from "@/lib/queries/organization-memberships/organization-invitation-acceptance-idempotency";

type LoadState = "idle" | "loading" | "error";

function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "invitationServerError";
  if (error.status === 410 || error.code === "INVITATION_EXPIRED") return "invitationExpired";
  if (error.status === 403 && error.code === "INVITATION_EMAIL_MISMATCH") return "invitationWrongEmail";
  if (error.status === 409 || error.code === "INVITATION_NOT_ACCEPTABLE") return "invitationStale";
  if (error.status === 404) return "invitationInvalid";
  return "invitationServerError";
}

function sameEmail(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export default function OrganizationInvitationAcceptance() {
  const t = useTranslations("organizationMembers");
  const router = useRouter();
  const currentUser = useCurrentUserQuery();
  const logout = useLogoutMutation();
  const urlCapturedRef = useRef(false);
  const resolvingTokenRef = useRef("");
  const [token, setToken] = useState("");
  const [invitationIdFromUrl, setInvitationIdFromUrl] = useState("");
  const [invitation, setInvitation] = useState<ResolvedOrganizationInvitation | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<unknown>();
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<unknown>();

  useLayoutEffect(() => {
    if (urlCapturedRef.current) return;
    urlCapturedRef.current = true;
    const rawHash = window.location.hash.replace(/^#+/, "");
    const rawToken = rawHash.startsWith("token=")
      ? (() => {
          try {
            return decodeURIComponent(rawHash.slice("token=".length));
          } catch {
            return rawHash;
          }
        })()
      : rawHash;
    const invitationId = new URLSearchParams(window.location.search).get("invitationId") ?? "";
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    // The token is captured in component memory only after removing it from browser history.
    setToken(rawToken);
    setInvitationIdFromUrl(invitationId);
  }, []);

  useLayoutEffect(() => {
    if (token) {
      if (resolvingTokenRef.current === token) return;
      resolvingTokenRef.current = token;
      setLoadState("loading");
      void resolveOrganizationInvitation(token).then((result) => {
        setInvitation(result);
        setLoadState("idle");
      }).catch((error: unknown) => {
        setLoadError(error);
        setLoadState("error");
      }).finally(() => setToken(""));
      return;
    }
    if (!invitationIdFromUrl || !currentUser.data) return;
    setLoadState("loading");
    void getOrganizationInvitation(invitationIdFromUrl).then((result) => {
      setInvitation(result);
      setLoadState("idle");
    }).catch((error: unknown) => {
      setLoadError(error);
      setLoadState("error");
    });
  }, [token, invitationIdFromUrl, currentUser.data]);

  const invitationId = invitation?.id ?? invitationIdFromUrl;
  const returnTo = invitationId ? invitationReturnTo(invitationId) : "";
  const loggedIn = Boolean(currentUser.data);
  const emailMatches = Boolean(invitation && currentUser.data && sameEmail(invitation.invitedEmail, currentUser.data.email));

  async function accept() {
    if (!invitation || !emailMatches || accepting) return;
    setAccepting(true);
    setAcceptError(undefined);
    try {
      const { storageKey, idempotencyKey } = getOrganizationInvitationAcceptanceKey(
        invitation.id,
        invitation.version,
      );
      await acceptOrganizationInvitation(invitation.id, invitation.organizationId, 0, invitation.version, idempotencyKey);
      clearOrganizationInvitationAcceptanceKey(storageKey);
      router.replace("/onboarding");
    } catch (error) {
      setAcceptError(error);
    } finally {
      setAccepting(false);
    }
  }

  async function refreshInvitation() {
    if (!invitationId) return;
    setLoadState("loading");
    setLoadError(undefined);
    try {
      setInvitation(await getOrganizationInvitation(invitationId));
      setAcceptError(undefined);
      setLoadState("idle");
    } catch (error) {
      setLoadError(error);
      setLoadState("error");
    }
  }

  const acceptanceConflict = acceptError instanceof ApiError && acceptError.status === 409;

  if (loadState === "loading" || currentUser.isFetching) {
    return <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center px-4"><p role="status" aria-busy="true" className="w-full motion-safe:animate-pulse rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">{t("invitationLoading")}</p></main>;
  }

  if (loadState === "error") {
    return <InvitationPanel title={t("invitationTitle")}><Alert variant="error" title={t("invitationUnavailableTitle")} message={t(errorKey(loadError))} /></InvitationPanel>;
  }

  if (invitation?.status === "EXPIRED") return <InvitationPanel title={t("invitationTitle")}><p role="status" className="text-sm text-gray-600 dark:text-gray-300">{t("invitationExpired")}</p></InvitationPanel>;
  if (invitation?.status === "ACCEPTED") return <InvitationPanel title={t("invitationTitle")}><p role="status" className="text-sm text-gray-600 dark:text-gray-300">{t("invitationAlreadyAccepted")}</p><Link className="mt-5 inline-flex font-medium text-brand-600 hover:underline dark:text-brand-400" href="/signin">{t("signIn")}</Link></InvitationPanel>;
  if (invitation && invitation.status !== "PENDING") {
    return (
      <InvitationPanel title={t("invitationTitle")}>
        <p role="status" className="text-sm text-gray-600 dark:text-gray-300">{t("invitationUnavailable")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            href={(loggedIn ? "/onboarding" : "/signin") as never}
          >
            {loggedIn ? t("invitationsTitle") : t("signIn")}
          </Link>
        </div>
      </InvitationPanel>
    );
  }

  if (invitation && !loggedIn) {
    return <InvitationPanel title={t("invitationTitle")}>
      <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{t("invitationFor", { organization: invitation.organizationName, email: invitation.invitedEmail })}</p>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{t("invitationSignInRequired")}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white hover:bg-brand-600" href={`/signin?returnTo=${encodeURIComponent(returnTo)}` as never}>{t("signIn")}</Link>
      </div>
    </InvitationPanel>;
  }

  if (invitation && loggedIn && !emailMatches) {
    return <InvitationPanel title={t("invitationTitle")}>
      <p role="alert" className="text-sm leading-6 text-error-600 dark:text-error-400">{t("invitationWrongEmail")}</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t("invitationFor", { organization: invitation.organizationName, email: invitation.invitedEmail })}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" disabled={logout.isPending} onClick={() => void logout.mutateAsync().then(() => router.replace(`/signin?returnTo=${encodeURIComponent(returnTo)}` as never)).catch(() => undefined)}>{t("switchAccount")}</Button>
      </div>
    </InvitationPanel>;
  }

  if (invitation && emailMatches) {
    return <InvitationPanel title={t("invitationTitle")}>
      <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{t("invitationFor", { organization: invitation.organizationName, email: invitation.invitedEmail })}</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("invitationExpiry", { date: new Date(invitation.expiresAt).toLocaleDateString() })}</p>
      {acceptError !== undefined && <div className="mt-5"><Alert variant="error" title={t("invitationUnavailableTitle")} message={t(errorKey(acceptError))} />{acceptanceConflict && <Button className="mt-3" variant="outline" onClick={() => void refreshInvitation()}>{t("invitationRefresh")}</Button>}</div>}
      <Button className="mt-6 w-full sm:w-auto" disabled={accepting} onClick={() => void accept()}>{accepting ? t("invitationAccepting") : t("invitationAccept")}</Button>
    </InvitationPanel>;
  }

  if (currentUser.isError && !token && !invitationIdFromUrl) {
    return <InvitationPanel title={t("invitationTitle")}><Alert variant="error" title={t("invitationUnavailableTitle")} message={t("invitationInvalid")} /></InvitationPanel>;
  }

  return <InvitationPanel title={t("invitationTitle")}><p role="status" className="text-sm text-gray-600 dark:text-gray-300">{t("invitationInvalid")}</p></InvitationPanel>;
}

function InvitationPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10"><section className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 sm:p-8"><p className="text-sm font-medium text-brand-600 dark:text-brand-400">Continuum AI</p><h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90">{title}</h1><div className="mt-5">{children}</div></section></main>;
}
