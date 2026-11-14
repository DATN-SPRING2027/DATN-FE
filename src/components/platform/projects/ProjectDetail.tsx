"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  GroupIcon,
  InfoIcon,
  LockIcon,
  PlatformProjectsIcon,
  PlusIcon,
  SearchIcon,
  TrashBinIcon,
} from "@/icons";
import Button from "@/components/ui/button/Button";
import type {
  PlatformProjectMemberRecord,
  PlatformProjectMemberRoleCode,
  PlatformProjectRecord,
} from "@/lib/queries/platform/usePlatformOperations";
import PlatformPagination from "../PlatformPagination";
import DirectorySelect from "../ui/DirectorySelect";
import StatusBadge from "../ui/StatusBadge";
import dialogStyles from "../ui/platformDialog.module.css";
import {
  ErrorState,
  Loading,
  QueryRefreshStatus,
  TextField,
  input,
  isReadAccessLost,
} from "../PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";
import styles from "./ProjectDetail.module.css";

const PROJECT_CODE_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;

const TRANSLATABLE_ERROR_CODES = new Set([
  "PROJECT_LOCKED",
  "LAST_PROJECT_LEADER_REQUIRED",
  "PROJECT_MEMBER_ALREADY_EXISTS",
  "PROJECT_MEMBER_ELIGIBILITY_REQUIRED",
  "PROJECT_CODE_CONFLICT",
  "PROJECT_VERSION_STALE",
]);

function MetadataGovernanceForm({
  project,
  isPending,
  onSave,
  onValidationError,
}: {
  project: PlatformProjectRecord;
  isPending: boolean;
  onSave: (
    event: FormEvent<HTMLFormElement>,
    payload: {
      projectId: string;
      name?: string;
      code?: string;
      visibility?: "PUBLIC" | "PRIVATE";
      expectedUpdatedAt: string;
      reasonCode: "ACCESS_REVIEW" | "SECURITY_INCIDENT";
    },
  ) => Promise<boolean>;
  onValidationError: (message: string) => void;
}) {
  const t = useTranslations("platformProjectDirectory");
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(
    project.visibility,
  );
  const [reasonCode, setReasonCode] = useState<
    "ACCESS_REVIEW" | "SECURITY_INCIDENT"
  >("ACCESS_REVIEW");

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      event.preventDefault();
      onValidationError(t("invalidProjectName"));
      return;
    }
    if (!PROJECT_CODE_PATTERN.test(trimmedCode)) {
      event.preventDefault();
      onValidationError(t("invalidProjectCode"));
      return;
    }
    const nextName = trimmedName !== project.name ? trimmedName : undefined;
    const nextCode = trimmedCode !== project.code ? trimmedCode : undefined;
    const nextVisibility =
      visibility !== project.visibility ? visibility : undefined;
    if (!nextName && !nextCode && !nextVisibility) {
      event.preventDefault();
      onValidationError(t("noMetadataChanges"));
      return;
    }
    void onSave(event, {
      projectId: project.id,
      ...(nextName ? { name: nextName } : {}),
      ...(nextCode ? { code: nextCode } : {}),
      ...(nextVisibility ? { visibility: nextVisibility } : {}),
      expectedUpdatedAt: project.updatedAt,
      reasonCode,
    });
  }

  return (
    <form onSubmit={handleFormSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200">
        <span>{t("projectNameInput")}</span>
        <input
          type="text"
          name="projectName"
          value={name}
          minLength={2}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          className={`${input} h-9 rounded-lg px-3 text-xs`}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200">
        <span>{t("projectCodeInput")}</span>
        <input
          type="text"
          name="projectCode"
          value={code}
          minLength={2}
          maxLength={32}
          onChange={(event) => setCode(event.target.value)}
          className={`${input} h-9 rounded-lg px-3 font-mono text-xs`}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200">
        <span>{t("visibility")}</span>
        <select
          name="visibility"
          value={visibility}
          onChange={(event) =>
            setVisibility(event.target.value as "PUBLIC" | "PRIVATE")
          }
          className={`${input} h-9 rounded-lg px-3 text-xs`}
        >
          <option value="PRIVATE">{t("PRIVATE")}</option>
          <option value="PUBLIC">{t("PUBLIC")}</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200">
        <span>{t("reasonCodeLabel")}</span>
        <select
          name="reasonCode"
          value={reasonCode}
          onChange={(event) =>
            setReasonCode(
              event.target.value as "ACCESS_REVIEW" | "SECURITY_INCIDENT",
            )
          }
          className={`${input} h-9 rounded-lg px-3 text-xs`}
        >
          <option value="ACCESS_REVIEW">{t("reasonAccessReview")}</option>
          <option value="SECURITY_INCIDENT">
            {t("reasonSecurityIncident")}
          </option>
        </select>
      </label>
      <div className="flex items-center justify-end sm:col-span-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isPending}
          className={styles.primaryButton}
        >
          {isPending ? t("savingChanges") : t("saveChanges")}
        </Button>
      </div>
    </form>
  );
}

