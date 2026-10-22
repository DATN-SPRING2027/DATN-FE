"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery, type CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import { canManageOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { useModal } from "@/hooks/useModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Label from "@/components/form/Label";
import { MailIcon, SearchIcon, UserIcon } from "@/icons";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { organizationMembershipReadiness } from "@/lib/queries/organization-memberships/organization-membership-readiness";
import { createIdempotencyKey, type MembershipListFilter } from "@/lib/queries/organization-memberships/organization-memberships.service";
import type {
  AdminInvitation,
  CancelInvitationInput,
  InviteMemberInput,
  OrganizationMembership,
  OrganizationRoleCode,
  RemoveMembershipInput,
  ResendInvitationInput,
  ResumeMembershipInput,
  SetOrganizationMembershipRoleInput,
  SuspendMembershipInput,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  useCancelOrganizationInvitation,
  useInviteOrganizationMember,
  useOrganizationInvitationsQuery,
  useOrganizationMembershipsQuery,
  useRemoveOrganizationMembership,
  useResendOrganizationInvitation,
  useResumeOrganizationMembership,
  useSetOrganizationMembershipRole,
  useSuspendOrganizationMembership,
  type IdempotentInput,
} from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import OrganizationMembershipStats from "./OrganizationMembershipStats";
import OrganizationMembershipList from "./OrganizationMembershipList";
import OrganizationInvitationList from "./OrganizationInvitationList";
import OrganizationInvitationCreateDialog from "./OrganizationInvitationCreateDialog";
import OrganizationMembershipActionDialog, {
  type MembershipActionReasonCode,
  type MembershipActionTarget,
} from "./OrganizationMembershipActionDialog";
import OrganizationMembershipRoleDialog from "./OrganizationMembershipRoleDialog";

const pageSize = 20;
type MembershipStatusFilter = "ALL" | NonNullable<MembershipListFilter["status"]>;
type DirectoryTab = "members" | "invitations";

function getErrorMessageKey(error: unknown, fallbackKey = "failure"): string {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE") return "invalidResponse";
  if (error.status === 403 || error.code === "ORGANIZATION_MEMBERSHIP_FORBIDDEN") return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 404) return "notFound";
  if (error.status === 409) {
    if (error.code === "LAST_ELIGIBLE_ADMIN") return "lastAdmin";
    if (error.code === "MEMBER_HAS_ACTIVE_PROJECT_LEADERSHIP") return "activeProjectLeaderBlocker";
    return "conflict";
  }
  if (error.status === 422) return "validation";
  if (error.status === 429) return "rateLimit";
  if (error.status === 503) return "dependencyUnavailable";
  return fallbackKey;
}

function LoadingPanel({ label }: { label: string }) {
  return <div role="status" className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-8 text-center text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">{label}</div>;
}

function ListLoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="hidden grid-cols-4 gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 lg:grid dark:border-gray-800 dark:bg-white/2">
        <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div aria-hidden="true" className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4 sm:px-5">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="hidden h-6 w-20 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MembershipError({ error, retry, invitation = false }: { error: unknown; retry: () => void; invitation?: boolean }) {
  const t = useTranslations("organizationMembers");
  const errorKey = getErrorMessageKey(error, invitation ? "invitationLoadError" : "loadError");
  return (
    <div role="alert" className="space-y-3">
      <Alert variant="error" title={t("errorTitle")} message={t(errorKey)} />
      <Button size="sm" variant="outline" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" onClick={retry}>{t("retryLoad")}</Button>
    </div>
  );
}

