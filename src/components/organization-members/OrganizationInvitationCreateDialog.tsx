"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api-client";
import { useProjectsQuery } from "@/lib/queries/projects/useProjects";
import type {
  InvitationAccessScope,
  InvitationExpiryDays,
  InviteMemberInput,
  OrganizationRoleCode,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    error.code === "INVITATION_TARGET_NOT_ELIGIBLE"
  );
}

function InlineErrorText({ id, message }: { id?: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-error-600 dark:text-error-400"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="size-3.5 shrink-0 text-error-500"
      >
        <path
          fillRule="evenodd"
          d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5Zm0 7.25a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </p>
  );
}

export default function OrganizationInvitationCreateDialog({
  isOpen,
  canSend,
  isPending,
  isSuccess = false,
  error,
  organizationId = "",
  organizationName,
  allowedRoles = ["MEMBER", "ADMIN"],
  onClose,
  onInviteAnother,
  onClearError,
  onSubmit,
}: {
  isOpen: boolean;
  canSend: boolean;
  isPending: boolean;
  isSuccess?: boolean;
  error?: unknown;
  organizationId?: string;
  organizationName?: string;
  allowedRoles?: readonly OrganizationRoleCode[];
  onClose: () => void;
  onInviteAnother?: () => void;
  onClearError?: () => void;
  onSubmit: (input: InviteMemberInput) => void;
}) {
  const t = useTranslations("organizationMembers");
  const defaultRole: OrganizationRoleCode = allowedRoles.includes("MEMBER")
    ? "MEMBER"
    : (allowedRoles[0] ?? "MEMBER");

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [roleCode, setRoleCode] = useState<OrganizationRoleCode | "">(defaultRole);
  const [roleTouched, setRoleTouched] = useState(false);
  const [accessScope, setAccessScope] = useState<InvitationAccessScope>("ORGANIZATION");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<InvitationExpiryDays>(7);
  const [requireApproval, setRequireApproval] = useState(false);
  const [reasonCode, setReasonCode] = useState<InviteMemberInput["reasonCode"] | "">("ACCESS_REQUEST");
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmittedEmail, setLastSubmittedEmail] = useState("");

  const titleId = useId();
  const descriptionId = useId();
  const emailErrorId = useId();
  const roleErrorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const hasError = error !== undefined && error !== null;

  const projectsQuery = useProjectsQuery(
    isOpen && accessScope === "SPECIFIC_PROJECTS" ? organizationId : "",
    { page: 1, pageSize: 50, status: "ACTIVE" },
  );
  const availableProjects = projectsQuery.data?.data ?? [];

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

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid =
    normalizedEmail.length > 0 &&
    normalizedEmail.length <= 254 &&
    EMAIL_PATTERN.test(normalizedEmail);
  const showEmailError = (emailTouched || submitted) && !isEmailValid;

  const isRoleValid = roleCode === "MEMBER" || roleCode === "ADMIN";
  const showRoleError = (roleTouched || submitted) && !isRoleValid;

  const isProjectsValid =
    accessScope === "ORGANIZATION" || selectedProjectIds.length > 0;
  const showProjectsError = submitted && !isProjectsValid;

  const isReasonValid =
    reasonCode === "ACCESS_REQUEST" || reasonCode === "ACCESS_REVIEW";

  const canSubmitForm =
    canSend &&
    !isPending &&
    isEmailValid &&
    isRoleValid &&
    isProjectsValid &&
    isReasonValid;

  function resetFormState() {
    setEmail("");
    setEmailTouched(false);
    setRoleCode(defaultRole);
    setRoleTouched(false);
    setAccessScope("ORGANIZATION");
    setSelectedProjectIds([]);
    setProjectDropdownOpen(false);
    setMessage("");
    setAdvancedOpen(false);
    setExpiresInDays(7);
    setRequireApproval(false);
    setReasonCode("ACCESS_REQUEST");
    setSubmitted(false);
    setLastSubmittedEmail("");
  }

  function handleInviteAnother() {
    resetFormState();
    onInviteAnother?.();
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setEmailTouched(true);
    setRoleTouched(true);
    if (!canSubmitForm || !roleCode || !reasonCode) return;

    const trimmedMessage = message.trim();
    setLastSubmittedEmail(normalizedEmail);
    onSubmit({
      email: normalizedEmail,
      reasonCode,
      roleCode,
      accessScope,
      ...(accessScope === "SPECIFIC_PROJECTS" && selectedProjectIds.length > 0
        ? { projectIds: selectedProjectIds }
        : {}),
      ...(trimmedMessage ? { message: trimmedMessage } : {}),
      expiresInDays,
      ...(requireApproval ? { requireApproval: true } : {}),
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

  const descriptionText = organizationName
    ? t("inviteDescriptionNamed", { organization: organizationName })
    : t("inviteDescription");

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isPending) onClose();
      }}
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
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900 sm:p-7"
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-gray-900 dark:text-white/90"
            >
              {t("inviteTitle")}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300"
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

        {/* State 3: Sending state */}
        {isPending ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-10 text-center"
          >
            <span
              aria-hidden="true"
              className="mb-4 size-10 animate-spin rounded-full border-3 border-brand-500 border-t-transparent"
            />
            <p className="text-base font-semibold text-gray-900 dark:text-white/90">
              {t("inviteSendingTitle")}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("inviteSendingSubtitle")}
            </p>
            <span className="sr-only">{t("inviting")}</span>
          </div>
        ) : isSuccess ? (
          /* State 4: Success state */
          <div>
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center py-6 text-center"
            >
              <span
                aria-hidden="true"
                className="mb-4 flex size-12 items-center justify-center rounded-full bg-success-500 text-white shadow-sm"
              >
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
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
                {t("inviteSuccessTitle")}
              </h3>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                {t("inviteSuccessMessage", {
                  email: lastSubmittedEmail || normalizedEmail,
                })}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
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
                onClick={handleInviteAnother}
              >
                {t("inviteAnother")}
              </Button>
            </div>
          </div>
        ) : hasError ? (
          /* State 5: Server error / Ineligible account state */
          <div>
            <div
              role="alert"
              className="my-2 rounded-xl border border-error-200 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/10"
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
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    {isIneligibleAccountError(error)
                      ? t("inviteIneligibleTitle")
                      : t("inviteErrorTitle")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
                    {isIneligibleAccountError(error)
                      ? t("inviteIneligibleSubtitle")
                      : t(getErrorMessageKey(error))}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
              {onClearError && (
                <Button
                  type="button"
                  variant="outline"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  onClick={onClearError}
                >
                  {t("inviteBackToForm")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                onClick={onClose}
              >
                {t("close")}
              </Button>
            </div>
          </div>
        ) : (
          /* States 1 & 2: Default form & Validation error state */
          <>
            {!canSend && (
              <p
                role="status"
                aria-live="polite"
                className="mb-5 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm leading-6 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400"
              >
                {t("inviteReadinessBlocked")}
              </p>
            )}

            <form onSubmit={submit} noValidate className="space-y-4">
              {/* 1. Email address * */}
              <div>
                <Label htmlFor="organization-invite-email">
                  {t("inviteEmailLabel")}{" "}
                  <span aria-hidden="true" className="text-error-500">
                    *
                  </span>
                </Label>
                <Input
                  id="organization-invite-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  error={showEmailError}
                  disabled={isPending}
                  placeholder={t("emailPlaceholder")}
                  aria-invalid={showEmailError}
                  aria-describedby={showEmailError ? emailErrorId : undefined}
                  onBlur={() => setEmailTouched(true)}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {showEmailError ? (
                  <InlineErrorText
                    id={emailErrorId}
                    message={t("inviteEmailInvalid")}
                  />
                ) : (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {t("inviteEmailHelp")}
                  </p>
                )}
              </div>

              {/* 2. Role * */}
              <div>
                <Label htmlFor="organization-invite-role">
                  {t("inviteRoleLabel")}{" "}
                  <span aria-hidden="true" className="text-error-500">
                    *
                  </span>
                </Label>
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
                    setRoleTouched(true);
                    setRoleCode(
                      event.target.value as OrganizationRoleCode | "",
                    );
                  }}
                  className={`h-11 w-full cursor-pointer rounded-lg border bg-white px-3.5 text-sm text-gray-800 shadow-theme-xs transition focus:ring-3 focus:outline-hidden disabled:opacity-50 dark:bg-gray-900 dark:text-gray-200 ${
                    showRoleError
                      ? "border-error-500 focus:border-error-500 focus:ring-error-500/10 dark:border-error-500"
                      : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700"
                  }`}
                >
                  <option value="">{t("inviteRolePlaceholder")}</option>
                  {allowedRoles.includes("MEMBER") && (
                    <option value="MEMBER">{t("inviteRoleOptionMember")}</option>
                  )}
                  {allowedRoles.includes("ADMIN") && (
                    <option value="ADMIN">{t("inviteRoleOptionAdmin")}</option>
                  )}
                </select>
                {showRoleError ? (
                  <InlineErrorText
                    id={roleErrorId}
                    message={t("inviteRoleRequired")}
                  />
                ) : (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("inviteRoleHelp")}
                    </p>
                    {roleCode && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {roleCode === "ADMIN"
                          ? t("inviteRoleAdminDesc")
                          : t("inviteRoleMemberDesc")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Access scope */}
              <fieldset className="space-y-2.5">
                <legend className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("inviteAccessScopeLabel")}
                </legend>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    name="accessScope"
                    value="ORGANIZATION"
                    checked={accessScope === "ORGANIZATION"}
                    disabled={isPending}
                    onChange={() => {
                      setAccessScope("ORGANIZATION");
                      setProjectDropdownOpen(false);
                    }}
                    className="size-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{t("inviteScopeOrganization")}</span>
                </label>

                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="accessScope"
                      value="SPECIFIC_PROJECTS"
                      checked={accessScope === "SPECIFIC_PROJECTS"}
                      disabled={isPending}
                      onChange={() => setAccessScope("SPECIFIC_PROJECTS")}
                      className="size-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{t("inviteScopeSpecificProjects")}</span>
                    <span
                      title={t("inviteScopeProjectsHint")}
                      aria-label={t("inviteScopeProjectsHint")}
                      className="inline-flex size-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 dark:border-gray-600 dark:text-gray-400"
                    >
                      i
                    </span>
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      disabled={
                        isPending || accessScope !== "SPECIFIC_PROJECTS"
                      }
                      aria-expanded={
                        accessScope === "SPECIFIC_PROJECTS" &&
                        projectDropdownOpen
                      }
                      onClick={() =>
                        setProjectDropdownOpen((previous) => !previous)
                      }
                      className={`flex h-10 w-full items-center justify-between rounded-lg border px-3.5 text-left text-sm shadow-theme-xs transition ${
                        accessScope !== "SPECIFIC_PROJECTS"
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500"
                          : showProjectsError
                            ? "border-error-500 bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      <span className="truncate">
                        {selectedProjectIds.length > 0
                          ? t("inviteProjectsSelected", {
                              count: selectedProjectIds.length,
                            })
                          : t("inviteSelectProjects")}
                      </span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-4 shrink-0 text-gray-400"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {accessScope === "SPECIFIC_PROJECTS" &&
                      projectDropdownOpen && (
                        <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          {projectsQuery.isFetching ? (
                            <p className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                              {t("inviteProjectsLoading")}
                            </p>
                          ) : availableProjects.length === 0 ? (
                            <p className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                              {t("inviteProjectsEmpty")}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {availableProjects.map((project) => {
                                const checked = selectedProjectIds.includes(
                                  project.id,
                                );
                                return (
                                  <label
                                    key={project.id}
                                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleProjectSelection(project.id)
                                      }
                                      className="size-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className="font-medium">
                                      {project.name}
                                    </span>
                                    <span className="text-gray-400">
                                      ({project.code})
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                    {showProjectsError && (
                      <InlineErrorText message={t("inviteProjectsRequired")} />
                    )}
                  </div>
                </div>
              </fieldset>

              {/* 4. Message to recipient (optional) */}
              <div>
                <Label htmlFor="organization-invite-message">
                  {t("inviteMessageLabel")}
                </Label>
                <textarea
                  id="organization-invite-message"
                  name="message"
                  rows={2}
                  maxLength={500}
                  value={message}
                  disabled={isPending}
                  placeholder={t("inviteMessagePlaceholder")}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-theme-xs transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                />
                <div className="mt-1 flex justify-end">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {message.length}/500
                  </span>
                </div>
              </div>

              {/* 5. Advanced options (collapsible) */}
              <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                <button
                  type="button"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((previous) => !previous)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 transition hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-white/90"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className={`size-3.5 transition-transform ${
                      advancedOpen ? "rotate-90" : ""
                    }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t("inviteAdvancedOptions")}</span>
                </button>

                <div
                  className={
                    advancedOpen
                      ? "mt-3 space-y-3.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-800/40"
                      : "sr-only"
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="organization-invite-expiry">
                        {t("inviteExpiryLabel")}
                      </Label>
                      <select
                        id="organization-invite-expiry"
                        name="expiresInDays"
                        value={expiresInDays}
                        disabled={isPending}
                        onChange={(event) =>
                          setExpiresInDays(
                            Number(event.target.value) as InvitationExpiryDays,
                          )
                        }
                        className="h-10 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        <option value={7}>{t("inviteExpiry7Days")}</option>
                        <option value={14}>{t("inviteExpiry14Days")}</option>
                        <option value={30}>{t("inviteExpiry30Days")}</option>
                      </select>
                    </div>

                    <div>
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
                            event.target.value as
                              | InviteMemberInput["reasonCode"]
                              | "",
                          )
                        }
                        className="h-10 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-xs sm:text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        <option value="">{t("selectReason")}</option>
                        <option value="ACCESS_REQUEST">
                          {t("accessRequest")}
                        </option>
                        <option value="ACCESS_REVIEW">
                          {t("accessReview")}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {t("inviteTemplateLabel")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMessage(t("inviteTemplateWelcomeText"))
                        }
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      >
                        {t("inviteTemplateWelcome")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMessage(t("inviteTemplateProjectText"))
                        }
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      >
                        {t("inviteTemplateProject")}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={requireApproval}
                      disabled={isPending}
                      onChange={(event) =>
                        setRequireApproval(event.target.checked)
                      }
                      className="mt-0.5 size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <span className="block font-medium">
                        {t("inviteRequireApprovalLabel")}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("inviteRequireApprovalHelp")}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {/* 6. Additional Info Callout Box */}
              <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-3 text-xs leading-5 text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white"
                >
                  i
                </span>
                <div>
                  <p>{t("inviteInfoLine1")}</p>
                  <p>{t("inviteInfoLine2")}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
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
                  {t("sendInvite")}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
