"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import { Modal } from "@/components/ui/modal";
import type {
  AdminInvitation,
  OrganizationMembership,
  MembershipActionReason,
  SuspensionReason,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { ApiError } from "@/lib/api-client";

export type MembershipActionTarget =
  | Readonly<{ action: "suspend"; membership: OrganizationMembership }>
  | Readonly<{ action: "resend" | "cancel"; invitation: AdminInvitation }>;
export type MembershipActionReasonCode = MembershipActionReason | SuspensionReason | "INVITATION_CANCELLED";

function getErrorMessageKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE") return "invalidResponse";
  if (error.status === 403) return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 404) return "notFound";
  if (error.status === 409 && error.code === "LAST_ELIGIBLE_ADMIN") return "lastAdmin";
  if (error.status === 409) return "conflict";
  if (error.status === 422) return "validation";
  if (error.status === 429) return "rateLimit";
  if (error.status === 503) return "dependencyUnavailable";
  return "failure";
}

function getTitleKey(target: MembershipActionTarget): string {
  return target.action === "suspend" ? "suspendTitle" : target.action === "resend" ? "resendTitle" : "cancelTitle";
}

function getHintKey(target: MembershipActionTarget): string {
  return target.action === "suspend" ? "suspendHint" : target.action === "resend" ? "resendHint" : "cancelHint";
}

function getConfirmKey(target: MembershipActionTarget): string {
  return target.action === "suspend" ? "confirmSuspend" : target.action === "resend" ? "confirmResend" : "confirmCancelInvitation";
}

export default function OrganizationMembershipActionDialog({
  target,
  error,
  isPending,
  onClose,
  onConfirm,
  onRetry,
  onRefresh,
  isRecovering,
  refreshFailed,
}: {
  target: MembershipActionTarget | null;
  error?: unknown;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: MembershipActionReasonCode) => void;
  onRetry: () => void;
  onRefresh: () => void;
  isRecovering: boolean;
  refreshFailed: boolean;
}) {
  const t = useTranslations("organizationMembers");
  const [reason, setReason] = useState<MembershipActionReasonCode | "">("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!target) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("select, button")?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [target]);

  if (!target) return null;
  const activeTarget = target;
  const hasUnresolvedError = error !== undefined && error !== null;

  const reasonOptions: readonly { value: MembershipActionReasonCode; label: string }[] =
    activeTarget.action === "suspend"
      ? [
          { value: "SECURITY_INCIDENT", label: t("securityIncident") },
          { value: "ACCESS_REVIEW", label: t("accessReview") },
        ]
      : activeTarget.action === "resend"
        ? [
            { value: "ACCESS_REQUEST", label: t("accessRequest") },
            { value: "ACCESS_REVIEW", label: t("accessReview") },
          ]
        : [];
  const busy = isPending || isRecovering;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || hasUnresolvedError) return;
    onConfirm(activeTarget.action === "cancel" ? "INVITATION_CANCELLED" : reason as MembershipActionReasonCode);
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled)");
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <Modal isOpen onClose={() => { if (!busy && !hasUnresolvedError) onClose(); }} showCloseButton={false} className="mx-4 max-w-lg">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-members-action-title"
        aria-describedby="organization-members-action-hint organization-members-action-target"
        onKeyDown={trapFocus}
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
        <h2 id="organization-members-action-title" className="text-lg font-semibold text-gray-900 dark:text-white/90">{t(getTitleKey(activeTarget))}</h2>
            <p id="organization-members-action-hint" className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{t(getHintKey(activeTarget))}</p>
            <p id="organization-members-action-target" className="mt-3 text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">{t("actionTargetLabel")}:</span>{" "}
              <span>{activeTarget.action === "suspend" ? activeTarget.membership.user?.fullName || activeTarget.membership.user?.email || t("nameUnavailable") : activeTarget.invitation.email}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy || hasUnresolvedError} aria-label={t("close")} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:hover:bg-gray-800">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {reasonOptions.length > 0 && (
          <div className="mb-5">
            <Label htmlFor="organization-members-action-reason">{t("reason")}</Label>
            <select
              id="organization-members-action-reason"
              required
              value={reason}
              disabled={busy || hasUnresolvedError}
              onChange={(event) => setReason(event.target.value as MembershipActionReasonCode | "")}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">{t("selectReason")}</option>
              {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t("reasonHelp")}</p>
          </div>
        )}
        {error !== undefined && error !== null && (
          <div className="mb-5" role="alert">
            <Alert variant="error" title={t("errorTitle")} message={t(getErrorMessageKey(error))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy} onClick={onRetry}>{t("retryMutation")}</Button>
              <Button size="sm" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy} onClick={onRefresh}>{busy ? t("refreshingBeforeNewAction") : t("refreshBeforeNewAction")}</Button>
            </div>
            {refreshFailed && <p className="mt-3 text-sm text-error-600 dark:text-error-400">{t("refreshBeforeNewActionError")}</p>}
          </div>
        )}
        {isPending && <p role="status" className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t("working")}</p>}
        {isRecovering && <p role="status" className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t("refreshingBeforeNewAction")}</p>}
        <form onSubmit={submit} className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy || hasUnresolvedError} onClick={onClose}>{t(activeTarget.action === "cancel" ? "keepInvitation" : "dialogCancel")}</Button>
          <Button type="submit" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy || hasUnresolvedError || (reasonOptions.length > 0 && !reason)}>{busy ? t("working") : t(getConfirmKey(activeTarget))}</Button>
        </form>
      </div>
    </Modal>
  );
}
