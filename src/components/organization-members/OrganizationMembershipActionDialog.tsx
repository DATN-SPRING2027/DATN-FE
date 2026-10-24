"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import { Modal } from "@/components/ui/modal";
import type {
  AdminInvitation,
  OrganizationMembership,
  MembershipActionReason,
  SuspensionReason,
  ProjectLeaderHandover,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import type { Project } from "@/lib/queries/projects/useProjects";
import { ApiError } from "@/lib/api-client";

export type MembershipActionTarget =
  | Readonly<{
      action: "suspend" | "resume" | "remove";
      membership: OrganizationMembership;
    }>
  | Readonly<{ action: "resend" | "cancel"; invitation: AdminInvitation }>;
export type MembershipActionReasonCode =
  | MembershipActionReason
  | SuspensionReason
  | "INVITATION_CANCELLED";

type ResendReasonMode = "NONE" | "PRESET" | "CUSTOM";

function getErrorMessageKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE")
    return "invalidResponse";
  if (error.status === 403) return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 404) return "notFound";
  if (error.status === 409 && error.code === "LAST_ELIGIBLE_ADMIN")
    return "lastAdmin";
  if (
    error.status === 409 &&
    error.code === "MEMBER_HAS_ACTIVE_PROJECT_LEADERSHIP"
  )
    return "activeProjectLeaderBlocker";
  if (error.status === 409 && error.code === "PROJECT_LEADER_HANDOVER_INVALID")
    return "handoverInvalid";
  if (error.status === 409) return "conflict";
  if (error.status === 422) return "validation";
  if (error.status === 429) return "rateLimit";
  if (error.status === 503) return "dependencyUnavailable";
  return "failure";
}

function isIneligibleResendError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    error.code === "INVITATION_TARGET_NOT_ELIGIBLE" || error.status === 422
  );
}

function getTitleKey(target: MembershipActionTarget): string {
  if (target.action === "suspend") return "suspendTitle";
  if (target.action === "resume") return "resumeTitle";
  if (target.action === "remove") return "removeTitle";
  if (target.action === "resend") return "resendTitle";
  return "cancelTitle";
}

function getHintKey(target: MembershipActionTarget): string {
  if (target.action === "suspend") return "suspendHint";
  if (target.action === "resume") return "resumeHint";
  if (target.action === "remove") return "removeHint";
  if (target.action === "resend") return "resendHint";
  return "cancelHint";
}

function getConfirmKey(target: MembershipActionTarget): string {
  if (target.action === "suspend") return "confirmSuspend";
  if (target.action === "resume") return "confirmResume";
  if (target.action === "remove") return "confirmRemove";
  if (target.action === "resend") return "confirmResend";
  return "confirmCancelInvitation";
}

function getEmailInitials(email: string): string {
  const local = (email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local.length === 1) return `${local[0]}${local[0]}`.toUpperCase();
  return "IN";
}

function formatShortDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

