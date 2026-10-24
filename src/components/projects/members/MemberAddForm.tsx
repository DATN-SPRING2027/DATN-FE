"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { SearchIcon } from "@/icons";
import {
  useProjectMemberCandidatesQuery,
  type ProjectMemberCandidate,
} from "@/lib/queries/projects/useProjectMembers";

export type ProjectMemberAddRole = "MEMBER" | "TEAM_LEADER";

export default function MemberAddForm({
  organizationId,
  projectId,
  onAdd,
  disabled,
  pending,
  defaultRole = "MEMBER",
  onRoleChange,
}: {
  organizationId?: string;
  projectId?: string;
  onAdd: (userId: string, role?: ProjectMemberAddRole) => void;
  disabled: boolean;
  pending: boolean;
  defaultRole?: ProjectMemberAddRole;
  onRoleChange?: (role: ProjectMemberAddRole) => void;
}) {
  const t = useTranslations("projectMembers");
  const [emailInput, setEmailInput] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [selectedCandidate, setSelectedCandidate] =
    useState<ProjectMemberCandidate | null>(null);
  const [selectedRole, setSelectedRole] =
    useState<ProjectMemberAddRole>(defaultRole);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRole(defaultRole);
  }, [defaultRole]);

  const trimmedEmail = emailInput.trim();
  const isValidEmailFormat =
    trimmedEmail.length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const isSearchReady =
    trimmedEmail.length > 0 &&
    isValidEmailFormat &&
    debouncedEmail === trimmedEmail;

  useEffect(() => {
    if (!trimmedEmail || !isValidEmailFormat) return;
    const timer = window.setTimeout(() => setDebouncedEmail(trimmedEmail), 250);
    return () => window.clearTimeout(timer);
  }, [isValidEmailFormat, trimmedEmail]);

  const {
    data: candidates = [],
    isFetching,
    isError,
  } = useProjectMemberCandidatesQuery(
    organizationId ?? "",
    projectId ?? "",
    isSearchReady ? debouncedEmail : undefined,
  );

  const visibleCandidates = useMemo(() => {
    if (!trimmedEmail || isSearchReady) return candidates;
    const lower = trimmedEmail.toLowerCase();
    return candidates.filter(
      (candidate) =>
        candidate.email.toLowerCase().includes(lower) ||
        (candidate.fullName &&
          candidate.fullName.toLowerCase().includes(lower)),
    );
  }, [candidates, isSearchReady, trimmedEmail]);

  function handleEmailChange(value: string) {
    setEmailInput(value);
    setValidationError(null);
    setSelectedCandidate(null);
  }

  function handleRoleChange(nextRole: ProjectMemberAddRole) {
    setSelectedRole(nextRole);
    onRoleChange?.(nextRole);
  }

  function handleSelectCandidate(candidate: ProjectMemberCandidate) {
    if (candidate.isProjectMember || disabled || pending) return;
    setSelectedCandidate(candidate);
    setValidationError(null);
  }

  function handleAdd(candidate?: ProjectMemberCandidate) {
    const target = candidate ?? selectedCandidate;
    if (disabled || pending) return;
    if (!target) {
      setValidationError(
        trimmedEmail ? t("selectCandidate") : t("requiredId"),
      );
      return;
    }

    if (target.isProjectMember) {
      setValidationError(t("alreadyInProject"));
      return;
    }

    if (selectedRole === "TEAM_LEADER") {
      onAdd(target.userId, "TEAM_LEADER");
    } else {
      onAdd(target.userId);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    handleAdd();
  }

  const showCandidateSection =
    trimmedEmail.length > 0 || visibleCandidates.length > 0 || isFetching;

  return (
    <form
      aria-label={t("add")}
      onSubmit={submit}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-col items-start gap-3 @xl:flex-row @xl:items-end">
        <div className="w-full min-w-0 flex-1">
          <Label htmlFor="project-member-email-search">
            {t("searchEmailLabel")}
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="project-member-email-search"
              type="email"
              value={emailInput}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder={t("candidateSearchPlaceholder")}
              disabled={disabled}
              aria-invalid={
                Boolean(validationError) ||
                (!isValidEmailFormat &&
                  trimmedEmail.length > 0 &&
                  visibleCandidates.length === 0)
              }
              aria-describedby={
                validationError
                  ? "member-search-error"
                  : isSearchReady && isError
                    ? "member-search-failure"
                    : "member-add-hint"
              }
              className="pl-10"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <SearchIcon aria-hidden="true" className="size-4" />
            </div>
          </div>
        </div>
        <div className="w-full @xl:w-44 shrink-0">
          <Label htmlFor="project-member-role-select">{t("role")}</Label>
          <select
            id="project-member-role-select"
            aria-label={t("role")}
            value={selectedRole}
            disabled={disabled || pending}
            onChange={(e) =>
              handleRoleChange(e.target.value as ProjectMemberAddRole)
            }
            className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="MEMBER">{t("projectMember")}</option>
            <option value="TEAM_LEADER">{t("projectLeaderBadge")}</option>
          </select>
        </div>
        <Button
          type="submit"
          disabled={disabled || pending}
          className="shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {t(pending ? "adding" : "add")}
        </Button>
      </div>

      {trimmedEmail.length > 0 &&
        !isValidEmailFormat &&
        visibleCandidates.length === 0 && (
          <p
            id="member-format-error"
            role="alert"
            className="text-xs text-amber-600 dark:text-amber-400"
          >
            {t("invalidEmail")}
          </p>
        )}

      {validationError && (
        <p
          id="member-search-error"
          role="alert"
          className="text-xs text-error-600 dark:text-error-400"
        >
          {validationError}
        </p>
      )}

      {showCandidateSection && (
        <div className="space-y-2">
          {isFetching && (
            <div className="flex items-center gap-2 p-3 text-sm text-gray-500 motion-safe:animate-pulse">
              <span className="size-4 border-2 border-brand-500 border-t-transparent rounded-full motion-safe:animate-spin" />
              <span>{t("searching")}</span>
            </div>
          )}

          {!isFetching && isError && trimmedEmail.length > 0 && (
            <p
              id="member-search-failure"
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 p-4 text-center text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              {t("searchFailed")}
            </p>
          )}

          {!isFetching &&
            !isError &&
            trimmedEmail.length > 0 &&
            visibleCandidates.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {t("noCandidates")}
              </div>
            )}

          {!isFetching && !isError && visibleCandidates.length > 0 && (
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {visibleCandidates.map((candidate) => {
                const isSelected =
                  selectedCandidate?.userId === candidate.userId;
                return (
                  <div
                    key={candidate.userId}
                    onClick={() => handleSelectCandidate(candidate)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                      candidate.isProjectMember
                        ? "border-gray-200 bg-gray-50/50 opacity-60 dark:border-gray-800 dark:bg-gray-800/30 cursor-not-allowed"
                        : isSelected
                          ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500 dark:bg-brand-500/10 cursor-pointer"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 cursor-pointer"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {candidate.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={candidate.avatarUrl}
                          alt={candidate.fullName || candidate.email}
                          className="size-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                        >
                          {(candidate.fullName || candidate.email)
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {candidate.fullName || candidate.email}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400">
                            <span className="size-1.5 rounded-full bg-success-500" />
                            {t("activeBadge")}
                          </span>
                        </div>
                        {candidate.fullName && (
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {candidate.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {candidate.isProjectMember ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {t("alreadyInProject")}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          type="button"
                          disabled={disabled || pending}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdd(candidate);
                          }}
                        >
                          {pending && isSelected ? t("adding") : t("add")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p
        id="member-add-hint"
        className="text-xs text-gray-500 dark:text-gray-400"
      >
        {t("addHint")}
      </p>
    </form>
  );
}
