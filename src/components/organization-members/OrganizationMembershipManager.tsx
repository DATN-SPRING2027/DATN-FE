"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery, type CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import { canManageOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Label from "@/components/form/Label";
import { GroupIcon, MailIcon, SearchIcon, TimeIcon, UserIcon } from "@/icons";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  createIdempotencyKey,
  type MembershipListFilter,
} from "@/lib/queries/organization-memberships/organization-memberships.service";
import type { InviteMemberInput } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  useCancelOrganizationInvitation,
  useInviteOrganizationMember,
  useOrganizationInvitationsQuery,
  useOrganizationMembershipsQuery,
  useResendOrganizationInvitation,
  useCancelOrganizationInvitation,
  useSetOrganizationMembershipRole,
  useSuspendOrganizationMembership,
  type IdempotentInput,
} from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import type {
  CancelInvitationInput,
  OrganizationMembership,
  OrganizationRoleCode,
  ResendInvitationInput,
  SetOrganizationMembershipRoleInput,
  SuspendMembershipInput,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
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

function getErrorMessageKey(error: unknown, fallbackKey = "failure"): string {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "INVALID_ORGANIZATION_MEMBERSHIP_RESPONSE") return "invalidResponse";
  if (error.status === 403 || error.code === "ORGANIZATION_MEMBERSHIP_FORBIDDEN") return "forbidden";
  if (error.status === 401) return "unauthorized";
  if (error.status === 404) return "notFound";
  if (error.status === 409) return error.code === "LAST_ELIGIBLE_ADMIN" ? "lastAdmin" : "conflict";
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
    <div role="status" aria-label={label} aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex animate-pulse items-center gap-4 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="size-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="hidden h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-800 sm:block" />
        </div>
      ))}
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
    <div className="w-full sm:w-52">
      <Label htmlFor="organization-members-status">{t("statusColumn")}</Label>
      <select
        id="organization-members-status"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as MembershipStatusFilter)}
        className="h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
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
  const inviteDialog = useModal();
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
  const roleChange = useSetOrganizationMembershipRole(actorId, organizationId);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const inviteAttempt = useRef<{ input: InviteMemberInput; idempotencyKey: string } | null>(null);
  const roleAttempt = useRef<{
    input: SetOrganizationMembershipRoleInput & { membershipId: string };
    idempotencyKey: string;
  } | null>(null);
  const actionMutation =
    target?.action === "suspend" ? suspend :
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

  async function recoverActionBeforeNewCommand() {
    setIsRefreshingAction(true);
    setActionRefreshFailed(false);
    try {
      if (await refreshLists()) {
        actionMutation?.reset();
        setTarget(null);
        setNotice(false);
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
    suspend.reset();
    resend.reset();
    cancel.reset();
    setNotice(false);
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
    if (!canManage || invite.isPending || hasUnresolvedMutation) return;
    const previousAttempt = inviteAttempt.current;
    const idempotencyKey =
      previousAttempt?.input.email === input.email && previousAttempt.input.reasonCode === input.reasonCode
        ? previousAttempt.idempotencyKey
        : createIdempotencyKey();
    inviteAttempt.current = { input, idempotencyKey };

    try {
      await invite.mutateAsync({ input, idempotencyKey });
      inviteAttempt.current = null;
      inviteDialog.closeModal();
      setInviteSuccess(true);
    } catch {
      // Keep the exact request and idempotency key available for a safe retry.
    }
  }

  function closeAction() {
    if (actionMutation?.isPending || actionMutation?.isError) return;
    setTarget(null);
  }

  async function executeAction(actionTarget: MembershipActionTarget, reasonCode: MembershipActionReasonCode, idempotencyKey = createIdempotencyKey()) {
    if (!canManage) return;
    if (actionTarget.action === "suspend") {
      await suspend.mutateAsync({
        input: {
          membershipId: actionTarget.membership.id,
          expectedMembershipVersion: actionTarget.membership.version,
          reasonCode: reasonCode as SuspendMembershipInput["reasonCode"],
        },
        idempotencyKey,
      });
    } else if (actionTarget.action === "resend") {
      await resend.mutateAsync({
        input: {
          invitationId: actionTarget.invitation.id,
          expectedInvitationVersion: actionTarget.invitation.version,
          reasonCode: reasonCode as ResendInvitationInput["reasonCode"],
        },
        idempotencyKey,
      });
    } else {
      await cancel.mutateAsync({
        input: {
          invitationId: actionTarget.invitation.id,
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
    if (!target || !canManage) return;
    void executeAction(target, reasonCode).catch(() => undefined);
  }

  function retryAction() {
    if (!target || !actionMutation?.variables) return;
    const key = actionMutation.variables.idempotencyKey;
    const reasonCode = actionMutation.variables.input.reasonCode;
    void executeAction(target, reasonCode, key).catch(() => undefined);
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

  return (
    <div className="space-y-5">
      <nav aria-label={t("breadcrumbLabel")} className="pb-1">
        <ol className="flex items-center gap-2 text-sm">
          <li><Link href="/" className="text-gray-500 transition hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-300">{t("home")}</Link></li>
          <li aria-hidden="true" className="text-gray-400">›</li>
          <li aria-current="page" className="font-medium text-gray-800 dark:text-white/90">{t("title")}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/3 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300 sm:size-16">
            <GroupIcon className="size-8" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">{t("organizationScope")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white/95 sm:text-3xl">{t("title")}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">{t("description")}</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openInviteDialog} startIcon={<UserIcon className="size-4" aria-hidden="true" />} className="w-full shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto">
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

      <section aria-labelledby="organization-members-heading" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/3 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-gray-800 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 id="organization-members-heading" className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("membersTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("membersDescription")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-64">
              <label htmlFor="organization-members-search" className="sr-only">{t("searchMembers")}</label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="organization-members-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t("searchMembers")}
                  aria-describedby="organization-members-search-hint"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white ps-10 pe-3 text-sm text-gray-800 shadow-theme-xs outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500"
                />
              </div>
              <span id="organization-members-search-hint" className="sr-only">{t("searchLoadedPageHint")}</span>
            </div>
            <MembershipStatusSelect value={status} disabled={memberships.isFetching} onChange={(next) => { setStatus(next); setMembershipPage(1); }} />
          </div>
        </div>

        <div className="pt-5">
          {memberships.isFetching && <ListLoadingPanel label={t("membersLoading")} />}
          {memberships.isError && !memberships.isFetching && <MembershipError error={memberships.error} retry={() => { void memberships.refetch(); }} />}
          {readyMembers && readyMembers.data.length === 0 && (
            <div role="status" className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center dark:border-gray-700">
              <span aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><GroupIcon className="size-6" /></span>
              <p className="mt-3 text-sm font-medium text-gray-800 dark:text-white/90">{t("membersEmpty")}</p>
            </div>
          )}
          {readyMembers && readyMembers.data.length > 0 && (
            <OrganizationMembershipList
              page={readyMembers}
              actorId={actorId}
              actionsDisabled={hasUnresolvedMutation || !canManage}
              searchTerm={searchTerm}
              onPageChange={setMembershipPage}
              onSuspend={(membership: OrganizationMembership) => openAction({ action: "suspend", membership })}
              onSetRole={openRoleDialog}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="organization-invitations-heading" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/3 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300"><TimeIcon className="size-6" /></span>
          <div>
            <h2 id="organization-invitations-heading" className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("invitationsTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("invitationsDescription")}</p>
          </div>
        </div>
        <div className="mt-5">
          {invitations.isFetching && <ListLoadingPanel label={t("invitationsLoading")} />}
          {invitations.isError && !invitations.isFetching && <MembershipError error={invitations.error} invitation retry={() => { void invitations.refetch(); }} />}
          {readyInvitations && readyInvitations.data.length === 0 && (
            <div role="status" className="flex min-h-32 flex-col items-center justify-center rounded-xl bg-gray-50/80 px-5 py-7 text-center dark:bg-white/2">
              <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><MailIcon className="size-6" /></span>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">{t("invitationsEmpty")}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("invitationsEmptyDescription")}</p>
            </div>
          )}
          {readyInvitations && readyInvitations.data.length > 0 && (
            <OrganizationInvitationList page={readyInvitations} actionsEnabled={canManage && !hasUnresolvedMutation} onPageChange={setInvitationPage} onAction={(action, invitation) => openAction({ action, invitation })} />
          )}
        </div>
      </section>

      <OrganizationMembershipActionDialog
        key={target ? `${target.action}:${target.action === "suspend" ? target.membership.id : target.invitation.id}` : "closed"}
        target={target}
        error={modalError}
        isPending={actionMutation?.isPending ?? false}
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
        isPending={invite.isPending}
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
  if (currentUser.isFetching) return <LoadingPanel label={t("contextLoading")} />;
  if (currentUser.isError) return <MembershipError error={currentUser.error} retry={() => { void currentUser.refetch(); }} />;
  const user = currentUser.data;
  const organizationId = user?.organizationId;
  if (!user || !organizationId || !isOrganizationResourceId(organizationId)) {
    return <div role="status" className="rounded-xl border border-warning-200 bg-warning-50 px-5 py-8 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">{t("noOrganization")}</div>;
  }
  return <ScopedOrganizationMemberships key={`${user.id}:${organizationId}`} actorId={user.id} organizationId={organizationId} currentUser={user} />;
}