export default function OrganizationMembershipActionDialog({
  target,
  leaderProjects,
  candidates,
  handoverLoading,
  handoverError,
  error,
  isPending,
  isSuccess = false,
  onClose,
  onDismissError,
  onResendAgain,
  onConfirm,
  onRetry,
  onRefresh,
  isRecovering,
  refreshFailed,
}: {
  target: MembershipActionTarget | null;
  leaderProjects: readonly Project[];
  candidates: readonly OrganizationMembership[];
  handoverLoading: boolean;
  handoverError: boolean;
  error?: unknown;
  isPending: boolean;
  isSuccess?: boolean;
  onClose: () => void;
  onDismissError?: () => void;
  onResendAgain?: () => void;
  onConfirm: (reason: MembershipActionReasonCode, handovers?: readonly ProjectLeaderHandover[]) => void;
  onRetry: () => void;
  onRefresh: () => void;
  isRecovering: boolean;
  refreshFailed: boolean;
}) {
  const t = useTranslations("organizationMembers");
  const [reason, setReason] = useState<MembershipActionReasonCode | "">(
    target?.action === "resume" || target?.action === "remove"
      ? "ACCESS_REVIEW"
      : "",
  );
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [resendReasonMode, setResendReasonMode] =
    useState<ResendReasonMode>("NONE");
  const [presetReason, setPresetReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [mountNowMs] = useState<number>(() => Date.now());
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!target) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>("input, select, button")
        ?.focus(),
    );
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [target]);

  if (!target) return null;
  const activeTarget = target;
  const hasUnresolvedError = error !== undefined && error !== null;
  const busy = isPending || isRecovering;
  const confirmDismissOverlay = confirmCloseOpen && !busy && !isSuccess ? (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="organization-members-action-confirm-dismiss-title"
      aria-describedby="organization-members-action-confirm-dismiss-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-warning-100 text-sm font-bold text-warning-600 dark:bg-warning-500/20 dark:text-warning-400"
          >
            !
          </span>
          <div className="min-w-0 flex-1">
            <h3
              id="organization-members-action-confirm-dismiss-title"
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("confirmDismissTitle")}
            </h3>
            <p
              id="organization-members-action-confirm-dismiss-desc"
              className="mt-1.5 text-sm leading-5 text-gray-600 dark:text-gray-300"
            >
              {t("confirmDismissDescription")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmCloseOpen(false)}
          >
            {t("confirmDismissStay")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setConfirmCloseOpen(false);
              onClose();
            }}
          >
            {t("confirmDismissLeave")}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
      "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)",
    );
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

  /* ------------------------------------------------------------------
   * Redesigned Resend Invitation Modal (all 6 states from design spec)
   * ------------------------------------------------------------------ */
  if (activeTarget.action === "resend") {
    const invitation = activeTarget.invitation;
    const invitedDate = formatShortDate(invitation.createdAt);
    const expiresMs = Date.parse(invitation.expiresAt);
    const diffDays = Number.isFinite(expiresMs)
      ? Math.ceil((expiresMs - mountNowMs) / 86_400_000)
      : 7;

    const expiryLabel =
      diffDays > 0
        ? t("resendExpiresInDays", { count: diffDays })
        : diffDays === 0
          ? t("resendExpiresToday")
          : t("resendExpiredOn", { date: formatShortDate(invitation.expiresAt) });

    function submitResend(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (busy || hasUnresolvedError) return;
      const resolvedReason: MembershipActionReason =
        resendReasonMode === "PRESET" && presetReason === "ACCESS_REVIEW"
          ? "ACCESS_REVIEW"
          : "ACCESS_REQUEST";
      onConfirm(resolvedReason);
    }

    function handleResendAgain() {
      setResendReasonMode("NONE");
      setPresetReason("");
      setCustomReason("");
      onResendAgain?.();
    }

    return (
      <Modal
        isOpen
        onClose={() => {
          if (!busy) {
            if (hasUnresolvedError && onDismissError) {
              onDismissError();
            } else {
              if (isSuccess) {
                onClose();
              } else {
                setConfirmCloseOpen(true);
              }
            }
          }
        }}
        showCloseButton={false}
        className="mx-4 w-full max-w-lg"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="organization-members-action-title"
          aria-describedby="organization-members-action-hint organization-members-action-target"
          aria-busy={busy}
          onKeyDown={trapFocus}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 sm:p-7"
        >
          {confirmDismissOverlay}
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2
                id="organization-members-action-title"
                className="text-lg font-semibold text-gray-900 dark:text-white/90"
              >
                {t("resendTitle")}
              </h2>
              <p
                id="organization-members-action-hint"
                className="mt-1.5 text-sm leading-5 text-gray-600 dark:text-gray-300"
              >
                {t("resendHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={hasUnresolvedError && onDismissError ? onDismissError : onClose}
              disabled={busy}
              aria-label={t("close")}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>

          {/* Recipient & Invitation Summary Card */}
          <div
            id="organization-members-action-target"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
              >
                {getEmailInitials(invitation.invitedEmail)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                    {invitation.invitedEmail}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="size-3.5 shrink-0 text-gray-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.5 3.5h3v3M12.25 3.75 7.5 8.5M6.5 4.5H4.75A1.25 1.25 0 0 0 3.5 5.75v5.5c0 .69.56 1.25 1.25 1.25h5.5c.69 0 1.25-.56 1.25-1.25V9.5"
                    />
                  </svg>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>{t("resendInvitedOn", { date: invitedDate })}</span>
                  <span aria-hidden="true" className="mx-1.5">
                    •
                  </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {expiryLabel}
                  </span>
                </p>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="size-3.5 text-warning-500"
              >
                <path
                  fillRule="evenodd"
                  d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0V8c0 .2.08.39.22.53l2 2a.75.75 0 1 0 1.06-1.06L8.75 7.69V4.75Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t(invitation.status)}</span>
            </span>
          </div>

          {/* State 4: Đang gửi (loading) */}
          {isPending ? (
            <div>
              <div
                role="status"
                aria-live="polite"
                className="mb-5 flex items-center justify-center gap-3.5 rounded-xl border border-brand-100 bg-brand-50/50 px-5 py-6 dark:border-brand-500/20 dark:bg-brand-500/10"
              >
                <span
                  aria-hidden="true"
                  className="size-7 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    {t("resendSendingTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("resendSendingSubtitle")}
                  </p>
                </div>
                <span className="sr-only">{t("working")}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button type="button" variant="outline" disabled>
                  {t("dialogCancel")}
                </Button>
                <Button type="button" disabled>
                  {t("resendSendingButton")}
                </Button>
              </div>
            </div>
          ) : isSuccess && !hasUnresolvedError ? (
            /* State 5: Thành công */
            <div>
              <div
                role="status"
                aria-live="polite"
                className="mb-5 flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-500 text-white"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42 0l-3.75-3.775a1 1 0 1 1 1.42-1.408l3.04 3.06 6.54-6.585a1 1 0 0 1 1.414-.006Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-success-800 dark:text-success-300">
                    {t("resendSuccessTitle")}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-700 dark:text-gray-200">
                    {t("resendSuccessMessage", {
                      email: invitation.invitedEmail,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  onClick={onClose}
                >
                  {t("close")}
                </Button>
                <Button
                  type="button"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  onClick={handleResendAgain}
                >
                  {t("resendAgain")}
                </Button>
              </div>
            </div>
          ) : hasUnresolvedError ? (
            /* State 6: Lỗi */
            <div>
              <div
                role="alert"
                className="mb-5 rounded-xl border border-error-200 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/10"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-error-500 text-white"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="size-3.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5Zm0 7.25a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-error-700 dark:text-error-300">
                      {t("resendErrorTitle")}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-error-600 dark:text-error-200">
                      {isIneligibleResendError(error)
                        ? t("inviteIneligibleTitle")
                        : t(getErrorMessageKey(error))}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        disabled={busy}
                        onClick={onRefresh}
                      >
                        {busy
                          ? t("refreshingBeforeNewAction")
                          : t("refreshBeforeNewAction")}
                      </Button>
                    </div>
                    {refreshFailed && (
                      <p className="mt-2 text-xs text-error-600 dark:text-error-400">
                        {t("refreshBeforeNewActionError")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  disabled={busy}
                  onClick={onDismissError ?? onClose}
                >
                  {t("close")}
                </Button>
                <Button
                  type="button"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  disabled={busy}
                  onClick={onRetry}
                >
                  {t("resendTryAgain")}
                </Button>
              </div>
            </div>
          ) : (
            /* States 1, 2, 3: Mặc định / Chọn reason / Custom reason */
            <form onSubmit={submitResend} className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white/90">
                  {t("reason")}
                </legend>

                {/* Option 1: No reason (resend only) */}
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
                  <input
                    type="radio"
                    name="resendReasonMode"
                    value="NONE"
                    checked={resendReasonMode === "NONE"}
                    disabled={busy}
                    onChange={() => setResendReasonMode("NONE")}
                    className="mt-0.5 size-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    <span className="block font-medium text-gray-900 dark:text-white/90">
                      {t("resendNoReasonLabel")}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {t("resendNoReasonHelp")}
                    </span>
                  </span>
                </label>

                {/* Option 2: Select a reason (optional) */}
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name="resendReasonMode"
                      value="PRESET"
                      checked={resendReasonMode === "PRESET"}
                      disabled={busy}
                      onChange={() => {
                        setResendReasonMode("PRESET");
                        if (!presetReason) setPresetReason("EMAIL_NOT_RECEIVED");
                      }}
                      className="size-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {t("resendSelectReasonLabel")}
                    </span>
                  </label>
                  <div>
                    <Label
                      htmlFor="organization-members-action-reason"
                      className="sr-only"
                    >
                      {t("reason")}
                    </Label>
                    <select
                      id="organization-members-action-reason"
                      aria-label={t("reason")}
                      value={presetReason}
                      disabled={busy}
                      onFocus={() => setResendReasonMode("PRESET")}
                      onChange={(event) => {
                        setResendReasonMode("PRESET");
                        setPresetReason(event.target.value);
                      }}
                      className="h-10 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-800 shadow-theme-xs transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    >
                      <option value="">{t("selectReason")}</option>
                      <option value="EMAIL_NOT_RECEIVED">
                        {t("resendReasonEmailNotReceived")}
                      </option>
                      <option value="LINK_EXPIRED">
                        {t("resendReasonLinkExpired")}
                      </option>
                      <option value="INCORRECT_EMAIL_PREVIOUSLY">
                        {t("resendReasonIncorrectEmail")}
                      </option>
                      <option value="RECIPIENT_REQUESTED">
                        {t("resendReasonRecipientRequested")}
                      </option>
                      <option value="ACCESS_REQUEST">
                        {t("accessRequest")}
                      </option>
                      <option value="ACCESS_REVIEW">{t("accessReview")}</option>
                      <option value="OTHER">{t("resendReasonOther")}</option>
                    </select>
                  </div>
                </div>

                {/* Option 3: Custom reason (optional) */}
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-800 dark:text-gray-200">
                    <input
                      type="radio"
                      name="resendReasonMode"
                      value="CUSTOM"
                      checked={resendReasonMode === "CUSTOM"}
                      disabled={busy}
                      onChange={() => setResendReasonMode("CUSTOM")}
                      className="size-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {t("resendCustomReasonLabel")}
                    </span>
                  </label>
                  <div>
                    <textarea
                      id="organization-members-resend-custom-reason"
                      rows={2}
                      maxLength={500}
                      value={customReason}
                      disabled={busy}
                      placeholder={t("resendCustomReasonPlaceholder")}
                      onFocus={() => setResendReasonMode("CUSTOM")}
                      onChange={(event) => {
                        setResendReasonMode("CUSTOM");
                        setCustomReason(event.target.value);
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-theme-xs transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                    />
                    <div className="mt-1 flex justify-end">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {customReason.length}/500
                      </span>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Info Callout Box */}
              <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-xs leading-5 text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-brand-500 text-[10px] font-bold text-brand-600 dark:text-brand-300"
                >
                  i
                </span>
                <p>{t("resendInfoNote")}</p>
              </div>

              {isRecovering && (
                <p
                  role="status"
                  className="text-xs text-gray-500 dark:text-gray-400"
                >
                  {t("refreshingBeforeNewAction")}
                </p>
              )}

              {/* Footer */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  disabled={busy}
                  onClick={onClose}
                >
                  {t("dialogCancel")}
                </Button>
                <Button
                  type="submit"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  disabled={busy}
                >
                  {t("confirmResend")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    );
  }

  /* ------------------------------------------------------------------
   * Existing Suspend & Cancel Invitation Dialogs
   * ------------------------------------------------------------------ */
  const reasonOptions: readonly {
    value: MembershipActionReasonCode;
    label: string;
  }[] =
    activeTarget.action === "resume" || activeTarget.action === "remove"
      ? [
          { value: "ACCESS_REQUEST", label: t("accessRequest") },
          { value: "ACCESS_REVIEW", label: t("accessReview") },
          { value: "SECURITY_INCIDENT", label: t("securityIncident") },
        ]
      : "membership" in activeTarget
        ? [
            { value: "SECURITY_INCIDENT", label: t("securityIncident") },
            { value: "ACCESS_REVIEW", label: t("accessReview") },
          ]
        : [];

  const blockingProjects: readonly {
    id: string;
    code?: string;
    name?: string;
  }[] =
    error instanceof ApiError &&
    error.code === "MEMBER_HAS_ACTIVE_PROJECT_LEADERSHIP"
      ? Array.isArray(error.details?.blockingProjects)
        ? error.details.blockingProjects.filter(
            (item): item is { id: string; code?: string; name?: string } =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as Record<string, unknown>).id === "string",
          )
        : Array.isArray(error.details?.projectIds)
          ? error.details.projectIds
              .filter((id): id is string => typeof id === "string")
              .map((id) => ({ id }))
          : []
      : [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || hasUnresolvedError) return;
    onConfirm(
      activeTarget.action === "cancel"
        ? "INVITATION_CANCELLED"
        : (reason as MembershipActionReasonCode),
      leaderProjects.length ? leaderProjects.map((project) => ({ projectId: project.id, replacementUserId: replacements[project.id]! })) : undefined,
    );
  }

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy && !hasUnresolvedError) setConfirmCloseOpen(true);
      }}
      showCloseButton={false}
      className="mx-4 max-h-[90dvh] max-w-lg overflow-y-auto"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-members-action-title"
        aria-describedby="organization-members-action-hint organization-members-action-target"
        onKeyDown={trapFocus}
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 sm:p-8"
      >
        {confirmDismissOverlay}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="organization-members-action-title"
              className="text-lg font-semibold text-gray-900 dark:text-white/90"
            >
              {t(getTitleKey(activeTarget))}
            </h2>
            <p
              id="organization-members-action-hint"
              className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300"
            >
              {t(getHintKey(activeTarget))}
            </p>
            <p
              id="organization-members-action-target"
              className="mt-3 text-sm text-gray-700 dark:text-gray-200"
            >
              <span className="font-medium">{t("actionTargetLabel")}:</span>{" "}
              <span>
                {"membership" in activeTarget
                  ? activeTarget.membership.user?.fullName ||
                    activeTarget.membership.user?.email ||
                    t("nameUnavailable")
                  : activeTarget.invitation.invitedEmail}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy || hasUnresolvedError}
            aria-label={t("close")}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {activeTarget.action === "remove" && (
          <div className="mb-5 rounded-xl border border-warning-200 bg-warning-50/80 px-4 py-3 text-xs leading-5 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
            {t("removeDependencyNotice")}
          </div>
        )}
        {(activeTarget.action === "suspend" || activeTarget.action === "remove") && leaderProjects.length > 0 && (
          <div className="mb-5 space-y-3 rounded-xl border border-brand-200 bg-brand-25 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
            <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("handoverTitle")}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">{t("handoverHint")}</p>
            {handoverLoading && <p role="status" className="text-sm text-gray-600 dark:text-gray-300">{t("handoverLoading")}</p>}
            {handoverError && <p role="alert" className="text-sm text-error-600 dark:text-error-400">{t("handoverLoadError")}</p>}
            {!handoverLoading && !handoverError && leaderProjects.map((project) => (
              <div key={project.id}>
                <Label htmlFor={`handover-${project.id}`}>{project.name} ({project.code})</Label>
                <select
                  id={`handover-${project.id}`}
                  required
                  value={replacements[project.id] ?? ""}
                  disabled={busy || hasUnresolvedError}
                  onChange={(event) => setReplacements((current) => ({ ...current, [project.id]: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">{t("handoverSelect")}</option>
                  {candidates.map((member) => <option key={member.userId} value={member.userId}>{member.user?.fullName || member.user?.email || member.userId}</option>)}
                </select>
              </div>
            ))}
            {!handoverLoading && !handoverError && candidates.length === 0 && <p role="alert" className="text-sm text-warning-700 dark:text-warning-300">{t("handoverNoCandidates")}</p>}
          </div>
        )}
        {reasonOptions.length > 0 && (
          <div className="mb-5">
            <Label htmlFor="organization-members-action-reason">
              {t("reason")}
            </Label>
            <select
              id="organization-members-action-reason"
              required
              value={reason}
              disabled={busy || hasUnresolvedError}
              onChange={(event) =>
                setReason(
                  event.target.value as MembershipActionReasonCode | "",
                )
              }
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">{t("selectReason")}</option>
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("reasonHelp")}
            </p>
          </div>
        )}
        {error !== undefined && error !== null && (
          <div className="mb-5" role="alert">
            <Alert
              variant="error"
              title={t("errorTitle")}
              message={t(getErrorMessageKey(error))}
            />
            {blockingProjects.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {blockingProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${encodeURIComponent(project.id)}/members`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 bg-white px-3 py-1.5 text-xs font-semibold text-error-700 transition hover:bg-error-50 dark:border-error-500/30 dark:bg-gray-900 dark:text-error-300 dark:hover:bg-error-500/15"
                  >
                    <span>
                      {project.name
                        ? `${project.name}${project.code ? ` (${project.code})` : ""}`
                        : project.id}
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                disabled={busy}
                onClick={onRetry}
              >
                {t("retryMutation")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                disabled={busy}
                onClick={onRefresh}
              >
                {busy
                  ? t("refreshingBeforeNewAction")
                  : t("refreshBeforeNewAction")}
              </Button>
            </div>
            {refreshFailed && (
              <p className="mt-3 text-sm text-error-600 dark:text-error-400">
                {t("refreshBeforeNewActionError")}
              </p>
            )}
          </div>
        )}
        {isPending && (
          <p
            role="status"
            className="mb-4 text-sm text-gray-500 dark:text-gray-400"
          >
            {t("working")}
          </p>
        )}
        {isRecovering && (
          <p
            role="status"
            className="mb-4 text-sm text-gray-500 dark:text-gray-400"
          >
            {t("refreshingBeforeNewAction")}
          </p>
        )}
        <form onSubmit={submit} className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            disabled={busy || hasUnresolvedError}
            onClick={onClose}
          >
            {t(
              activeTarget.action === "cancel"
                ? "keepInvitation"
                : "dialogCancel",
            )}
          </Button>
          <Button
            type="submit"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            disabled={
              busy ||
              hasUnresolvedError ||
              handoverLoading || handoverError ||
              leaderProjects.some((project) => !replacements[project.id]) ||
              (reasonOptions.length > 0 && !reason)
            }
          >
            {busy ? t("working") : t(getConfirmKey(activeTarget))}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
