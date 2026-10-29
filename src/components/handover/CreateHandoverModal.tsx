"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";
import { useProjectLeadersQuery } from "@/lib/queries/projects/useProjectLeaders";
import { useCreateHandoverMutation } from "@/lib/queries/handovers/useHandovers";
import {
  AlertIcon,
  ArrowRightIcon,
  CalenderIcon,
  CheckCircleIcon,
  HandShakeIcon,
} from "@/icons";
import HandoverDialogShell from "./HandoverDialogShell";
import HandoverMemberSelect, {
  type HandoverMemberOption,
} from "./HandoverMemberSelect";
import {
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
  formatUtcDate,
} from "./handover-ui.utils";

interface CreateHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: string;
  projectId: string;
  currentUserId?: string;
  members: readonly ProjectMembership[];
  isMembersLoading?: boolean;
  onCreated: (handoverId: string) => void;
}

type InvalidField =
  | "title"
  | "departing"
  | "coordinator"
  | "successor"
  | "targetDate"
  | null;

const PRESET_OFFSETS = [7, 14, 30] as const;

function utcDateOffsetInput(daysFromToday: number): string {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysFromToday,
  );
  return new Date(utcMidnight).toISOString().slice(0, 10);
}

function defaultTargetDateInput(): string {
  return utcDateOffsetInput(14);
}

