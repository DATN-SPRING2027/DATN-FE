"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import type {
  OrganizationMembership,
  OrganizationRoleCode,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";

function getErrorMessageKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE") return "invalidResponse";
  if (error.code === "LAST_ELIGIBLE_ADMIN") return "roleLastAdmin";
  if (error.status === 403) return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 404) return "notFound";
  if (error.status === 409) return "conflict";
  if (error.status === 422) return "validation";
  if (error.status === 429) return "rateLimit";
  if (error.status === 503) return "dependencyUnavailable";
  return "failure";
}

export default function OrganizationMembershipRoleDialog({
  membership,
  error,
  isPending,
  isRecovering,
  refreshFailed,
  onClose,
  onSubmit,
  onRetry,
  onRefresh,
}: {
  membership: OrganizationMembership | null;
  error?: unknown;
  isPending: boolean;
  isRecovering: boolean;
  refreshFailed: boolean;
  onClose: () => void;
  onSubmit: (roleCode: OrganizationRoleCode, reason: string) => void;
  onRetry: () => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("organizationMembers");
  const roleLabel = useRoleDisplayLabel();
  const [roleCode, setRoleCode] = useState<OrganizationRoleCode | "">(membership?.roleCode ?? "");
  const [reason, setReason] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!membership) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLSelectElement>("select")?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [membership]);

  if (!membership) return null;
  const hasError = error !== undefined && error !== null;
  const busy = isPending || isRecovering;
  const memberName = membership.user?.fullName || membership.user?.email || membership.userId;
  const canSubmit = Boolean(roleCode && roleCode !== membership.roleCode && reason.trim() && reason.length <= 500);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || hasError || !canSubmit || !roleCode) return;
    onSubmit(roleCode, reason.trim());
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
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

  return (
    <Modal
      isOpen
      onClose={() => { if (!busy && !hasError) onClose(); }}
      showCloseButton={false}
      className="mx-4 max-w-lg"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        onKeyDown={trapFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("changeRoleTitle")}</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("changeRoleDescription", { member: memberName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy || hasError}
            aria-label={t("close")}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {hasError && (
          <div className="mb-5" role="alert">
            <Alert variant="error" title={t("errorTitle")} message={t(getErrorMessageKey(error))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy} onClick={onRetry}>{t("retryMutation")}</Button>
              <Button size="sm" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy} onClick={onRefresh}>{busy ? t("refreshingBeforeNewAction") : t("refreshRoleBeforeNewAction")}</Button>
            </div>
            {refreshFailed && <p className="mt-3 text-sm text-error-600 dark:text-error-400">{t("refreshBeforeNewActionError")}</p>}
          </div>
        )}

        {isPending && <p role="status" className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t("roleSubmitting")}</p>}
        {isRecovering && <p role="status" className="mb-4 text-sm text-gray-500 dark:text-gray-400">{t("refreshingBeforeNewAction")}</p>}

        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="organization-members-role">{t("newRole")}</Label>
            <select
              id="organization-members-role"
              required
              value={roleCode}
              disabled={busy || hasError}
              onChange={(event) => setRoleCode(event.target.value as OrganizationRoleCode | "")}
              className="h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="" disabled>{t("roleUnassigned")}</option>
              <option value="ADMIN">{roleLabel("ADMIN")}</option>
              <option value="MEMBER">{roleLabel("MEMBER")}</option>
            </select>
          </div>

          <div>
            <Label htmlFor="organization-members-role-reason">{t("roleReason")}</Label>
            <textarea
              id="organization-members-role-reason"
              required
              maxLength={500}
              rows={3}
              value={reason}
              disabled={busy || hasError}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t("roleReasonHelp")}</p>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button type="button" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy || hasError} onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={busy || hasError || !canSubmit}>{busy ? t("roleSubmitting") : t("changeRole")}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
