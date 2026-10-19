"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery, type CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import { canManageOrganizationMemberships } from "@/lib/queries/organization-memberships/organization-membership-permissions";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import { GroupIcon, MailIcon, UserIcon } from "@/icons";
import { isOrganizationResourceId } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import { organizationMembershipReadiness } from "@/lib/queries/organization-memberships/organization-membership-readiness";
import {
  createIdempotencyKey,
  type MembershipListFilter,
} from "@/lib/queries/organization-memberships/organization-memberships.service";
import type { InviteMemberInput } from "@/lib/queries/organization-memberships/organization-memberships.contract";
import {
  useInviteOrganizationMember,
  useOrganizationInvitationsQuery,
  useOrganizationMembershipsQuery,
  useSuspendOrganizationMembership,
  type IdempotentInput,
} from "@/lib/queries/organization-memberships/useOrganizationMemberships";
import type {
  OrganizationMembership,
  SuspendMembershipInput,
} from "@/lib/queries/organization-memberships/organization-memberships.contract";
import OrganizationMembershipList from "./OrganizationMembershipList";
import OrganizationInvitationList from "./OrganizationInvitationList";
import OrganizationInvitationCreateDialog from "./OrganizationInvitationCreateDialog";
import OrganizationMembershipActionDialog, {
  type MembershipActionReasonCode,
  type MembershipActionTarget,
} from "./OrganizationMembershipActionDialog";

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
  const [membershipPage, setMembershipPage] = useState(1);
  const [invitationPage, setInvitationPage] = useState(1);
  const [target, setTarget] = useState<MembershipActionTarget | null>(null);
  const [notice, setNotice] = useState(false);
  const [isRefreshingAction, setIsRefreshingAction] = useState(false);
  const [actionRefreshFailed, setActionRefreshFailed] = useState(false);
  const filter: MembershipListFilter = {
    page: membershipPage,
    pageSize,
    ...(status === "ALL" ? {} : { status }),
  };
  const memberships = useOrganizationMembershipsQuery(actorId, organizationId, filter);
  const invitations = useOrganizationInvitationsQuery(actorId, organizationId, invitationPage, pageSize);
  const invite = useInviteOrganizationMember(actorId, organizationId);
  const suspend = useSuspendOrganizationMembership(actorId, organizationId);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const inviteAttempt = useRef<{ input: InviteMemberInput; idempotencyKey: string } | null>(null);
  const canSendInvitation = organizationMembershipReadiness.invitationCommands.status === "READY";
  const actionMutation = target?.action === "suspend" ? suspend : undefined;
  const hasUnresolvedMutation = Boolean(actionMutation?.isPending || actionMutation?.isError);

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
    if (hasUnresolvedMutation || next.action !== "suspend") return;
    suspend.reset();
    setNotice(false);
    setTarget(next);
  }

  function openInviteDialog() {
    invite.reset();
    setInviteSuccess(false);
    inviteDialog.openModal();
  }

  function closeInviteDialog() {
    if (invite.isPending) return;
    inviteDialog.closeModal();
  }

  async function submitInvite(input: InviteMemberInput) {
    if (!canSendInvitation || invite.isPending) return;
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

  async function executeAction(actionTarget: Extract<MembershipActionTarget, { action: "suspend" }>, reasonCode: MembershipActionReasonCode, idempotencyKey = createIdempotencyKey()) {
    const input: IdempotentInput<SuspendMembershipInput & { membershipId: string }> = {
      input: { membershipId: actionTarget.membership.id, expectedMembershipVersion: actionTarget.membership.version, reasonCode: reasonCode as SuspendMembershipInput["reasonCode"] },
      idempotencyKey,
    };
    await suspend.mutateAsync(input);
    setTarget(null);
    setNotice(true);
  }

  function confirmAction(reasonCode: MembershipActionReasonCode) {
    if (!target || target.action !== "suspend") return;
    void executeAction(target, reasonCode).catch(() => undefined);
  }

  function retryAction() {
    if (!target || target.action !== "suspend" || !actionMutation?.variables) return;
    const key = actionMutation.variables.idempotencyKey;
    const reasonCode = actionMutation.variables.input.reasonCode;
    void executeAction(target, reasonCode, key).catch(() => undefined);
  }

  const readyMembers = memberships.isSuccess && !memberships.isFetching ? memberships.data : undefined;
  const readyInvitations = invitations.isSuccess && !invitations.isFetching ? invitations.data : undefined;
  const modalError = actionMutation?.isError ? actionMutation.error : undefined;

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle={t("title")} homeLabel={t("home")} showTitle={false} breadcrumbLabel={t("breadcrumbLabel")} />
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{t("organizationScope")}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">{t("title")}</h1>
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

      <ComponentCard title={t("membersTitle")} desc={t("membersDescription")}>
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between">
          {readyMembers ? (
            <p aria-live="polite" className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {t("membersCount", { count: readyMembers.pagination.totalItems })}
            </p>
          ) : memberships.isFetching ? (
            <div aria-hidden="true" className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : <span />}
          <MembershipStatusSelect value={status} disabled={memberships.isFetching} onChange={(next) => { setStatus(next); setMembershipPage(1); }} />
        </div>
        {memberships.isFetching && <ListLoadingPanel label={t("membersLoading")} />}
        {memberships.isError && !memberships.isFetching && <MembershipError error={memberships.error} retry={() => { void memberships.refetch(); }} />}
        {readyMembers && readyMembers.data.length === 0 && (
          <div role="status" className="flex items-center gap-4 rounded-xl border border-dashed border-gray-300 px-4 py-5 dark:border-gray-700">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <GroupIcon className="size-5" />
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("membersEmpty")}</p>
          </div>
        )}
        {readyMembers && readyMembers.data.length > 0 && (
          <OrganizationMembershipList
            page={readyMembers}
            actorId={actorId}
            actionsDisabled={hasUnresolvedMutation || !canManage}
            onPageChange={setMembershipPage}
            onSuspend={(membership: OrganizationMembership) => openAction({ action: "suspend", membership })}
          />
        )}
      </ComponentCard>

      <ComponentCard title={t("invitationsTitle")} desc={t("invitationsDescription")}>
        {invitations.isFetching && <ListLoadingPanel label={t("invitationsLoading")} />}
        {invitations.isError && !invitations.isFetching && <MembershipError error={invitations.error} invitation retry={() => { void invitations.refetch(); }} />}
        {readyInvitations && readyInvitations.data.length === 0 && (
          <div role="status" className="flex items-center gap-4 rounded-xl border border-dashed border-gray-300 px-4 py-5 dark:border-gray-700">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <MailIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t("invitationsEmpty")}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("invitationsEmptyDescription")}</p>
            </div>
          </div>
        )}
        {readyInvitations && readyInvitations.data.length > 0 && (
          <OrganizationInvitationList page={readyInvitations} actionsEnabled={organizationMembershipReadiness.invitationCommands.status === "READY"} onPageChange={setInvitationPage} onAction={(action, invitation) => openAction({ action, invitation })} />
        )}
      </ComponentCard>

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
      {inviteDialog.isOpen && <OrganizationInvitationCreateDialog
        isOpen={inviteDialog.isOpen}
        canSend={canSendInvitation}
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