function computeUtcDayDelta(dateInput: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return null;
  const parsed = new Date(`${dateInput}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((parsed.getTime() - todayUtcMs) / (24 * 60 * 60 * 1000));
}

function getMembershipRole(member: ProjectMembership): string | undefined {
  const maybeRole = (member as { role?: unknown }).role;
  return typeof maybeRole === "string" && maybeRole.trim().length > 0
    ? maybeRole.trim()
    : undefined;
}

function toMemberOption(
  member: ProjectMembership,
  currentUserId?: string,
  roleOverride?: string,
): HandoverMemberOption {
  return {
    userId: member.userId,
    fullName: formatMemberOptionLabel(member),
    email: member.user?.email?.trim() || undefined,
    avatarUrl: member.user?.avatarUrl ?? null,
    status: member.status,
    roleCode: roleOverride ?? getMembershipRole(member),
    isCurrentUser: Boolean(currentUserId && member.userId === currentUserId),
  };
}

export default function CreateHandoverModal({
  isOpen,
  onClose,
  organizationId = "",
  projectId,
  currentUserId,
  members,
  isMembersLoading = false,
  onCreated,
}: CreateHandoverModalProps) {
  const t = useTranslations("handover.createModal");
  const createMutation = useCreateHandoverMutation(projectId);
  const leadersQuery = useProjectLeadersQuery(organizationId, projectId);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "ACTIVE"),
    [members],
  );

  // Verified active Project Leaders from authoritative IAM endpoint + optional membership role metadata
  const verifiedLeadersMap = useMemo(() => {
    const map = new Map<string, HandoverMemberOption>();
    for (const leader of leadersQuery.data ?? []) {
      if (leader.status !== "ACTIVE") continue;
      map.set(leader.userId, {
        userId: leader.userId,
        fullName:
          leader.fullName.trim() ||
          leader.email.trim() ||
          `User ${leader.userId.slice(0, 6)}`,
        email: leader.email.trim() || undefined,
        avatarUrl: leader.avatarUrl,
        status: "ACTIVE",
        roleCode: "TEAM_LEADER",
        isCurrentUser: Boolean(
          currentUserId && leader.userId === currentUserId,
        ),
      });
    }
    for (const member of activeMembers) {
      const role = getMembershipRole(member);
      if ((role === "TEAM_LEADER" || role === "LEADER") && !map.has(member.userId)) {
        map.set(member.userId, toMemberOption(member, currentUserId, "TEAM_LEADER"));
      }
    }
    return map;
  }, [activeMembers, currentUserId, leadersQuery.data]);

  // A01 / A02: Departing member (A) supports both INACTIVE (already departed) and ACTIVE members
  const departingOptions = useMemo<readonly HandoverMemberOption[]>(() => {
    const mapped = members.map((m) =>
      toMemberOption(
        m,
        currentUserId,
        verifiedLeadersMap.has(m.userId) ? "TEAM_LEADER" : undefined,
      ),
    );
    return [...mapped].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "INACTIVE" ? -1 : 1;
      }
      return a.fullName.localeCompare(b.fullName);
    });
  }, [currentUserId, members, verifiedLeadersMap]);

  const coordinatorOptions = useMemo<readonly HandoverMemberOption[]>(() => {
    if (verifiedLeadersMap.size > 0) {
      return Array.from(verifiedLeadersMap.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      );
    }
    return activeMembers
      .map((m) => toMemberOption(m, currentUserId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [activeMembers, currentUserId, verifiedLeadersMap]);

  const defaultCoordinator = useMemo(() => {
    if (
      currentUserId &&
      coordinatorOptions.some((m) => m.userId === currentUserId)
    ) {
      return currentUserId;
    }
    return coordinatorOptions[0]?.userId ?? "";
  }, [coordinatorOptions, currentUserId]);

  const [title, setTitle] = useState("");
  const [departingUserId, setDepartingUserId] = useState("");
  const [assignedLeaderId, setAssignedLeaderId] = useState("");
  const [successorUserId, setSuccessorUserId] = useState("");
  const [targetDate, setTargetDate] = useState(defaultTargetDateInput);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<InvalidField>(null);

  const effectiveCoordinator = assignedLeaderId || defaultCoordinator;

  // B must be active and distinct from A. B may also coordinate as D;
  // evidence approval still requires an independent eligible reviewer.
  const successorOptions = useMemo<readonly HandoverMemberOption[]>(() => {
    return activeMembers
      .filter(
        (m) =>
          m.userId !== departingUserId,
      )
      .map((m) =>
        toMemberOption(
          m,
          currentUserId,
          verifiedLeadersMap.has(m.userId) ? "TEAM_LEADER" : undefined,
        ),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [
    activeMembers,
    currentUserId,
    departingUserId,
    verifiedLeadersMap,
  ]);

  const selectedDepartingMember = useMemo(
    () => departingOptions.find((m) => m.userId === departingUserId) ?? null,
    [departingOptions, departingUserId],
  );

  const isVerifiedLeaderSelected = Boolean(
    effectiveCoordinator && verifiedLeadersMap.has(effectiveCoordinator),
  );

  const dayDelta = useMemo(() => computeUtcDayDelta(targetDate), [targetDate]);
  const formattedTargetDate = useMemo(
    () => (targetDate ? formatUtcDate(`${targetDate}T00:00:00.000Z`) : ""),
    [targetDate],
  );

  const datePreviewText = useMemo(() => {
    if (!targetDate || dayDelta === null || !formattedTargetDate) {
      return t("datePreviewPrompt");
    }
    if (dayDelta === 0) {
      return t("datePreviewToday", { date: formattedTargetDate });
    }
    if (dayDelta > 0) {
      return t("datePreviewFuture", {
        date: formattedTargetDate,
        days: String(dayDelta),
      });
    }
    return t("datePreviewPast", {
      date: formattedTargetDate,
      days: String(Math.abs(dayDelta)),
    });
  }, [dayDelta, formattedTargetDate, t, targetDate]);

  const handleClose = () => {
    if (createMutation.isPending) return;
    setValidationError(null);
    setInvalidField(null);
    createMutation.reset();
    onClose();
  };

  const handleDepartingChange = (nextId: string) => {
    setDepartingUserId(nextId);
    if (nextId && successorUserId === nextId) {
      setSuccessorUserId("");
    }
    if (invalidField === "departing" || invalidField === "successor") {
      setInvalidField(null);
      setValidationError(null);
    }
  };

  const handleCoordinatorChange = (nextId: string) => {
    setAssignedLeaderId(nextId);
    if (invalidField === "coordinator" || invalidField === "successor") {
      setInvalidField(null);
      setValidationError(null);
    }
  };

  const handleSuccessorChange = (nextId: string) => {
    setSuccessorUserId(nextId);
    if (invalidField === "successor") {
      setInvalidField(null);
      setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setInvalidField(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
      setInvalidField("title");
      setValidationError(t("validationTitle"));
      return;
    }
    if (!departingUserId.trim()) {
      setInvalidField("departing");
      setValidationError(t("validationDeparting"));
      return;
    }
    if (!effectiveCoordinator.trim()) {
      setInvalidField("coordinator");
      setValidationError(t("validationCoordinator"));
      return;
    }
    const cleanSuccessor = successorUserId.trim() || null;
    if (
      cleanSuccessor &&
      cleanSuccessor === departingUserId.trim()
    ) {
      setInvalidField("successor");
      setValidationError(t("validationSamePerson"));
      return;
    }
    const parsedDate = new Date(`${targetDate}T00:00:00.000Z`);
    if (!targetDate || Number.isNaN(parsedDate.getTime())) {
      setInvalidField("targetDate");
      setValidationError(t("validationTargetDate"));
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        title: trimmedTitle,
        departingUserId: departingUserId.trim(),
        assignedLeaderId: effectiveCoordinator.trim(),
        successorUserId: cleanSuccessor,
        teamId: null,
        targetCompletionDate: parsedDate.toISOString(),
      });
      setTitle("");
      setDepartingUserId("");
      setSuccessorUserId("");
      setInvalidField(null);
      onCreated(result.data.handoverId);
    } catch {
      // Mutation error displayed below
    }
  };

  const serverError = createMutation.isError
    ? extractHandoverErrorMessage(
        createMutation.error,
        "Could not create knowledge handover.",
      )
    : null;

  return (
    <HandoverDialogShell
      isOpen={isOpen}
      onClose={handleClose}
      title={t("title")}
      description={t("subtitle")}
      closeLabel={t("closeDialog")}
      icon={<HandShakeIcon className="size-5" />}
      size="lg"
      disableClose={createMutation.isPending}
      focusField
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {(validationError || serverError) && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <AlertIcon
              className="mt-0.5 size-4.5 shrink-0 text-error-600 dark:text-error-400"
              aria-hidden="true"
            />
            <span>{validationError ?? serverError}</span>
          </div>
        )}

        {/* Handover Package Title */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="handover-create-title"
              className="text-sm font-medium text-gray-800 dark:text-gray-200"
            >
              {t("titleLabel")} <span className="text-error-600">*</span>
            </label>
            <span
              aria-live="polite"
              className={`text-xs tabular-nums ${
                title.trim().length > 180
                  ? "font-medium text-warning-600 dark:text-warning-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {t("charCount", { count: String(title.length) })}
            </span>
          </div>
          <input
            id="handover-create-title"
            data-dialog-autofocus-field="true"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (invalidField === "title") {
                setInvalidField(null);
                setValidationError(null);
              }
            }}
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            aria-invalid={invalidField === "title" || undefined}
            className={`mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-theme-xs transition-all placeholder:text-gray-400 focus:outline-none dark:bg-gray-800/90 dark:text-white dark:placeholder:text-gray-500 ${
              invalidField === "title"
                ? "border-error-400 focus:border-error-500 focus:ring-3 focus:ring-error-500/15 dark:border-error-500/70"
                : "border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:hover:border-gray-600"
            }`}
          />
        </div>

        {/* Governed Transition Roles & Timeline */}
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4 sm:p-4.5 dark:border-gray-800 dark:bg-gray-800/35">
          {/* Transition Flow Strip (A -> D -> B) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/70 pb-3 dark:border-gray-800">
            <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
              {t("transitionFlowLabel")}
            </span>
            <div
              aria-hidden="true"
              className="flex flex-wrap items-center gap-1.5 text-xs font-medium"
            >
              <span
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  departingUserId
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                    : "bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                }`}
              >
                {t("flowStepDeparting")}
              </span>
              <ArrowRightIcon className="size-3.5 text-gray-400" />
              <span
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  effectiveCoordinator
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                    : "bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                }`}
              >
                {t("flowStepCoordinator")}
              </span>
              <ArrowRightIcon className="size-3.5 text-gray-400" />
              <span
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  successorUserId
                    ? "bg-success-50 text-success-700 ring-1 ring-success-200/80 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30"
                    : "bg-white/80 text-gray-500 ring-1 ring-dashed ring-gray-300 dark:bg-gray-800/70 dark:text-gray-400 dark:ring-gray-700"
                }`}
              >
                {t("flowStepSuccessor")}
              </span>
            </div>
          </div>

          {/* Row 1: Required Actors (A & D) */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Departing Member (A) */}
            <div className="min-w-0">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <label
                  htmlFor="handover-create-departing"
                  className="text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {t("departingLabel")} <span className="text-error-600">*</span>
                </label>
              </div>
              {departingOptions.length > 0 || isMembersLoading ? (
                <HandoverMemberSelect
                  id="handover-create-departing"
                  value={departingUserId}
                  onChange={handleDepartingChange}
                  options={departingOptions}
                  placeholder={
                    isMembersLoading && departingOptions.length === 0
                      ? t("loadingMembers")
                      : t("selectDepartingPlaceholder")
                  }
                  disabled={isMembersLoading && departingOptions.length === 0}
                  searchPlaceholder={t("searchMembersPlaceholder")}
                  noMatchesLabel={t("noMatchingMembers")}
                  activeBadgeLabel={t("activeBadge")}
                  departedBadgeLabel={t("departedBadge")}
                  youBadgeLabel={t("youBadge")}
                  invalid={invalidField === "departing"}
                />
              ) : (
                <input
                  id="handover-create-departing"
                  type="text"
                  value={departingUserId}
                  onChange={(e) => handleDepartingChange(e.target.value)}
                  placeholder={t("manualIdPlaceholder")}
                  aria-invalid={invalidField === "departing" || undefined}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
              <p className="mt-1.5 flex min-h-4 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                {selectedDepartingMember?.status === "INACTIVE" ? (
                  <span className="text-warning-700 dark:text-warning-300">
                    {t("departingSelectedDepartedHint")}
                  </span>
                ) : selectedDepartingMember ? (
                  <span>{t("departingSelectedActiveHint")}</span>
                ) : (
                  <span>{t("departingRoleHint")}</span>
                )}
              </p>
            </div>

            {/* Coordinator Leader (D) */}
            <div className="min-w-0">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <label
                  htmlFor="handover-create-coordinator"
                  className="text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {t("coordinatorLabel")}{" "}
                  <span className="text-error-600">*</span>
                </label>
              </div>
              {coordinatorOptions.length > 0 || isMembersLoading ? (
                <HandoverMemberSelect
                  id="handover-create-coordinator"
                  value={effectiveCoordinator}
                  onChange={handleCoordinatorChange}
                  options={coordinatorOptions}
                  placeholder={
                    isMembersLoading && coordinatorOptions.length === 0
                      ? t("loadingMembers")
                      : t("selectCoordinatorPlaceholder")
                  }
                  disabled={isMembersLoading && coordinatorOptions.length === 0}
                  searchPlaceholder={t("searchMembersPlaceholder")}
                  noMatchesLabel={t("noMatchingMembers")}
                  activeBadgeLabel={t("activeBadge")}
                  departedBadgeLabel={t("departedBadge")}
                  youBadgeLabel={t("youBadge")}
                  invalid={invalidField === "coordinator"}
                />
              ) : (
                <input
                  id="handover-create-coordinator"
                  type="text"
                  value={assignedLeaderId}
                  onChange={(e) => handleCoordinatorChange(e.target.value)}
                  placeholder={t("manualLeaderIdPlaceholder")}
                  aria-invalid={invalidField === "coordinator" || undefined}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
              <p className="mt-1.5 flex min-h-4 items-center gap-1.5 text-xs">
                {isVerifiedLeaderSelected ? (
                  <span className="inline-flex items-center gap-1 font-medium text-success-700 dark:text-success-400">
                    <CheckCircleIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {t("verifiedLeaderHint")}
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("coordinatorRoleHint")}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Row 2: Optional Successor (B) & Target Completion Date */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Successor Recipient (B) */}
            <div className="min-w-0">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <label
                  htmlFor="handover-create-successor"
                  className="text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {t("successorLabel")}
                </label>
                <Badge color="light" size="sm">
                  {t("optionalBadge")}
                </Badge>
              </div>
              {activeMembers.length > 0 || isMembersLoading ? (
                <HandoverMemberSelect
                  id="handover-create-successor"
                  value={successorUserId}
                  onChange={handleSuccessorChange}
                  options={successorOptions}
                  placeholder={t("noSuccessorYet")}
                  allowEmpty
                  emptyOptionLabel={t("noSuccessorYet")}
                  emptyOptionHint={t("successorRoleHint")}
                  disabled={isMembersLoading && activeMembers.length === 0}
                  searchPlaceholder={t("searchMembersPlaceholder")}
                  noMatchesLabel={t("noMatchingMembers")}
                  activeBadgeLabel={t("activeBadge")}
                  departedBadgeLabel={t("departedBadge")}
                  youBadgeLabel={t("youBadge")}
                  invalid={invalidField === "successor"}
                />
              ) : (
                <input
                  id="handover-create-successor"
                  type="text"
                  value={successorUserId}
                  onChange={(e) => handleSuccessorChange(e.target.value)}
                  placeholder={t("noSuccessorYet")}
                  aria-invalid={invalidField === "successor" || undefined}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              )}
              <p className="mt-1.5 flex min-h-4 items-center text-xs text-gray-500 dark:text-gray-400">
                {t("successorRoleHint")}
              </p>
            </div>

            {/* Target Completion Date */}
            <div className="min-w-0">
              <div className="flex min-h-5 flex-wrap items-center justify-between gap-1.5">
                <label
                  htmlFor="handover-create-target-date"
                  className="text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {t("targetDateLabel")}{" "}
                  <span className="text-error-600">*</span>
                </label>
                <div className="flex items-center gap-1">
                  {PRESET_OFFSETS.map((days) => {
                    const presetValue = utcDateOffsetInput(days);
                    const isPresetActive = targetDate === presetValue;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          setTargetDate(presetValue);
                          if (invalidField === "targetDate") {
                            setInvalidField(null);
                            setValidationError(null);
                          }
                        }}
                        className={`cursor-pointer rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none ${
                          isPresetActive
                            ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        {t("presetDays", { days: String(days) })}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                id="handover-create-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  if (invalidField === "targetDate") {
                    setInvalidField(null);
                    setValidationError(null);
                  }
                }}
                aria-invalid={invalidField === "targetDate" || undefined}
                className={`mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-gray-900 tabular-nums shadow-theme-xs transition-all focus:outline-none dark:bg-gray-800/90 dark:text-white ${
                  invalidField === "targetDate"
                    ? "border-error-400 focus:border-error-500 focus:ring-3 focus:ring-error-500/15 dark:border-error-500/70"
                    : "border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              />
              <p
                className={`mt-1.5 flex min-h-4 items-center gap-1.5 text-xs tabular-nums ${
                  dayDelta !== null && dayDelta < 0
                    ? "font-medium text-warning-700 dark:text-warning-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <CalenderIcon
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{datePreviewText}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={createMutation.isPending}
          >
            {createMutation.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </HandoverDialogShell>
  );
}
