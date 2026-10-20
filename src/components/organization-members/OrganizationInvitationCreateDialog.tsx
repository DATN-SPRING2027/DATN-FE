"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import type { InviteMemberInput } from "@/lib/queries/organization-memberships/organization-memberships.contract";

function getErrorMessageKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE") return "invalidResponse";
  if (error.status === 403) return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 404) return "notFound";
  if (error.status === 409) return "conflict";
  if (error.status === 422) return "validation";
  if (error.status === 429) return "rateLimit";
  if (error.status === 503) return "dependencyUnavailable";
  return "failure";
}

export default function OrganizationInvitationCreateDialog({
  isOpen,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isPending: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmit: (input: InviteMemberInput) => void;
}) {
  const t = useTranslations("organizationMembers");
  const [email, setEmail] = useState("");
  const [reasonCode, setReasonCode] = useState<InviteMemberInput["reasonCode"] | "">("");
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const hasError = error !== undefined && error !== null;

  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [isOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (isPending || !normalizedEmail || !reasonCode) return;
    onSubmit({ email: normalizedEmail, reasonCode });
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), select:not(:disabled), button:not(:disabled)',
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
      isOpen={isOpen}
      onClose={() => { if (!isPending) onClose(); }}
      showCloseButton={false}
      className="mx-4 w-full max-w-lg"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isPending}
        onKeyDown={trapFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white/90">
              {t("inviteTitle")}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("inviteDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label={t("close")}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {hasError && (
          <div className="mb-6" role="alert">
            <Alert variant="error" title={t("inviteErrorTitle")} message={t(getErrorMessageKey(error))} />
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="organization-invite-email">{t("inviteEmailLabel")}</Label>
            <Input
              id="organization-invite-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              disabled={isPending}
              placeholder={t("emailPlaceholder")}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="organization-invite-reason">{t("reason")}</Label>
            <select
              id="organization-invite-reason"
              name="reasonCode"
              required
              value={reasonCode}
              disabled={isPending}
              onChange={(event) => setReasonCode(event.target.value as InviteMemberInput["reasonCode"] | "")}
              className="h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="">{t("selectReason")}</option>
              <option value="ACCESS_REQUEST">{t("accessRequest")}</option>
              <option value="ACCESS_REVIEW">{t("accessReview")}</option>
            </select>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t("reasonHelp")}</p>
          </div>

          {isPending && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">{t("inviting")}</p>}

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button type="button" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" disabled={isPending} onClick={onClose}>
              {t("inviteCancel")}
            </Button>
            <Button
              type="submit"
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              disabled={isPending || !email.trim() || !reasonCode}
            >
              {isPending ? t("inviting") : t("sendInvite")}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
