"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import { useActiveOrganizationProjects } from "@/lib/queries/projects/useActiveOrganizationProjects";
import type {
  InvitationExpiryDays,
  InviteMemberInput,
  OrganizationRoleCode,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type VisualRoleOption = "MEMBER" | "MANAGER" | "LEADER";
type SpecialConflictState = "ALREADY_INVITED" | "ALREADY_MEMBER" | null;

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

function isIneligibleAccountError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    error.status === 422 ||
    error.status === 404 ||
    error.code === "INVITATION_TARGET_NOT_ELIGIBLE"
  );
}

function detectConflictKind(error: unknown): SpecialConflictState {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const code = (error.code ?? "").toUpperCase();
  const msg = (error.message ?? "").toLowerCase();
  if (
    code.includes("MEMBER") ||
    msg.includes("already a member") ||
    msg.includes("active membership")
  ) {
    return "ALREADY_MEMBER";
  }
  return "ALREADY_INVITED";
}

function RoleOptionIcon({
  option,
  className = "size-4",
}: {
  option: VisualRoleOption;
  className?: string;
}) {
  if (option === "MANAGER") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className={className}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 2.75 16 5.25v4.6c0 4.05-2.55 6.86-6 7.9-3.45-1.04-6-3.85-6-7.9v-4.6L10 2.75Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m7.75 10.25 1.5 1.5 3.25-3.25"
        />
      </svg>
    );
  }
  if (option === "LEADER") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className={className}
      >
        <circle cx="8" cy="6.75" r="2.75" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.25 16c.8-2.3 2.65-3.5 4.75-3.5s3.95 1.2 4.75 3.5"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m14.5 5.25.65 1.35 1.48.22-1.07 1.04.25 1.47-1.31-.69-1.31.69.25-1.47-1.07-1.04 1.48-.22.65-1.35Z"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
    >
      <circle cx="10" cy="6.75" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 16.25c.9-2.6 3.05-4 5.5-4s4.6 1.4 5.5 4"
      />
    </svg>
  );
}