function MembershipStatusSelect({ value, disabled, onChange }: { value: MembershipStatusFilter; disabled: boolean; onChange: (status: MembershipStatusFilter) => void }) {
  const t = useTranslations("organizationMembers");
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="organization-members-status" className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
        {t("statusFilterLabel")}
      </Label>
      <select
        id="organization-members-status"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as MembershipStatusFilter)}
        className="h-9 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs sm:text-sm font-medium text-gray-700 shadow-theme-xs transition-colors hover:border-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
      >
        <option value="ALL">{t("allStatuses")}</option>
        <option value="PENDING_INVITE">{t("PENDING_INVITE")}</option>
        <option value="ACTIVE">{t("ACTIVE")}</option>
        <option value="SUSPENDED">{t("SUSPENDED")}</option>
        <option value="REMOVED">{t("REMOVED")}</option>
      </select>
    </div>
  );
}

function ScopedOrganizationMemberships({
  actorId,
  organizationId,
  currentUser,
}: {
  actorId: string;
  organizationId: string;
  currentUser?: CurrentUserResponse;
}) {
  const t = useTranslations("organizationMembers");
  const canManage = canManageOrganizationMemberships(currentUser);
  const queryClient = useQueryClient();
  const cachedOrganizations = queryClient.getQueryData<readonly { id: string; name: string }[]>(["auth", "organizations"]);
  const organizationName = cachedOrganizations?.find((org) => org.id === organizationId)?.name;
  const inviteDialog = useModal();
  const [activeTab, setActiveTab] = useState<DirectoryTab>("members");
  const tabRefs = useRef<Record<DirectoryTab, HTMLButtonElement | null>>({ members: null, invitations: null });
  const [status, setStatus] = useState<MembershipStatusFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [membershipPage, setMembershipPage] = useState(1);
  const [invitationPage, setInvitationPage] = useState(1);
  const [target, setTarget] = useState<MembershipActionTarget | null>(null);
  const [roleTarget, setRoleTarget] = useState<OrganizationMembership | null>(null);
  const [notice, setNotice] = useState(false);
  const [isRefreshingAction, setIsRefreshingAction] = useState(false);
  const [actionRefreshFailed, setActionRefreshFailed] = useState(false);
  const [isRefreshingRole, setIsRefreshingRole] = useState(false);
  const [roleRefreshFailed, setRoleRefreshFailed] = useState(false);
  const filter: MembershipListFilter = {
    page: membershipPage,
    pageSize,
    ...(status === "ALL" ? {} : { status }),
  };
  const memberships = useOrganizationMembershipsQuery(actorId, organizationId, filter);
  const invitations = useOrganizationInvitationsQuery(actorId, organizationId, invitationPage, pageSize);
  const invite = useInviteOrganizationMember(actorId, organizationId);
  const resend = useResendOrganizationInvitation(actorId, organizationId);
  const cancel = useCancelOrganizationInvitation(actorId, organizationId);
  const suspend = useSuspendOrganizationMembership(actorId, organizationId);
  const resume = useResumeOrganizationMembership(actorId, organizationId);
  const remove = useRemoveOrganizationMembership(actorId, organizationId);
  const roleChange = useSetOrganizationMembershipRole(actorId, organizationId);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inviteAttempt = useRef<{ input: InviteMemberInput; idempotencyKey: string } | null>(null);
  const roleAttempt = useRef<{
    input: SetOrganizationMembershipRoleInput & { membershipId: string };
    idempotencyKey: string;
  } | null>(null);
  const canSendInvitation = canManage && organizationMembershipReadiness.invitationCommands.status === "READY";
  const canManageInvitationCommands = canManage && organizationMembershipReadiness.invitationCommands.status === "READY";
  const actionMutation =
    target?.action === "suspend" ? suspend :
      target?.action === "resume" ? resume :
        target?.action === "remove" ? remove :
          target?.action === "resend" ? resend :
            target?.action === "cancel" ? cancel : undefined;
  const hasUnresolvedMutation = Boolean(
    actionMutation?.isPending || actionMutation?.isError || roleChange.isPending || roleChange.isError,
  );

  async function refreshLists(): Promise<boolean> {
    const results = await Promise.all([
      memberships.refetch({ throwOnError: true }),
      invitations.refetch({ throwOnError: true }),
    ]);
    return results.every((result) => !result.isError);
  }

  function resetActionMutation(actionTarget: MembershipActionTarget | null) {
    if (actionTarget?.action === "suspend") suspend.reset();
    if (actionTarget?.action === "resume") resume.reset();
    if (actionTarget?.action === "remove") remove.reset();
    if (actionTarget?.action === "resend") resend.reset();
    if (actionTarget?.action === "cancel") cancel.reset();
  }

  async function recoverActionBeforeNewCommand() {
    setIsRefreshingAction(true);
    setActionRefreshFailed(false);
    try {
      if (await refreshLists()) {
        resetActionMutation(target);
        setTarget(null);
        setNotice(false);
        setResendSuccess(false);
      } else {
        setActionRefreshFailed(true);
      }
    } catch {
      setActionRefreshFailed(true);
    } finally {
      setIsRefreshingAction(false);
    }
  }

  function openAction(next: MembershipActionTarget) {
    if (hasUnresolvedMutation || !canManage) return;
    if ((next.action === "resend" || next.action === "cancel") && !canManageInvitationCommands) return;
    suspend.reset();
    resume.reset();
    remove.reset();
    resend.reset();
    cancel.reset();
    setNotice(false);
    setResendSuccess(false);
    setActionRefreshFailed(false);
    setTarget(next);
  }

  function openInviteDialog() {
    if (hasUnresolvedMutation) return;
    invite.reset();
    setInviteSuccess(false);
    inviteDialog.openModal();
  }

  function closeInviteDialog() {
    if (invite.isPending) return;
    inviteDialog.closeModal();
  }

  async function submitInvite(input: InviteMemberInput) {
    if (!canSendInvitation || invite.isPending || hasUnresolvedMutation) return;
    const previousAttempt = inviteAttempt.current;
    const idempotencyKey =
      previousAttempt && JSON.stringify(previousAttempt.input) === JSON.stringify(input)
        ? previousAttempt.idempotencyKey
        : createIdempotencyKey();
    inviteAttempt.current = { input, idempotencyKey };

    try {
      await invite.mutateAsync({ input, idempotencyKey });
      inviteAttempt.current = null;
      setInviteSuccess(true);
    } catch {
      // Keep the exact request and idempotency key available for a safe retry.
    }
  }

  function closeAction() {
    if (actionMutation?.isPending || actionMutation?.isError) return;
    setResendSuccess(false);
    setTarget(null);
  }

  const isMembershipTargetAction = (action: MembershipActionTarget["action"]) =>
    action === "suspend" || action === "resume" || action === "remove";

  async function executeAction(actionTarget: MembershipActionTarget, reasonCode: MembershipActionReasonCode, idempotencyKey = createIdempotencyKey()) {
    if (!canManage || (!isMembershipTargetAction(actionTarget.action) && !canManageInvitationCommands)) return;
    if (actionTarget.action === "suspend") {
      await suspend.mutateAsync({
        input: {
          membershipId: actionTarget.membership.id,
          expectedMembershipVersion: actionTarget.membership.version,
          reasonCode: reasonCode as SuspendMembershipInput["reasonCode"],
        },
        idempotencyKey,
      });
    } else if (actionTarget.action === "resume") {
      await resume.mutateAsync({
        input: {
          membershipId: actionTarget.membership.id,
          expectedMembershipVersion: actionTarget.membership.version,
          reasonCode: reasonCode as ResumeMembershipInput["reasonCode"],
        },
        idempotencyKey,
      });
    } else if (actionTarget.action === "remove") {
      await remove.mutateAsync({
        input: {
          membershipId: actionTarget.membership.id,
          expectedMembershipVersion: actionTarget.membership.version,
          reasonCode: reasonCode as RemoveMembershipInput["reasonCode"],
        },
        idempotencyKey,
      });
    } else if (actionTarget.action === "resend") {
      const ack = await resend.mutateAsync({
        input: {
          invitationId: actionTarget.invitation.id,
          expectedMembershipVersion: 0,
          expectedInvitationVersion: actionTarget.invitation.version,
          reasonCode: reasonCode as ResendInvitationInput["reasonCode"],
        },
        idempotencyKey,
      });
      if ("invitation" in ack && ack.invitation) {
        setTarget({
          action: "resend",
          invitation: {
            ...actionTarget.invitation,
            status: ack.invitation.status,
            version: ack.invitation.version,
            expiresAt: ack.invitation.expiresAt,
          },
        });
      }
      setResendSuccess(true);
      setNotice(true);
      return;
    } else if (actionTarget.action === "cancel") {
      await cancel.mutateAsync({
        input: {
          invitationId: actionTarget.invitation.id,
          expectedMembershipVersion: 0,
          expectedInvitationVersion: actionTarget.invitation.version,
          reasonCode: "INVITATION_CANCELLED" satisfies CancelInvitationInput["reasonCode"],
        },
        idempotencyKey,
      });
    }
    setTarget(null);
    setNotice(true);
  }

  function confirmAction(reasonCode: MembershipActionReasonCode) {
    if (!target || hasUnresolvedMutation) return;
    if (!isMembershipTargetAction(target.action) && !canManageInvitationCommands) return;
    void executeAction(target, reasonCode).catch(() => undefined);
  }

  function retryAction() {
    if (!target) return;
    if (target.action === "suspend" && suspend.variables) {
      void executeAction(target, suspend.variables.input.reasonCode, suspend.variables.idempotencyKey).catch(() => undefined);
    } else if (target.action === "resume" && resume.variables) {
      void executeAction(target, resume.variables.input.reasonCode, resume.variables.idempotencyKey).catch(() => undefined);
    } else if (target.action === "remove" && remove.variables) {
      void executeAction(target, remove.variables.input.reasonCode, remove.variables.idempotencyKey).catch(() => undefined);
    } else if (target.action === "resend" && resend.variables) {
      void executeAction(target, resend.variables.input.reasonCode, resend.variables.idempotencyKey).catch(() => undefined);
    } else if (target.action === "cancel" && cancel.variables) {
      void executeAction(target, cancel.variables.input.reasonCode, cancel.variables.idempotencyKey).catch(() => undefined);
    }
  }

  function openRoleDialog(membership: OrganizationMembership) {
    if (
      !canManage ||
      hasUnresolvedMutation ||
      membership.status !== "ACTIVE" ||
      membership.userId.toLowerCase() === actorId.toLowerCase()
    ) return;
    roleChange.reset();
    setRoleRefreshFailed(false);
    setNotice(false);
    setResendSuccess(false);
    setRoleTarget(membership);
  }

  async function executeRoleChange(
    input: IdempotentInput<SetOrganizationMembershipRoleInput & { membershipId: string }>,
  ) {
    await roleChange.mutateAsync(input);
    roleAttempt.current = null;
    setRoleTarget(null);
    setNotice(true);
  }

  function submitRoleChange(roleCode: OrganizationRoleCode, reason: string) {
    if (!roleTarget || !canManage || hasUnresolvedMutation) return;
    const input: SetOrganizationMembershipRoleInput & { membershipId: string } = {
      membershipId: roleTarget.id,
      expectedMembershipVersion: roleTarget.version,
      expectedRoleVersion: roleTarget.roleVersion,
      roleCode,
      reason: reason.trim(),
    };
    const previousAttempt = roleAttempt.current;
    const matchesPrevious = Boolean(
      previousAttempt &&
      previousAttempt.input.membershipId === input.membershipId &&
      previousAttempt.input.expectedMembershipVersion === input.expectedMembershipVersion &&
      previousAttempt.input.expectedRoleVersion === input.expectedRoleVersion &&
      previousAttempt.input.roleCode === input.roleCode &&
      previousAttempt.input.reason === input.reason,
    );
    const idempotencyKey = matchesPrevious
      ? previousAttempt!.idempotencyKey
      : createIdempotencyKey();
    roleAttempt.current = { input, idempotencyKey };
    void executeRoleChange({ input, idempotencyKey }).catch(() => undefined);
  }

  function retryRoleChange() {
    if (!roleChange.variables) return;
    void executeRoleChange(roleChange.variables).catch(() => undefined);
  }

  function closeRoleDialog() {
    if (roleChange.isPending || roleChange.isError || isRefreshingRole) return;
    setRoleTarget(null);
  }

  async function recoverRoleBeforeNewAction() {
    setIsRefreshingRole(true);
    setRoleRefreshFailed(false);
    try {
      if (await refreshLists()) {
        roleChange.reset();
        roleAttempt.current = null;
        setRoleTarget(null);
        setNotice(false);
        setResendSuccess(false);
      } else {
        setRoleRefreshFailed(true);
      }
    } catch {
      setRoleRefreshFailed(true);
    } finally {
      setIsRefreshingRole(false);
    }
  }

  const readyMembers = memberships.isSuccess && !memberships.isFetching ? memberships.data : undefined;
  const readyInvitations = invitations.isSuccess && !invitations.isFetching ? invitations.data : undefined;
  const modalError = actionMutation?.isError ? actionMutation.error : undefined;

  function changeTab(next: DirectoryTab) {
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: DirectoryTab) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: DirectoryTab = event.key === "Home"
      ? "members"
      : event.key === "End"
        ? "invitations"
        : current === "members"
          ? "invitations"
          : "members";
    changeTab(next);
  }

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle={t("membersTab")}
        homeLabel={t("home")}
        breadcrumbLabel={t("breadcrumbLabel")}
        items={[{ label: t("organizationBreadcrumb") }]}
        showTitle={false}
      />

      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{t("organizationScope")}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{t("membersTab")}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">{t("description")}</p>
        </div>
        {canManage && (
          <Button onClick={openInviteDialog} startIcon={<UserIcon className="size-4" aria-hidden="true" />} className="w-full shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto">
            {t("inviteButton")}
          </Button>
        )}
      </header>

      {notice && <div role="status" aria-live="polite" className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">{t("actionAccepted")}</div>}
      {inviteSuccess && <div role="status" aria-live="polite" className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">{t("inviteAccepted")}</div>}

      <OrganizationMembershipStats
        actorId={actorId}
        organizationId={organizationId}
        pendingCount={readyInvitations?.pagination.totalItems}
        pendingCountUnavailable={invitations.isError}
      />

      <section aria-label={t("directoryLabel")} className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/3">
        <div role="tablist" aria-label={t("directoryTabsLabel")} className="flex gap-6 border-b border-gray-100 px-4 sm:px-6 dark:border-gray-800">
          <button
            ref={(element) => { tabRefs.current.members = element; }}
            id="organization-members-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "members"}
            aria-controls="organization-members-panel"
            tabIndex={activeTab === "members" ? 0 : -1}
            onClick={() => setActiveTab("members")}
            onKeyDown={(event) => onTabKeyDown(event, "members")}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${activeTab === "members" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"}`}
          >
            {t("membersTab")}
            {readyMembers && <span aria-hidden="true" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">{readyMembers.pagination.totalItems}</span>}
          </button>
          <button
            ref={(element) => { tabRefs.current.invitations = element; }}
            id="organization-invitations-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "invitations"}
            aria-controls="organization-invitations-panel"
            tabIndex={activeTab === "invitations" ? 0 : -1}
            onClick={() => setActiveTab("invitations")}
            onKeyDown={(event) => onTabKeyDown(event, "invitations")}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${activeTab === "invitations" ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"}`}
          >
            {t("invitationsTab")}
            {readyInvitations && <span aria-hidden="true" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">{readyInvitations.pagination.totalItems}</span>}
          </button>
        </div>

        <div id="organization-members-panel" role="tabpanel" aria-labelledby="organization-members-tab" tabIndex={0} hidden={activeTab !== "members"} className="p-4 sm:p-6">
          {activeTab === "members" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="w-full sm:w-64">
                    <label htmlFor="organization-members-search" className="sr-only">{t("searchMembers")}</label>
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        id="organization-members-search"
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t("searchMembers")}
                        aria-describedby="organization-members-search-hint"
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white ps-9 pe-3 text-xs sm:text-sm text-gray-800 shadow-theme-xs outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500"
                      />
                    </div>
                    <span id="organization-members-search-hint" className="sr-only">{t("searchLoadedPageHint")}</span>
                  </div>
                  <MembershipStatusSelect value={status} disabled={memberships.isFetching} onChange={(next) => { setStatus(next); setMembershipPage(1); }} />
                  {status !== "ALL" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      onClick={() => { setStatus("ALL"); setMembershipPage(1); }}
                    >
                      {t("clearFilters")}
                    </Button>
                  )}
                </div>
                {readyMembers ? (
                  <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-gray-200/80 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-theme-xs sm:self-auto dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                    <span aria-live="polite" className="tabular-nums">{t("membersCount", { count: readyMembers.pagination.totalItems })}</span>
                  </div>
                ) : memberships.isFetching ? (
                  <div aria-hidden="true" className="h-6 w-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
                ) : <span />}
              </div>
              {memberships.isFetching && <ListLoadingPanel label={t("membersLoading")} />}
              {memberships.isError && !memberships.isFetching && <MembershipError error={memberships.error} retry={() => { void memberships.refetch(); }} />}
              {readyMembers && readyMembers.data.length === 0 && (
                <div role="status" className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 px-4 text-center dark:border-gray-800">
                  <span aria-hidden="true" className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-8 ring-brand-50/50 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/5">
                    <UserIcon className="size-5" />
                  </span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{status === "ALL" ? t("noMembersYet") : t("membersEmpty")}</p>
                  <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{status === "ALL" ? t("noMembersDescription") : t("membersEmptyDescription")}</p>
                  {status === "ALL" && canManage && (
                    <Button size="sm" className="mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" onClick={openInviteDialog}>
                      {t("inviteButton")}
                    </Button>
                  )}
                </div>
              )}
              {readyMembers && readyMembers.data.length > 0 && (
                <OrganizationMembershipList
                  page={readyMembers}
                  actorId={actorId}
                  canManageActions={canManage}
                  actionsDisabled={hasUnresolvedMutation}
                  searchTerm={searchTerm}
                  onPageChange={setMembershipPage}
                  onSuspend={(membership: OrganizationMembership) => openAction({ action: "suspend", membership })}
                  onResume={(membership: OrganizationMembership) => openAction({ action: "resume", membership })}
                  onRemove={(membership: OrganizationMembership) => openAction({ action: "remove", membership })}
                  onSetRole={openRoleDialog}
                />
              )}
            </div>
          )}
        </div>

        <div id="organization-invitations-panel" role="tabpanel" aria-labelledby="organization-invitations-tab" tabIndex={0} hidden={activeTab !== "invitations"} className="p-4 sm:p-6">
          {activeTab === "invitations" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/2">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("invitationsTitle")}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("invitationsDescription")}</p>
                </div>
                {readyInvitations && (
                  <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-gray-200/80 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 shadow-theme-xs sm:self-auto dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <span className="size-1.5 rounded-full bg-warning-500" aria-hidden="true" />
                    <span aria-live="polite" className="tabular-nums">{t("invitationsCount", { count: readyInvitations.pagination.totalItems })}</span>
                  </div>
                )}
              </div>
              {invitations.isFetching && <ListLoadingPanel label={t("invitationsLoading")} />}
              {invitations.isError && !invitations.isFetching && <MembershipError error={invitations.error} invitation retry={() => { void invitations.refetch(); }} />}
              {readyInvitations && readyInvitations.data.some((invitation) => invitation.status === "PENDING") && canManage && !canManageInvitationCommands && (
                <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">{t("invitationActionsBlocked")}</p>
              )}
              {readyInvitations && readyInvitations.data.length === 0 && (
                <div role="status" className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 px-4 text-center dark:border-gray-800">
                  <span aria-hidden="true" className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-8 ring-brand-50/50 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/5">
                    <MailIcon className="size-5" />
                  </span>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("invitationsEmpty")}</p>
                  <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{t("invitationsEmptyDescription")}</p>
                </div>
              )}
              {readyInvitations && readyInvitations.data.length > 0 && (
                <OrganizationInvitationList
                  page={readyInvitations}
                  actionsEnabled={canManageInvitationCommands && !hasUnresolvedMutation}
                  onPageChange={setInvitationPage}
                  onAction={(action, invitation: AdminInvitation) => openAction({ action, invitation })}
                />
              )}
            </div>
          )}
        </div>
      </section>

      <OrganizationMembershipActionDialog
        key={target ? `${target.action}:${"membership" in target ? target.membership.id : target.invitation.id}` : "closed"}
        target={target}
        error={modalError}
        isPending={actionMutation?.isPending ?? false}
        isSuccess={target?.action === "resend" && resendSuccess}
        onDismissError={() => { resetActionMutation(target); setResendSuccess(false); setTarget(null); }}
        onResendAgain={() => { resend.reset(); setResendSuccess(false); }}
        onClose={closeAction}
        onConfirm={confirmAction}
        onRetry={retryAction}
        onRefresh={() => void recoverActionBeforeNewCommand()}
        isRecovering={isRefreshingAction}
        refreshFailed={actionRefreshFailed}
      />
      <OrganizationMembershipRoleDialog
        key={`role:${roleTarget?.id ?? "closed"}`}
        membership={roleTarget}
        error={roleChange.isError ? roleChange.error : undefined}
        isPending={roleChange.isPending}
        isRecovering={isRefreshingRole}
        refreshFailed={roleRefreshFailed}
        onClose={closeRoleDialog}
        onSubmit={submitRoleChange}
        onRetry={retryRoleChange}
        onRefresh={() => void recoverRoleBeforeNewAction()}
      />
      {inviteDialog.isOpen && <OrganizationInvitationCreateDialog
        isOpen={inviteDialog.isOpen}
        canSend={canSendInvitation}
        isPending={invite.isPending}
        isSuccess={inviteSuccess}
        organizationId={organizationId}
        organizationName={organizationName}
        allowedRoles={currentUser?.roles?.includes("ADMIN") ? ["MEMBER", "ADMIN"] : ["MEMBER"]}
        onInviteAnother={() => { setInviteSuccess(false); invite.reset(); inviteAttempt.current = null; }}
        onClearError={() => { invite.reset(); }}
        error={invite.isError ? invite.error : undefined}
        onClose={closeInviteDialog}
        onSubmit={(input) => { void submitInvite(input); }}
      />}
    </div>
  );
}

export default function OrganizationMembershipManager() {
  const t = useTranslations("organizationMembers");
  const currentUser = useCurrentUserQuery();
  if (currentUser.isPending) return <LoadingPanel label={t("contextLoading")} />;
  if (currentUser.isError) return <MembershipError error={currentUser.error} retry={() => { void currentUser.refetch(); }} />;
  const user = currentUser.data;
  const organizationId = user?.organizationId;
  if (!user || !organizationId || !isOrganizationResourceId(organizationId)) {
    return <div role="status" className="rounded-xl border border-warning-200 bg-warning-50 px-5 py-8 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">{t("noOrganization")}</div>;
  }
  return <ScopedOrganizationMemberships key={`${user.id}:${organizationId}`} actorId={user.id} organizationId={organizationId} currentUser={user} />;
}
