"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useAddProjectMember,
  useProjectMemberCandidatesQuery,
  type ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import { useProjectLeadersQuery } from "@/lib/queries/projects/useProjectLeaders";
import { useCreateHandoverMutation } from "@/lib/queries/handovers/useHandovers";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  HandShakeIcon,
  LockIcon,
} from "@/icons";
import HandoverDialogShell from "./HandoverDialogShell";
import HandoverDatePicker, { utcDateOffsetIso } from "./HandoverDatePicker";
import HandoverMemberSelect, {
  type HandoverMemberOption,
} from "./HandoverMemberSelect";
import {
  buildOrganizationSuccessorOptions,
  ensureProjectMemberBeforeHandover,
  extractHandoverErrorMessage,
  formatMemberOptionLabel,
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

const PRESET_OFFSETS = [7, 14, 30, 60] as const;

function defaultTargetDateInput(): string {
  return utcDateOffsetIso(14);
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
  const candidatesQuery = useProjectMemberCandidatesQuery(
    organizationId,
    projectId,
    undefined,
    { enabled: isOpen },
  );
  const addProjectMemberMutation = useAddProjectMember(
    organizationId,
    projectId,
  );

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
      if (
        (role === "TEAM_LEADER" || role === "LEADER") &&
        !map.has(member.userId)
      ) {
        map.set(
          member.userId,
          toMemberOption(member, currentUserId, "TEAM_LEADER"),
        );
      }
    }
    return map;
  }, [activeMembers, currentUserId, leadersQuery.data]);

  const verifiedLeaderIds = useMemo(
    () => new Set(verifiedLeadersMap.keys()),
    [verifiedLeadersMap],
  );

  // A01 / A02: Departing member (A) supports both INACTIVE (already departed) and ACTIVE project members
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
  const [autoAddError, setAutoAddError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<InvalidField>(null);

  const effectiveCoordinator = assignedLeaderId || defaultCoordinator;

  // Successor (B): Lists ALL active Organization members (both active Project members AND Org colleagues with 1-click Auto-add)
  const { options: successorOptions, activeProjectUserIds } = useMemo(
    () =>
      buildOrganizationSuccessorOptions({
        activeProjectMembers: activeMembers,
        orgCandidates: candidatesQuery.data,
        departingUserId,
        currentUserId,
        leaderUserIds: verifiedLeaderIds,
      }),
    [
      activeMembers,
      candidatesQuery.data,
      currentUserId,
      departingUserId,
      verifiedLeaderIds,
    ],
  );

  const selectedDepartingMember = useMemo(
    () => departingOptions.find((m) => m.userId === departingUserId) ?? null,
    [departingOptions, departingUserId],
  );

  const selectedSuccessorOption = useMemo(
    () => successorOptions.find((m) => m.userId === successorUserId) ?? null,
    [successorOptions, successorUserId],
  );

  const isSelectedSuccessorOrgCandidate =
    selectedSuccessorOption?.membershipScope === "ORG_CANDIDATE";

  const isVerifiedLeaderSelected = Boolean(
    effectiveCoordinator && verifiedLeadersMap.has(effectiveCoordinator),
  );

  const dayDelta = useMemo(() => computeUtcDayDelta(targetDate), [targetDate]);

  const dateBadgeText = useMemo(() => {
    if (!targetDate || dayDelta === null) return null;
    if (dayDelta === 0) return t("dateBadgeToday");
    if (dayDelta > 0) {
      return t("dateBadgeFuture", { days: String(dayDelta) });
    }
    return t("dateBadgePast", { days: String(Math.abs(dayDelta)) });
  }, [dayDelta, t, targetDate]);

  const isSubmitting =
    addProjectMemberMutation.isPending || createMutation.isPending;

  const handleClose = () => {
    if (isSubmitting) return;
    setValidationError(null);
    setAutoAddError(null);
    setInvalidField(null);
    createMutation.reset();
    addProjectMemberMutation.reset();
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
    setAutoAddError(null);
    if (invalidField === "successor") {
      setInvalidField(null);
      setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setAutoAddError(null);
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
    if (cleanSuccessor && cleanSuccessor === departingUserId.trim()) {
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
      await ensureProjectMemberBeforeHandover({
        successorUserId: cleanSuccessor,
        activeProjectUserIds,
        addProjectMember: (uid) => addProjectMemberMutation.mutateAsync(uid),
      });
    } catch (err) {
      setInvalidField("successor");
      setAutoAddError(
        extractHandoverErrorMessage(err, t("autoAddMemberFailed")),
      );
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

  const activeAlertMessage = validationError ?? autoAddError ?? serverError;
  const isCandidatesLoading =
    Boolean(organizationId) && candidatesQuery.isPending;

  return (
    <HandoverDialogShell
      isOpen={isOpen}
      onClose={handleClose}
      title={t("title")}
      description={t("subtitle")}
      closeLabel={t("closeDialog")}
      icon={<HandShakeIcon className="size-5" />}
      size="lg"
      disableClose={isSubmitting}
      focusField
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {activeAlertMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 [overflow-wrap:anywhere] dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <AlertIcon
              className="mt-0.5 size-4.5 shrink-0 text-error-600 dark:text-error-400"
              aria-hidden="true"
            />
            <span>{activeAlertMessage}</span>
          </div>
        )}

        {/* Zone 1: Package Scope & Target Completion Date */}
        <div className="space-y-3.5">
          {/* Handover Title */}
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

          {/* Interactive Calendar Date Picker + Quick Presets */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="handover-create-target-date"
                className="text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {t("targetDateLabel")} <span className="text-error-600">*</span>
              </label>

              <div className="flex flex-wrap items-center gap-1">
                {PRESET_OFFSETS.map((days) => {
                  const presetValue = utcDateOffsetIso(days);
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
                      className={`cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:outline-none ${
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

            <HandoverDatePicker
              id="handover-create-target-date"
              value={targetDate}
              onChange={(nextIso) => {
                setTargetDate(nextIso);
                if (invalidField === "targetDate") {
                  setInvalidField(null);
                  setValidationError(null);
                }
              }}
              placeholder={t("targetDatePlaceholder")}
              dialogLabel={t("calendarDialogLabel")}
              todayLabel={t("calendarToday")}
              prevMonthLabel={t("calendarPrevMonth")}
              nextMonthLabel={t("calendarNextMonth")}
              utcNoteLabel={t("calendarUtcNote")}
              presets={PRESET_OFFSETS}
              formatPresetLabel={(days) =>
                t("presetDays", { days: String(days) })
              }
              relativeBadgeText={dateBadgeText}
              relativeBadgeTone={
                dayDelta !== null && dayDelta <= 0 ? "warning" : "brand"
              }
              invalid={invalidField === "targetDate"}
            />
          </div>
        </div>

        {/* Zone 2: Connected Transition Participants Pipeline (A -> D -> B) */}
        <div className="border-t border-gray-200/80 pt-3.5 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
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
                    : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                }`}
              >
                {t("flowStepDeparting")}
              </span>
              <ArrowRightIcon className="size-3.5 text-gray-400 rtl:rotate-180" />
              <span
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  effectiveCoordinator
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                    : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                }`}
              >
                {t("flowStepCoordinator")}
              </span>
              <ArrowRightIcon className="size-3.5 text-gray-400 rtl:rotate-180" />
              <span
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  successorUserId
                    ? "bg-success-50 text-success-700 ring-1 ring-success-200/80 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30"
                    : "bg-gray-50 text-gray-500 ring-1 ring-dashed ring-gray-300 dark:bg-gray-800/70 dark:text-gray-400 dark:ring-gray-700"
                }`}
              >
                {t("flowStepSuccessor")}
              </span>
            </div>
          </div>

          <div className="space-y-0">
            {/* Step 1: Departing Member (A) */}
            <div className="flex gap-3">
              <div
                aria-hidden="true"
                className="hidden shrink-0 flex-col items-center pt-1 sm:flex"
              >
                <span
                  className={`inline-flex size-6.5 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors ${
                    departingUserId
                      ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/40"
                      : "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                  }`}
                >
                  A
                </span>
                <span className="my-1 w-px flex-1 bg-gray-200 dark:bg-gray-800" />
              </div>

              <div className="min-w-0 flex-1 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="handover-create-departing"
                    className="text-sm font-medium text-gray-800 dark:text-gray-200"
                  >
                    {t("departingLabel")}{" "}
                    <span className="text-error-600">*</span>
                  </label>
                  <span className="text-xs">
                    {selectedDepartingMember?.status === "INACTIVE" ? (
                      <span className="font-medium text-warning-700 dark:text-warning-300">
                        {t("departingSelectedDepartedHint")}
                      </span>
                    ) : selectedDepartingMember ? (
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("departingSelectedActiveHint")}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        {t("departingRoleHint")}
                      </span>
                    )}
                  </span>
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
              </div>
            </div>

            {/* Step 2: Coordinator Leader (D) */}
            <div className="flex gap-3">
              <div
                aria-hidden="true"
                className="hidden shrink-0 flex-col items-center pt-1 sm:flex"
              >
                <span
                  className={`inline-flex size-6.5 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors ${
                    effectiveCoordinator
                      ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/40"
                      : "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                  }`}
                >
                  D
                </span>
                <span className="my-1 w-px flex-1 bg-gray-200 dark:bg-gray-800" />
              </div>

              <div className="min-w-0 flex-1 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="handover-create-coordinator"
                    className="text-sm font-medium text-gray-800 dark:text-gray-200"
                  >
                    {t("coordinatorLabel")}{" "}
                    <span className="text-error-600">*</span>
                  </label>
                  <span className="text-xs">
                    {isVerifiedLeaderSelected ? (
                      <span className="inline-flex items-center gap-1 font-medium text-success-700 dark:text-success-400">
                        <CheckCircleIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {t("verifiedLeaderHint")}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        {t("coordinatorRoleHint")}
                      </span>
                    )}
                  </span>
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
                    disabled={
                      isMembersLoading && coordinatorOptions.length === 0
                    }
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
              </div>
            </div>

            {/* Step 3: Successor Recipient (B) — Project + Organization Colleagues */}
            <div className="flex gap-3">
              <div
                aria-hidden="true"
                className="hidden shrink-0 flex-col items-center pt-1 sm:flex"
              >
                <span
                  className={`inline-flex size-6.5 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors ${
                    successorUserId
                      ? "bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/20 dark:text-success-300 dark:ring-success-500/40"
                      : "bg-gray-50 text-gray-500 ring-dashed ring-gray-300 dark:bg-gray-800/70 dark:text-gray-400 dark:ring-gray-700"
                  }`}
                >
                  B
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
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

                {successorOptions.length > 0 ||
                activeMembers.length > 0 ||
                isMembersLoading ||
                isCandidatesLoading ? (
                  <HandoverMemberSelect
                    id="handover-create-successor"
                    value={successorUserId}
                    onChange={handleSuccessorChange}
                    options={successorOptions}
                    placeholder={t("noSuccessorYet")}
                    allowEmpty
                    emptyOptionLabel={t("noSuccessorYet")}
                    emptyOptionHint={t("successorRoleHint")}
                    alwaysShowSearch={successorOptions.length >= 2}
                    disabled={
                      isMembersLoading &&
                      isCandidatesLoading &&
                      successorOptions.length === 0
                    }
                    searchPlaceholder={t("searchOrgMembersPlaceholder")}
                    noMatchesLabel={t("noMatchingOrgMembers")}
                    activeBadgeLabel={t("activeBadge")}
                    departedBadgeLabel={t("departedBadge")}
                    youBadgeLabel={t("youBadge")}
                    inProjectBadgeLabel={t("inProjectBadge")}
                    orgCandidateBadgeLabel={t("orgCandidateBadge")}
                    projectGroupLabel={t("projectGroupHeading")}
                    orgCandidateGroupLabel={t("orgCandidateGroupHeading")}
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

                {isSelectedSuccessorOrgCandidate && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-blue-light-50/70 px-3 py-2 text-xs text-blue-light-700 ring-1 ring-blue-light-200/70 dark:bg-blue-light-500/10 dark:text-blue-light-300 dark:ring-blue-light-500/25">
                    <CheckCircleIcon
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{t("autoAddProjectNotice")}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-gray-200/90 bg-white/95 px-5 py-3.5 backdrop-blur-xs sm:-mx-6 sm:-mb-6 sm:px-6 sm:py-4 dark:border-gray-800 dark:bg-gray-900/95">
          <p className="hidden items-center gap-1.5 text-xs text-gray-500 sm:inline-flex dark:text-gray-400">
            <LockIcon
              className="size-3.5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <span>{t("footerGovernanceHint")}</span>
          </p>

          <div className="ms-auto flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {addProjectMemberMutation.isPending
                ? t("submittingAutoAdd")
                : createMutation.isPending
                  ? t("submitting")
                  : t("submit")}
            </Button>
          </div>
        </div>
      </form>
    </HandoverDialogShell>
  );
}