export default function OrganizationInvitationCreateDialog({
  isOpen,
  canSend,
  hasPermission = true,
  isPending,
  isSuccess = false,
  error,
  organizationId,
  organizationName,
  allowedRoles = ["MEMBER", "ADMIN"],
  hideRoleSelector = false,
  existingMemberEmails = [],
  existingPendingInvitationEmails = [],
  onClose,
  onInviteAnother,
  onClearError,
  onViewInvitation,
  onViewMember,
  onSubmit,
}: {
  isOpen: boolean;
  canSend: boolean;
  hasPermission?: boolean;
  isPending: boolean;
  isSuccess?: boolean;
  error?: unknown;
  organizationId?: string;
  organizationName?: string;
  allowedRoles?: readonly OrganizationRoleCode[];
  hideRoleSelector?: boolean;
  existingMemberEmails?: readonly string[];
  existingPendingInvitationEmails?: readonly string[];
  onClose: () => void;
  onInviteAnother?: () => void;
  onClearError?: () => void;
  onViewInvitation?: (email: string) => void;
  onViewMember?: (email: string) => void;
  onSubmit: (input: InviteMemberInput) => void;
}) {
  const t = useTranslations("organizationMembers");
  const defaultRole: OrganizationRoleCode = allowedRoles.includes("MEMBER")
    ? "MEMBER"
    : (allowedRoles[0] ?? "MEMBER");

  const [email, setEmail] = useState("");
  const [emailChips, setEmailChips] = useState<string[]>([]);
  const [emailTouched, setEmailTouched] = useState(false);
  const [roleCode, setRoleCode] = useState<OrganizationRoleCode | "">(defaultRole);
  const [visualRole, setVisualRole] = useState<VisualRoleOption>(
    defaultRole === "ADMIN" ? "MANAGER" : "MEMBER",
  );
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleTouched, setRoleTouched] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectsTouched, setProjectsTouched] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [expiresInDays] = useState<InvitationExpiryDays>(7);
  const [reasonCode, setReasonCode] =
    useState<InviteMemberInput["reasonCode"] | "">("ACCESS_REQUEST");
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmittedEmail, setLastSubmittedEmail] = useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [localConflictState, setLocalConflictState] =
    useState<SpecialConflictState>(null);

  const titleId = useId();
  const descriptionId = useId();
  const emailErrorId = useId();
  const roleErrorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const hasError = error !== undefined && error !== null;
  const projectsQuery = useActiveOrganizationProjects(
    organizationId ?? "",
    isOpen && visualRole === "LEADER",
  );

  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus(),
    );
    return () => {
      window.cancelAnimationFrame(frame);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!roleDropdownOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [roleDropdownOpen]);

  const normalizedEmail = email.trim().toLowerCase();
  const allEmails = Array.from(new Set([...emailChips, ...(normalizedEmail ? [normalizedEmail] : [])]));
  const _unusedAllEmails =
    emailChips.length > 0
      ? [
          ...emailChips,
          ...(normalizedEmail ? [normalizedEmail] : []),
        ]
      : normalizedEmail
        ? [normalizedEmail]

        : [];
  void _unusedAllEmails;

  const primaryEmail = allEmails[0] ?? "";
  const isMultiMode = emailChips.length > 0;

  const isEmailValid =
    allEmails.length > 0 &&
    allEmails.every(
      (item) => item.length > 0 && item.length <= 254 && EMAIL_PATTERN.test(item),
    );
  const showFormatEmailError = (emailTouched || submitted) && !isEmailValid;
  const serverIneligibleError = hasError && isIneligibleAccountError(error);
  const showEmailError = showFormatEmailError || serverIneligibleError;

  const effectiveRoleHidden = hideRoleSelector || allowedRoles.length === 0;
  const isRoleValid =
    effectiveRoleHidden || roleCode === "MEMBER" || roleCode === "ADMIN";
  const showRoleError = !effectiveRoleHidden && (roleTouched || submitted) && !isRoleValid;

  const isReasonValid =
    reasonCode === "ACCESS_REQUEST" || reasonCode === "ACCESS_REVIEW";

  const canSubmitForm =
    canSend &&
    !isPending &&
    !serverIneligibleError &&
    isEmailValid &&
    isRoleValid &&
    isReasonValid &&
    (visualRole !== "LEADER" ||
      (projectsQuery.isComplete && selectedProjectIds.length > 0));

  const serverConflictState = detectConflictKind(error);
  const activeConflictState = localConflictState ?? serverConflictState;
  const isForbiddenState =
    !hasPermission || (error instanceof ApiError && error.status === 403);

  function resetFormState() {
    setEmail("");
    setEmailChips([]);
    setEmailTouched(false);
    setRoleCode(defaultRole);
    setVisualRole(defaultRole === "ADMIN" ? "MANAGER" : "MEMBER");
    setRoleDropdownOpen(false);
    setRoleTouched(false);
    setSelectedProjectIds([]);
    setProjectsTouched(false);
    setMessage("");
    setMessageOpen(false);
    setReasonCode("ACCESS_REQUEST");
    setSubmitted(false);
    setLastSubmittedEmail("");
    setConfirmCloseOpen(false);
    setLocalConflictState(null);
  }

  function handleInviteAnother() {
    resetFormState();
    onInviteAnother?.();
  }

  function handleClearEmail() {
    setEmail("");
    setEmailChips([]);
    setEmailTouched(false);
    setSubmitted(false);
    setLocalConflictState(null);
    if (hasError) onClearError?.();
  }

  function commitChipsFromRaw(raw: string) {
    const parts = raw
      .split(/[\s,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    setEmailChips((prev) => {
      const next = [...prev];
      for (const part of parts) {
        if (!next.includes(part)) next.push(part);
      }
      return next;
    });
    setEmail("");
  }

  function handleEmailKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "," || event.key === "Enter") && email.includes("@")) {
      if (event.key === ",") {
        event.preventDefault();
        commitChipsFromRaw(email);
      }
    } else if (
      event.key === "Backspace" &&
      email.length === 0 &&
      emailChips.length > 0
    ) {
      setEmailChips((prev) => prev.slice(0, -1));
    }
  }

  function handleEmailPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (pasted && /[,\n;]/.test(pasted)) {
      event.preventDefault();
      commitChipsFromRaw(pasted);
    }
  }

  function selectVisualRole(option: VisualRoleOption) {
    setVisualRole(option);
    if (option !== "LEADER") setSelectedProjectIds([]);
    setRoleTouched(true);
    setRoleCode(option === "MANAGER" ? "ADMIN" : "MEMBER");
    setRoleDropdownOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setEmailTouched(true);
    setRoleTouched(true);
    setProjectsTouched(true);
    if (!canSubmitForm || !reasonCode) return;
    const resolvedRole: OrganizationRoleCode = effectiveRoleHidden
      ? "MEMBER"
      : (roleCode || "MEMBER");

    const normalizedMemberSet = new Set(
      existingMemberEmails.map((item) => item.trim().toLowerCase()),
    );
    const normalizedInviteSet = new Set(
      existingPendingInvitationEmails.map((item) => item.trim().toLowerCase()),
    );

    const conflictingMemberEmail = allEmails.find((item) => normalizedMemberSet.has(item)) ?? primaryEmail;
    if (allEmails.some((item) => normalizedMemberSet.has(item))) {

      setLastSubmittedEmail(conflictingMemberEmail);
      setLocalConflictState("ALREADY_MEMBER");
      return;
    }
    const conflictingInviteEmail = allEmails.find((item) => normalizedInviteSet.has(item)) ?? primaryEmail;
    if (allEmails.some((item) => normalizedInviteSet.has(item))) {

      setLastSubmittedEmail(conflictingInviteEmail);
      setLocalConflictState("ALREADY_INVITED");
      return;
    }

    const trimmedMessage = message.trim();
    setLastSubmittedEmail(allEmails.join(", "));

    onSubmit({
      email: primaryEmail,
      reasonCode,
      roleCode: resolvedRole,
      ...(allEmails.length > 1 ? { emails: allEmails } : {}),
      ...(visualRole === "LEADER" ? { projectRoleCode: "TEAM_LEADER" as const } : {}),
      accessScope: visualRole === "LEADER" ? "SPECIFIC_PROJECTS" : "ORGANIZATION",
      ...(visualRole === "LEADER" ? { projectIds: selectedProjectIds } : {}),
      ...(trimmedMessage ? { message: trimmedMessage } : {}),
      expiresInDays,
    });
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
      "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)",
    );
    if (!elements?.length) return;
    const visibleElements = Array.from(elements).filter(
      (element) => element.offsetParent !== null,
    );
    if (!visibleElements.length) return;
    const first = visibleElements[0];
    const last = visibleElements[visibleElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropClose() {
    if (isPending) return;
    if (isSuccess || isForbiddenState || activeConflictState !== null) {
      onClose();
      return;
    }
    setConfirmCloseOpen(true);
  }

  const descriptionText = isMultiMode
    ? t("inviteModalMultipleSubtitle")
    : organizationName
      ? t("inviteDescriptionNamed", { organization: organizationName })
      : t("inviteModalSubtitle");

  const visualRoleLabel =
    visualRole === "MANAGER"
      ? t("inviteRoleManagerOption")
      : visualRole === "LEADER"
        ? t("inviteRoleLeaderOption")
        : t("inviteRoleOptionMember");

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleBackdropClose}
      onBackdropClick={handleBackdropClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[440px]"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("inviteTitle")}
        aria-describedby={descriptionId}
        aria-busy={isPending}
        onKeyDown={trapFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Outside-click Cancel Confirmation Overlay */}
        {confirmCloseOpen && !isPending && !isSuccess && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-confirm-dismiss-title`}
            aria-describedby={`${titleId}-confirm-dismiss-desc`}
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
                    id={`${titleId}-confirm-dismiss-title`}
                    className="text-base font-semibold text-gray-900 dark:text-white/90"
                  >
                    {t("confirmDismissInviteTitle")}
                  </h3>
                  <p
                    id={`${titleId}-confirm-dismiss-desc`}
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
        )}

        {/* Screen 10: Không đủ quyền mời */}
        {isForbiddenState ? (
          <div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
            <div
              role="alert"
              className="flex flex-col items-center py-4 text-center"
            >
              <span
                aria-hidden="true"
                className="mb-4 flex size-14 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/10 dark:text-error-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-7"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M5.7 5.7l12.6 12.6" />
                </svg>
              </span>
              <h2
                id={titleId}
                className="text-base font-semibold text-gray-900 dark:text-white/90"
              >
                {t("inviteNoPermissionTitle")}
              </h2>
              <p
                id={descriptionId}
                className="mt-1.5 max-w-xs text-xs leading-5 text-gray-500 dark:text-gray-400"
              >
                {t("inviteNoPermissionDesc")}
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {t("close")}
              </Button>
            </div>
          </div>
        ) : activeConflictState === "ALREADY_INVITED" ? (
          /* Screen 9A: Trạng thái đặc biệt — Account already invited */
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600 ring-4 ring-warning-50/60 dark:bg-warning-500/15 dark:text-warning-400"
                >
                  <RoleOptionIcon option="MEMBER" className="size-5" />
                </span>
                <div>
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-gray-900 dark:text-white/90"
                  >
                    {t("inviteAlreadyInvitedTitle")}
                  </h2>
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm text-gray-600 dark:text-gray-300"
                  >
                    {t("inviteAlreadyInvitedDesc")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLocalConflictState(null);
                  if (hasError) onClearError?.();
                  onClose();
                }}
              >
                {t("close")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const targetEmail = lastSubmittedEmail || primaryEmail;
                  setLocalConflictState(null);
                  if (hasError) onClearError?.();
                  if (onViewInvitation) {
                    onViewInvitation(targetEmail);
                  } else {
                    onClose();
                  }
                }}
              >
                {t("inviteViewInvitation")}
              </Button>
            </div>
          </div>
        ) : activeConflictState === "ALREADY_MEMBER" ? (
          /* Screen 9B: Trạng thái đặc biệt — Account already a member */
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-4 ring-brand-50/60 dark:bg-brand-500/15 dark:text-brand-400"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                    i
                  </span>
                </span>
                <div>
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-gray-900 dark:text-white/90"
                  >
                    {t("inviteAlreadyMemberTitle")}
                  </h2>
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm text-gray-600 dark:text-gray-300"
                  >
                    {t("inviteAlreadyMemberDesc")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLocalConflictState(null);
                  if (hasError) onClearError?.();
                  onClose();
                }}
              >
                {t("close")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const targetEmail = lastSubmittedEmail || primaryEmail;
                  setLocalConflictState(null);
                  if (hasError) onClearError?.();
                  if (onViewMember) {
                    onViewMember(targetEmail);
                  } else {
                    onClose();
                  }
                }}
              >
                {t("inviteViewMember")}
              </Button>
            </div>
          </div>
        ) : isSuccess ? (
          /* Screen 5: Gửi thành công */
          <div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center py-5 text-center"
            >
              <span
                aria-hidden="true"
                className="mb-4 flex size-16 items-center justify-center rounded-full bg-success-50 dark:bg-success-500/10"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-success-500 text-white shadow-sm">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-6"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42 0l-3.75-3.775a1 1 0 1 1 1.42-1.408l3.04 3.06 6.54-6.585a1 1 0 0 1 1.414-.006Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </span>
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900 dark:text-white/90"
              >
                {t("inviteSuccessTitle")}
              </h2>
              <p
                id={descriptionId}
                className="mt-1.5 text-sm leading-5 text-gray-600 dark:text-gray-300"
              >
                {t("inviteSuccessMessage", {
                  email: lastSubmittedEmail || primaryEmail,
                })}
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button
                type="button"
                variant="outline"
                aria-label={t("inviteAnother")}
                className="w-full justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                onClick={handleInviteAnother}
              >
                {t("inviteAnotherMember")}
              </Button>
              <Button
                type="button"
                className="w-full justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                onClick={onClose}
              >
                {t("inviteDone")}
              </Button>
            </div>
          </div>
        ) : (
          /* Screens 1, 2, 3, 4, 6, 7, 8: Main Invite Form */
          <>
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id={titleId}
                  className="text-xl font-semibold text-gray-900 dark:text-white/90"
                >
                  {isMultiMode
                    ? t("inviteModalMultipleHeading")
                    : t("inviteModalHeading")}
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400"
                >
                  {descriptionText}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                aria-label={t("close")}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>

            {!canSend && (
              <p
                role="status"
                aria-live="polite"
                className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-xs leading-5 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400"
              >
                {t("inviteReadinessBlocked")}
              </p>
            )}

            {/* Non-ineligible, non-conflict server error fallback */}
            {hasError &&
              !serverIneligibleError &&
              activeConflictState === null && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                >
                  <p className="font-semibold">{t("inviteErrorTitle")}</p>
                  <p className="mt-0.5">{t(getErrorMessageKey(error))}</p>
                </div>
              )}

            <form onSubmit={submit} noValidate className="space-y-4">
              {/* 1. Email address(es) * */}
              <div>
                <Label htmlFor="organization-invite-email">
                  {isMultiMode
                    ? t("inviteMultipleEmailsLabel")
                    : t("inviteEmailLabel")}{" "}
                  {!isMultiMode && (
                    <span aria-hidden="true" className="text-error-500">
                      *
                    </span>
                  )}
                </Label>

                <div
                  className={`mt-1.5 flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-white px-3.5 py-1.5 shadow-theme-xs transition focus-within:ring-3 dark:bg-gray-900 ${
                    showEmailError
                      ? "border-error-500 focus-within:border-error-500 focus-within:ring-error-500/10 dark:border-error-500"
                      : "border-gray-300 focus-within:border-brand-300 focus-within:ring-brand-500/10 dark:border-gray-700"
                  }`}
                >
                  {!isMultiMode && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="size-4 shrink-0 text-gray-400"
                    >
                      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m3.5 6 6.5 4.5L16.5 6"
                      />
                    </svg>
                  )}

                  {emailChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-gray-800 dark:bg-brand-500/15 dark:text-gray-200"
                    >
                      <span>{chip}</span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          setEmailChips((prev) =>
                            prev.filter((item) => item !== chip),
                          )
                        }
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-white"
                        aria-label={`Remove ${chip}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <input
                    id="organization-invite-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required={emailChips.length === 0}
                    value={email}
                    disabled={isPending}
                    placeholder={
                      isMultiMode
                        ? t("inviteMultipleEmailsPlaceholder")
                        : t("emailPlaceholder")
                    }
                    aria-invalid={showEmailError}
                    aria-describedby={showEmailError ? emailErrorId : undefined}
                    onBlur={() => setEmailTouched(true)}
                    onKeyDown={handleEmailKeyDown}
                    onPaste={handleEmailPaste}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (localConflictState) setLocalConflictState(null);
                      if (hasError) onClearError?.();
                    }}
                    className="min-w-[140px] flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden disabled:opacity-60 dark:text-white/90 dark:placeholder:text-gray-500"
                  />

                  {(email.length > 0 || emailChips.length > 0) && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleClearEmail}
                      aria-label={t("inviteClearEmail")}
                      className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      <span aria-hidden="true" className="text-base leading-none">
                        ×
                      </span>
                    </button>
                  )}
                </div>

                {/* Screen 3: Checking account... status bar */}
                {isPending ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-2 flex items-center gap-2.5 rounded-xl bg-brand-50/80 px-3.5 py-2 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    <span
                      aria-hidden="true"
                      className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
                    />
                    <span>{t("inviteCheckingAccount")}</span>
                    <span className="sr-only">{t("inviting")}</span>
                  </div>
                ) : showEmailError ? (
                  /* Screen 4: Validation / Ineligible account inline alert */
                  <div
                    id={emailErrorId}
                    role="alert"
                    className="mt-2 flex items-start gap-2 rounded-xl bg-error-50/90 px-3.5 py-2.5 text-xs font-medium leading-5 text-error-600 dark:bg-error-500/10 dark:text-error-400"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="mt-0.5 size-4 shrink-0 text-error-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5Zm0 7.25a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <span>
                        {serverIneligibleError
                          ? t("inviteIneligibleInline")
                          : t("inviteEmailInvalid")}
                      </span>
                      {serverIneligibleError && (
                        <>
                          <span className="sr-only">
                            {t("inviteIneligibleTitle")}
                          </span>
                          <span className="sr-only">
                            {t("inviteIneligibleSubtitle")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {isMultiMode
                      ? t("inviteMultipleEmailsHelp")
                      : t("inviteEmailHelpShort")}
                  </p>
                )}
              </div>

              {/* 2. Role * (Hidden in Screen 7 when hideRoleSelector is true) */}
              {!effectiveRoleHidden && (
                <div ref={roleDropdownRef} className="relative">
                  <Label htmlFor="organization-invite-role">
                    {t("inviteRoleLabel")}{" "}
                    <span aria-hidden="true" className="text-error-500">
                      *
                    </span>
                  </Label>

                  {/* Accessible native select for screen readers & automated tests */}
                  <select
                    id="organization-invite-role"
                    name="roleCode"
                    required
                    value={roleCode}
                    disabled={isPending}
                    aria-invalid={showRoleError}
                    aria-describedby={showRoleError ? roleErrorId : undefined}
                    onBlur={() => setRoleTouched(true)}
                    onChange={(event) => {
                      const nextRole = event.target.value as
                        | OrganizationRoleCode
                        | "";
                      setRoleTouched(true);
                      if (event.target.value === "LEADER") {
                        setRoleCode("MEMBER");
                        setVisualRole("LEADER");
                      } else {
                        setRoleCode(nextRole);
                        if (nextRole === "ADMIN") {
                          setVisualRole("MANAGER");
                        } else if (nextRole === "MEMBER") {
                          setVisualRole("MEMBER");
                        }
                      }
                    }}
                    className="sr-only"
                  >
                    <option value="">{t("inviteRolePlaceholder")}</option>
                    {allowedRoles.includes("MEMBER") && (
                      <option value="MEMBER">
                        {t("inviteRoleOptionMember")}
                      </option>
                    )}
                    {allowedRoles.includes("ADMIN") && (
                      <>
                        <option value="ADMIN">
                          {t("inviteRoleManagerOption")}
                        </option>
                        <option value="LEADER">
                          {t("inviteRoleLeaderOption")}
                        </option>
                      </>
                    )}
                  </select>

                  {/* Screen 1 & 2: Visual custom Role trigger */}
                  <button
                    type="button"
                    disabled={isPending}
                    aria-expanded={roleDropdownOpen}
                    aria-haspopup="listbox"
                    onClick={() => setRoleDropdownOpen((prev) => !prev)}
                    className={`mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-sm text-gray-900 shadow-theme-xs transition focus:ring-3 focus:outline-hidden disabled:opacity-60 dark:bg-gray-900 dark:text-white/90 ${
                      showRoleError
                        ? "border-error-500 focus:border-error-500 focus:ring-error-500/10"
                        : "border-gray-300 hover:border-gray-400 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <RoleOptionIcon
                        option={visualRole}
                        className="size-4 text-gray-500 dark:text-gray-400"
                      />
                      <span className="font-medium">
                        {roleCode ? visualRoleLabel : t("inviteRolePlaceholder")}
                      </span>
                    </span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`size-4 text-gray-500 transition-transform ${
                        roleDropdownOpen ? "rotate-180" : ""
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {/* Screen 2: Role dropdown menu */}
                  {roleDropdownOpen && (
                    <div
                      role="listbox"
                      aria-label={t("inviteRoleLabel")}
                      className="absolute inset-x-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                    >
                      {(
                        [
                          ...(allowedRoles.includes("MEMBER")
                            ? ([
                                {
                                  key: "MEMBER" as const,
                                  label: t("inviteRoleOptionMember"),
                                },
                              ] as const)
                            : []),
                          ...(allowedRoles.includes("ADMIN")
                            ? ([
                                {
                                  key: "MANAGER" as const,
                                  label: t("inviteRoleManagerOption"),
                                },
                                {
                                  key: "LEADER" as const,
                                  label: t("inviteRoleLeaderOption"),
                                },
                              ] as const)
                            : []),
                        ] as const
                      ).map((item) => {
                        const selected =
                          roleCode !== "" && visualRole === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => selectVisualRole(item.key)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                              selected
                                ? "bg-brand-500 text-white"
                                : "text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <RoleOptionIcon
                                option={item.key}
                                className={`size-4 ${
                                  selected
                                    ? "text-white"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              />
                              <span>{item.label}</span>
                            </span>
                            {selected && (
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="size-4 text-white"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42 0l-3.75-3.775a1 1 0 1 1 1.42-1.408l3.04 3.06 6.54-6.585a1 1 0 0 1 1.414-.006Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showRoleError ? (
                    <p
                      id={roleErrorId}
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-error-600 dark:text-error-400"
                    >
                      {t("inviteRoleRequired")}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {t("inviteRoleAfterAcceptHelp")}
                    </p>
                  )}
                </div>
              )}

              {visualRole === "LEADER" && !effectiveRoleHidden && (
                <fieldset className="space-y-2" aria-describedby={projectsTouched && selectedProjectIds.length === 0 ? "invite-project-error" : undefined}>
                  <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("inviteSelectProjects")} <span aria-hidden="true" className="text-error-500">*</span>
                  </legend>
                  {projectsQuery.isPending ? (
                    <p role="status" className="text-xs text-gray-500 dark:text-gray-400">{t("inviteProjectsLoading")}</p>
                  ) : projectsQuery.isError ? (
                    <div role="alert" className="text-xs text-error-600 dark:text-error-400">
                      {t("loadError")}{" "}
                      <button type="button" className="font-medium underline" onClick={() => void projectsQuery.refetch()}>{t("retryLoad")}</button>
                    </div>
                  ) : projectsQuery.projects.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t("inviteProjectsEmpty")}</p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
                      {projectsQuery.projects.map((project) => (
                        <label key={project.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                          <input
                            type="checkbox"
                            checked={selectedProjectIds.includes(project.id)}
                            disabled={isPending || (!selectedProjectIds.includes(project.id) && selectedProjectIds.length >= 50)}
                            onChange={(event) => {
                              setProjectsTouched(true);
                              setSelectedProjectIds((ids) => event.target.checked
                                ? [...ids, project.id]
                                : ids.filter((id) => id !== project.id));
                            }}
                            className="accent-brand-500"
                          />
                          <span className="min-w-0 truncate">{project.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {projectsTouched && selectedProjectIds.length === 0 && (
                    <p id="invite-project-error" role="alert" className="text-xs font-medium text-error-600 dark:text-error-400">{t("inviteProjectsRequired")}</p>
                  )}
                </fieldset>
              )}

              {/* Screen 6: Collapsible Message to recipient (optional) */}
              <div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    aria-expanded={messageOpen}
                    onClick={() => setMessageOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between py-0.5 text-left text-xs font-medium text-gray-700 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    <Label
                      htmlFor="organization-invite-message"
                      className="mb-0 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      {t("inviteMessageLabel")}
                    </Label>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`size-4 text-gray-400 transition-transform ${
                        messageOpen ? "rotate-180" : ""
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                <div className={messageOpen ? "mt-2" : "sr-only"}>
                  <textarea
                    id="organization-invite-message"
                    name="message"
                    rows={2}
                    maxLength={500}
                    value={message}
                    disabled={isPending}
                    placeholder={t("inviteMessageShortPlaceholder")}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      if (!messageOpen && event.target.value.length > 0) {
                        setMessageOpen(true);
                      }
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-theme-xs transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                  />
                  <div className="mt-1 flex justify-end">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {message.length}/500
                    </span>
                  </div>
                </div>
              </div>

              {/* Accessible Reason control (preserves contract & unit tests) */}
              <div className="sr-only">
                <Label htmlFor="organization-invite-reason">
                  {t("reason")}
                </Label>
                <select
                  id="organization-invite-reason"
                  name="reasonCode"
                  required
                  value={reasonCode}
                  disabled={isPending}
                  onChange={(event) =>
                    setReasonCode(
                      event.target.value as InviteMemberInput["reasonCode"] | "",
                    )
                  }
                >
                  <option value="">{t("selectReason")}</option>
                  <option value="ACCESS_REQUEST">{t("accessRequest")}</option>
                  <option value="ACCESS_REVIEW">{t("accessReview")}</option>
                </select>
              </div>

              {/* Blue Info Callout Box */}
              <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/80 px-3.5 py-3 text-xs leading-5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white"
                >
                  i
                </span>
                <div>
                  <p>
                    {isMultiMode
                      ? t("inviteInfoMultipleLine1")
                      : t("inviteInfoShortLine1")}
                  </p>
                  <p>
                    {isMultiMode
                      ? t("inviteInfoMultipleLine2")
                      : t("inviteInfoShortLine2")}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  disabled={isPending}
                  onClick={onClose}
                >
                  {t("inviteCancel")}
                </Button>
                <Button
                  type="submit"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  disabled={!canSubmitForm}
                >
                  {isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                      />
                      <span>{t("inviteSendingButton")}</span>
                    </span>
                  ) : isMultiMode ? (
                    t("sendInvites")
                  ) : (
                    t("sendInvite")
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