function ProjectDetailBody({
  project,
  model,
}: {
  project: PlatformProjectRecord;
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformProjectDirectory");
  const roleLabels = useTranslations("roleLabels");
  const locale = useLocale();
  const {
    canManageProjects = false,
    changeProject,
    projectMembers,
    projectMemberPage = 1,
    setProjectMemberPage,
    projectMemberSearch = "",
    setProjectMemberSearch,
    projectMemberStatus = "",
    setProjectMemberStatus,
    projectMemberRole = "",
    setProjectMemberRole,
    projectCandidateSearch = "",
    setProjectCandidateSearch,
    projectMemberCandidates,
    addProjectMember,
    changeProjectMemberRole,
    removeProjectMember,
    handleSubmit,
    runOperation,
    formMessage,
    setFormMessage,
    lastErrorCode,
    setLastErrorCode,
  } = model;

  const [activeTab, setActiveTab] = useState<"overview" | "members">(
    "overview",
  );
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [lockReasonCode, setLockReasonCode] = useState<
    "ACCESS_REVIEW" | "SECURITY_INCIDENT"
  >("ACCESS_REVIEW");
  const [localNotice, setLocalNotice] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [addRoleCode, setAddRoleCode] =
    useState<PlatformProjectMemberRoleCode>("MEMBER");
  const [addReasonCode, setAddReasonCode] = useState<
    "ACCESS_REVIEW" | "SECURITY_INCIDENT"
  >("ACCESS_REVIEW");
  const [memberReasonCode, setMemberReasonCode] = useState<
    "ACCESS_REVIEW" | "SECURITY_INCIDENT"
  >("ACCESS_REVIEW");
  const [removeTarget, setRemoveTarget] =
    useState<PlatformProjectMemberRecord | null>(null);

  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const numberFormatter = new Intl.NumberFormat(locale);

  const isLocked = project.status === "ARCHIVED";
  const teams = project.teams ?? [];
  const teamCount = project.teamCount ?? teams.length;
  const candidateItems = projectMemberCandidates?.data?.items ?? [];
  const effectiveCandidateId = candidateItems.some(
    (item) => item.userId === selectedCandidateId,
  )
    ? selectedCandidateId
    : (candidateItems[0]?.userId ?? "");
  const memberRows = projectMembers?.data?.data ?? [];

  const resolvedFeedback =
    localNotice ||
    (lastErrorCode && TRANSLATABLE_ERROR_CODES.has(lastErrorCode)
      ? t(`error${lastErrorCode}` as Parameters<typeof t>[0])
      : formMessage
        ? formMessage.startsWith("Operation completed.")
          ? t("operationCompleted")
          : formMessage
        : "");

  function isKnownSoleLeader(member: PlatformProjectMemberRecord) {
    return (
      !project.leadersTruncated &&
      project.leaders.length === 1 &&
      project.leaders[0]?.id === member.userId &&
      member.roleCode === "TEAM_LEADER" &&
      member.status === "ACTIVE"
    );
  }

  async function handleConfirmLockToggle() {
    if (!changeProject || !runOperation) return;
    setLocalNotice("");
    const nextStatus = project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    const ok = await runOperation(() =>
      changeProject.mutateAsync({
        projectId: project.id,
        status: nextStatus,
        expectedUpdatedAt: project.updatedAt,
        reasonCode: lockReasonCode,
      }),
    );
    if (ok) setConfirmLockOpen(false);
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveCandidateId || !addProjectMember || !runOperation) return;
    setLocalNotice("");
    const ok = await runOperation(() =>
      addProjectMember.mutateAsync({
        projectId: project.id,
        userId: effectiveCandidateId,
        roleCode: addRoleCode,
        reasonCode: addReasonCode,
      }),
    );
    if (ok) {
      setSelectedCandidateId("");
    }
  }

  async function handleRoleChange(
    member: PlatformProjectMemberRecord,
    nextRoleCode: PlatformProjectMemberRoleCode,
  ) {
    if (
      nextRoleCode === member.roleCode ||
      !changeProjectMemberRole ||
      !runOperation
    )
      return;
    setLocalNotice("");
    await runOperation(() =>
      changeProjectMemberRole.mutateAsync({
        projectId: project.id,
        membershipId: member.id,
        roleCode: nextRoleCode,
        reasonCode: memberReasonCode,
      }),
    );
  }

  async function handleConfirmRemove() {
    if (!removeTarget || !removeProjectMember || !runOperation) return;
    setLocalNotice("");
    const target = removeTarget;
    const ok = await runOperation(() =>
      removeProjectMember.mutateAsync({
        projectId: project.id,
        membershipId: target.id,
        reasonCode: memberReasonCode,
      }),
    );
    if (ok) {
      setRemoveTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-400">
            <PlatformProjectsIcon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {project.name}
              </h3>
              <span className="rounded bg-gray-200/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {project.code}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
              {project.organization.name} ·{" "}
              <span className="font-mono">{project.organization.slug}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={project.visibility}
            label={t(project.visibility)}
          />
          <div className="inline-flex items-center gap-1.5">
            <StatusBadge status={project.status} label={t(project.status)} />
            {isLocked && (
              <LockIcon
                aria-hidden="true"
                className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
              />
            )}
          </div>
        </div>
      </div>

      {isLocked && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <LockIcon
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
          />
          <p>{t("lockedBanner")}</p>
        </div>
      )}

      <div
        role="tablist"
        aria-label={t("detailTitle")}
        className="flex flex-nowrap gap-1 overflow-x-auto border-b border-gray-200 sm:gap-2 dark:border-gray-700"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={
            activeTab === "overview"
              ? `${styles.tabButton} ${styles.tabButtonActive} whitespace-nowrap border-b-2 border-brand-600 px-2.5 py-2 text-xs font-semibold text-brand-600 sm:px-3 dark:border-brand-400 dark:text-brand-400`
              : `${styles.tabButton} whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 sm:px-3 dark:text-gray-300 dark:hover:text-white`
          }
        >
          {t("overviewTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "members"}
          onClick={() => setActiveTab("members")}
          className={
            activeTab === "members"
              ? `${styles.tabButton} ${styles.tabButtonActive} inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 border-b-2 border-brand-600 px-2.5 py-2 text-xs font-semibold text-brand-600 sm:px-3 dark:border-brand-400 dark:text-brand-400`
              : `${styles.tabButton} inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 sm:px-3 dark:text-gray-300 dark:hover:text-white`
          }
        >
          <GroupIcon aria-hidden="true" className="h-3.5 w-3.5" />
          <span>{t("membersTab")}</span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {numberFormatter.format(project.memberCount)}
          </span>
        </button>
      </div>

      {resolvedFeedback && (
        <p
          role="status"
          className={
            lastErrorCode || localNotice
              ? "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
              : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          }
        >
          {resolvedFeedback}
        </p>
      )}

      {activeTab === "overview" ? (
        <div role="tabpanel" className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={t("creatorLabel")}
              value={
                project.createdBy
                  ? `${project.createdBy.fullName} (${project.createdBy.email})`
                  : t("creatorUnknown")
              }
            />
            <TextField
              label={t("createdAtLabel")}
              value={dateTimeFormatter.format(new Date(project.createdAt))}
            />
            <TextField
              label={t("updatedAtLabel")}
              value={dateTimeFormatter.format(new Date(project.updatedAt))}
            />
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("memberCountLabel")}
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {numberFormatter.format(project.memberCount)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("teamCountLabel")}
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {numberFormatter.format(teamCount)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {roleLabels("teamLeaders")}
              </dt>
              <dd className="mt-1 text-xs text-gray-800 dark:text-gray-200">
                {project.leaders.length ? (
                  <ul className="space-y-1">
                    {project.leaders.map((leader) => (
                      <li key={leader.id} className="break-words">
                        {leader.fullName} ({leader.email})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("noLeaders")}
                  </span>
                )}
                {project.leadersTruncated && (
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {t("leadersTruncatedNotice")}
                  </p>
                )}
              </dd>
            </div>
          </dl>

          <section className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                {t("teamsSectionTitle")}
              </h4>
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {numberFormatter.format(teamCount)}
              </span>
            </div>
            {teams.length ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-start">
                        {t("teamName")}
                      </th>
                      <th scope="col" className="px-3 py-2 text-start">
                        {t("teamCode")}
                      </th>
                      <th scope="col" className="px-3 py-2 text-start">
                        {t("teamStatus")}
                      </th>
                      <th scope="col" className="px-3 py-2 text-end">
                        {t("teamMembers")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {teams.map((team) => (
                      <tr key={team.id}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                          {team.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-300">
                          {team.code}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={team.status}
                            label={t(team.status)}
                          />
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums text-gray-800 dark:text-gray-200">
                          {numberFormatter.format(team.memberCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t("noTeams")}
              </p>
            )}
            {project.teamsTruncated && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t("teamsTruncatedNotice", { count: String(teamCount) })}
              </p>
            )}
          </section>

          {canManageProjects &&
            Boolean(changeProject) &&
            Boolean(handleSubmit) &&
            Boolean(runOperation) && (
            <section className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                  {t("governanceSectionTitle")}
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant={isLocked ? "outline" : "danger"}
                  className={isLocked ? styles.outlineButton : styles.dangerButton}
                  onClick={() => setConfirmLockOpen((open) => !open)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isLocked ? (
                      <>
                        <CheckCircleIcon
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                        <span>{t("unlockAction")}</span>
                      </>
                    ) : (
                      <>
                        <LockIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>{t("lockAction")}</span>
                      </>
                    )}
                  </span>
                </Button>
              </div>

              {confirmLockOpen && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="flex items-start gap-2.5">
                    <AlertIcon
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="font-semibold">
                        {isLocked
                          ? t("confirmUnlockTitle")
                          : t("confirmLockTitle")}
                      </p>
                      <p>
                        {isLocked
                          ? t("confirmUnlockDescription", {
                              name: project.name,
                            })
                          : t("confirmLockDescription", {
                              name: project.name,
                            })}
                      </p>
                      <div className="flex flex-wrap items-end gap-3 pt-1">
                        <label className="grid gap-1 text-xs font-medium">
                          <span>{t("reasonCodeLabel")}</span>
                          <select
                            value={lockReasonCode}
                            onChange={(event) =>
                              setLockReasonCode(
                                event.target.value as
                                  | "ACCESS_REVIEW"
                                  | "SECURITY_INCIDENT",
                              )
                            }
                            className={`${input} ${styles.compactSelect} h-8 rounded-md px-2.5 text-xs`}
                          >
                            <option value="ACCESS_REVIEW">
                              {t("reasonAccessReview")}
                            </option>
                            <option value="SECURITY_INCIDENT">
                              {t("reasonSecurityIncident")}
                            </option>
                          </select>
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={isLocked ? "primary" : "danger"}
                            className={
                              isLocked
                                ? styles.primaryButton
                                : styles.dangerButton
                            }
                            disabled={changeProject.isPending}
                            onClick={() => void handleConfirmLockToggle()}
                          >
                            {isLocked
                              ? t("confirmUnlockButton")
                              : t("confirmLockButton")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={styles.outlineButton}
                            onClick={() => setConfirmLockOpen(false)}
                          >
                            {t("cancel")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <MetadataGovernanceForm
                key={project.updatedAt}
                project={project}
                isPending={changeProject.isPending}
                onValidationError={(msg) => {
                  setLocalNotice(msg);
                  setLastErrorCode?.("");
                  setFormMessage?.("");
                }}
                onSave={(event, payload) => {
                  setLocalNotice("");
                  return handleSubmit(event, () =>
                    changeProject.mutateAsync(payload),
                  );
                }}
              />
            </section>
          )}

          <div
            role="note"
            className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/75 p-3.5 text-xs text-blue-950 dark:border-blue-800/60 dark:bg-blue-950/35 dark:text-blue-100"
          >
            <InfoIcon
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400"
            />
            <div className="space-y-1">
              <p className="font-semibold">{t("privacyTitle")}</p>
              <p className="leading-relaxed text-blue-900 dark:text-blue-200">
                {t("privacyBody")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          {canManageProjects && (
            <form
              onSubmit={(event) => void handleAddMember(event)}
              className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="flex items-center gap-2">
                <PlusIcon
                  aria-hidden="true"
                  className="h-4 w-4 text-brand-600 dark:text-brand-400"
                />
                <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {t("addMemberTitle")}
                </h4>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-12">
                <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200 sm:col-span-4">
                  <span className="sr-only">{t("candidateSearchPlaceholder")}</span>
                  <div className="relative flex items-center">
                    <SearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-gray-400"
                    />
                    <input
                      type="search"
                      value={projectCandidateSearch}
                      disabled={isLocked}
                      placeholder={t("candidateSearchPlaceholder")}
                      onChange={(event) =>
                        setProjectCandidateSearch?.(event.target.value)
                      }
                      className={`${input} ${styles.searchFieldInput} h-9 w-full rounded-lg ps-8 pe-3 text-xs`}
                    />
                  </div>
                </label>

                <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200 sm:col-span-5">
                  <span className="sr-only">{t("selectCandidate")}</span>
                  <select
                    aria-label={t("selectCandidate")}
                    disabled={
                      isLocked ||
                      Boolean(projectMemberCandidates?.isPending) ||
                      !candidateItems.length
                    }
                    value={effectiveCandidateId}
                    onChange={(event) =>
                      setSelectedCandidateId(event.target.value)
                    }
                    className={`${input} h-9 w-full rounded-lg px-3 text-xs`}
                  >
                    {!candidateItems.length ? (
                      <option value="">{t("noCandidatesAvailable")}</option>
                    ) : (
                      candidateItems.map((candidate) => (
                        <option key={candidate.userId} value={candidate.userId}>
                          {candidate.fullName} · {candidate.email}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-200 sm:col-span-3">
                  <span className="sr-only">{t("assignRoleLabel")}</span>
                  <select
                    aria-label={t("assignRoleLabel")}
                    disabled={isLocked}
                    value={addRoleCode}
                    onChange={(event) =>
                      setAddRoleCode(
                        event.target.value as PlatformProjectMemberRoleCode,
                      )
                    }
                    className={`${input} h-9 w-full rounded-lg px-2.5 text-xs`}
                  >
                    <option value="MEMBER">{t("roleMEMBER")}</option>
                    <option value="TEAM_LEADER">{t("roleTEAM_LEADER")}</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5 text-xs text-gray-600 dark:text-gray-300">
                <label className="inline-flex items-center gap-2">
                  <span>{t("reasonCodeLabel")}:</span>
                  <select
                    disabled={isLocked}
                    value={addReasonCode}
                    onChange={(event) =>
                      setAddReasonCode(
                        event.target.value as
                          | "ACCESS_REVIEW"
                          | "SECURITY_INCIDENT",
                      )
                    }
                    className={`${input} ${styles.compactSelect} h-8 rounded px-2 text-xs`}
                  >
                    <option value="ACCESS_REVIEW">
                      {t("reasonAccessReview")}
                    </option>
                    <option value="SECURITY_INCIDENT">
                      {t("reasonSecurityIncident")}
                    </option>
                  </select>
                </label>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  className={styles.primaryButton}
                  disabled={
                    isLocked ||
                    !effectiveCandidateId ||
                    Boolean(addProjectMember?.isPending)
                  }
                >
                  {addProjectMember?.isPending
                    ? t("addingMember")
                    : t("addMemberButton")}
                </Button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative min-w-[200px] flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute start-2.5 top-2.5 h-3.5 w-3.5 text-gray-400"
              />
              <span className="sr-only">{t("memberSearchPlaceholder")}</span>
              <input
                type="search"
                value={projectMemberSearch}
                placeholder={t("memberSearchPlaceholder")}
                onChange={(event) =>
                  setProjectMemberSearch?.(event.target.value)
                }
                className={`${input} ${styles.searchFieldInput} ${styles.compactSelect} h-8 w-full rounded-lg ps-8 pe-3 text-xs`}
              />
            </label>
            <DirectorySelect
              aria-label={t("memberRoleFilter")}
              value={projectMemberRole}
              onChange={(event) =>
                setProjectMemberRole?.(
                  event.target.value as "" | PlatformProjectMemberRoleCode,
                )
              }
              className={`${input} ${styles.compactSelect} h-8 rounded-lg px-2.5 text-xs`}
            >
              <option value="">{t("allRoles")}</option>
              <option value="TEAM_LEADER">{t("roleTEAM_LEADER")}</option>
              <option value="MEMBER">{t("roleMEMBER")}</option>
            </DirectorySelect>
            <DirectorySelect
              aria-label={t("memberStatusFilter")}
              value={projectMemberStatus}
              onChange={(event) =>
                setProjectMemberStatus?.(
                  event.target.value as "" | "ACTIVE" | "INACTIVE",
                )
              }
              className={`${input} ${styles.compactSelect} h-8 rounded-lg px-2.5 text-xs`}
            >
              <option value="">{t("allMemberStatuses")}</option>
              <option value="ACTIVE">{t("memberStatusACTIVE")}</option>
              <option value="INACTIVE">{t("memberStatusINACTIVE")}</option>
            </DirectorySelect>
          </div>

          {removeTarget && (
            <div
              role="region"
              aria-label={t("removeMemberConfirmTitle")}
              className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100"
            >
              <p className="font-semibold">{t("removeMemberConfirmTitle")}</p>
              <p className="mt-1">
                {t("removeMemberConfirmBody", {
                  name: removeTarget.user?.fullName ?? removeTarget.userId,
                })}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className={styles.dangerButton}
                  disabled={Boolean(removeProjectMember?.isPending)}
                  onClick={() => void handleConfirmRemove()}
                >
                  {t("confirmRemoveButton")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={styles.outlineButton}
                  onClick={() => setRemoveTarget(null)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}

          {projectMembers?.isPending && !projectMembers.data ? (
            <Loading columns={4} />
          ) : projectMembers?.isError && !projectMembers.data ? (
            <ErrorState retry={() => void projectMembers.refetch()} />
          ) : memberRows.length ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-xs">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-start">
                      {t("memberNameHeader")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start">
                      {t("memberRoleHeader")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start">
                      {t("memberStatusHeader")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start">
                      {t("joinedAtHeader")}
                    </th>
                    {canManageProjects && (
                      <th scope="col" className="px-3 py-2 text-end">
                        {t("actions")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {memberRows.map((member) => {
                    const displayName = member.user?.fullName ?? member.userId;
                    const soleLeader = isKnownSoleLeader(member);
                    return (
                      <tr key={member.id}>
                        <td className="px-3 py-2.5">
                          <span className="block font-medium text-gray-900 dark:text-gray-100">
                            {displayName}
                          </span>
                          {member.user?.email && (
                            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                              {member.user.email}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {canManageProjects &&
                          member.status === "ACTIVE" &&
                          !isLocked ? (
                            <select
                              aria-label={t("changeRoleLabel", {
                                name: displayName,
                              })}
                              value={member.roleCode}
                              disabled={
                                soleLeader ||
                                Boolean(changeProjectMemberRole?.isPending)
                              }
                              title={
                                soleLeader ? t("lastLeaderProtected") : undefined
                              }
                              onChange={(event) =>
                                void handleRoleChange(
                                  member,
                                  event.target
                                    .value as PlatformProjectMemberRoleCode,
                                )
                              }
                              className={`${input} ${styles.compactSelect} h-8 rounded-md px-2 text-xs`}
                            >
                              <option value="TEAM_LEADER">
                                {t("roleTEAM_LEADER")}
                              </option>
                              <option value="MEMBER">{t("roleMEMBER")}</option>
                            </select>
                          ) : (
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {t(`role${member.roleCode}`)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            status={
                              member.status === "ACTIVE" ? "ACTIVE" : "REMOVED"
                            }
                            label={t(`memberStatus${member.status}`)}
                          />
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-gray-600 dark:text-gray-300">
                          {member.joinedAt
                            ? dateTimeFormatter.format(
                                new Date(member.joinedAt),
                              )
                            : "—"}
                        </td>
                        {canManageProjects && (
                          <td className="px-3 py-2.5 text-end whitespace-nowrap">
                            {member.status === "ACTIVE" ? (
                              <button
                                type="button"
                                disabled={isLocked || soleLeader}
                                title={
                                  soleLeader
                                    ? t("lastLeaderProtected")
                                    : undefined
                                }
                                onClick={() => setRemoveTarget(member)}
                                className={`${styles.ghostDangerButton} inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-rose-300 dark:hover:bg-rose-950/50`}
                              >
                                <TrashBinIcon
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                />
                                <span>{t("removeMember")}</span>
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {t("noMembersFound")}
            </p>
          )}

          {canManageProjects && memberRows.some((m) => m.status === "ACTIVE") && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <label className="inline-flex items-center gap-2">
                <span>{t("reasonCodeLabel")}:</span>
                <select
                  disabled={isLocked}
                  value={memberReasonCode}
                  onChange={(event) =>
                    setMemberReasonCode(
                      event.target.value as
                        | "ACCESS_REVIEW"
                        | "SECURITY_INCIDENT",
                    )
                  }
                  className={`${input} ${styles.compactSelect} h-7 rounded px-2 text-[11px]`}
                >
                  <option value="ACCESS_REVIEW">
                    {t("reasonAccessReview")}
                  </option>
                  <option value="SECURITY_INCIDENT">
                    {t("reasonSecurityIncident")}
                  </option>
                </select>
              </label>
            </div>
          )}

          {projectMembers?.data && setProjectMemberPage && (
            <PlatformPagination
              ariaLabel={t("membersTab")}
              {...projectMembers.data.pagination}
              returnedItems={memberRows.length}
              page={projectMemberPage}
              onPageChange={setProjectMemberPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformProjectDirectory");
  const { selectedId, setSelectedId, selectedProject } = model;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => {
      if (dialog) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, [selectedId]);

  return (
    <>
      {selectedId && (
        <dialog
          ref={dialogRef}
          aria-labelledby="project-detail-title"
          onCancel={() => setSelectedId("")}
          className={`${dialogStyles.surface} ${dialogStyles.native} ${styles.detail}`}
        >
          <section className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="project-detail-title" className="text-base font-bold">
                {t("detailTitle")}
              </h2>
              <button
                type="button"
                aria-label={t("close")}
                className={styles.close}
                onClick={() => setSelectedId("")}
              >
                <CloseIcon aria-hidden="true" />
              </button>
            </div>
            {selectedProject.data !== undefined &&
              !isReadAccessLost(selectedProject.error) &&
              (selectedProject.isFetching ||
                selectedProject.isRefetchError) && (
                <div className="mb-4">
                  <QueryRefreshStatus
                    hasData
                    isFetching={selectedProject.isFetching}
                    isRefetchError={selectedProject.isRefetchError}
                    onRetry={() => void selectedProject.refetch()}
                  />
                </div>
              )}
            {selectedProject.isPending && !selectedProject.data ? (
              <Loading columns={3} />
            ) : selectedProject.isError &&
              (!selectedProject.data ||
                isReadAccessLost(selectedProject.error)) ? (
              <ErrorState retry={() => void selectedProject.refetch()} />
            ) : selectedProject.data ? (
              <ProjectDetailBody
                key={selectedProject.data.id}
                project={selectedProject.data}
                model={model}
              />
            ) : null}
          </section>
        </dialog>
      )}
    </>
  );
}
