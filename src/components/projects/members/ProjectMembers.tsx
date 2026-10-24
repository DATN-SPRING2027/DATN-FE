"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  ApiError,
  isAccessOrResourceUnavailableError,
} from "@/lib/api-client";
import { isResourceId } from "@/lib/queries/projects/project-members.contract";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useAddProjectMember,
  useProjectMembersQuery,
  useRemoveProjectMember,
  type ProjectMembership,
} from "@/lib/queries/projects/useProjectMembers";
import {
  useProjectLeaderActions,
  useProjectLeadersQuery,
} from "@/lib/queries/projects/useProjectLeaders";
import ProjectState from "../ProjectState";
import MemberAddForm from "./MemberAddForm";
import MemberNotification from "./MemberNotification";
import MemberDirectory from "./MemberDirectory";
import MemberDetails, { type LeaderRoleStatus } from "./MemberDetails";
import MemberLifecycle from "./MemberLifecycle";
import MemberStatusFilter from "./MemberStatusFilter";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useModal } from "@/hooks/useModal";
import MemberRemoveConfirmation from "./MemberRemoveConfirmation";
import MemberError, { isMemberActionDenied } from "./MemberError";
import { GroupIcon, LockIcon, PlusIcon, SearchIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import { TableSkeleton } from "@/components/platform/ui/LoadingSkeleton";

function ScopedProjectMembers({
  organizationId,
  projectId,
  canAppointLeaders,
  showAddButton,
  addModalOpen: controlledAddModalOpen,
  onOpenAdd,
  onCloseAdd,
}: {
  organizationId: string;
  projectId: string;
  canAppointLeaders: boolean;
  showAddButton: boolean;
  addModalOpen?: boolean;
  onOpenAdd?: () => void;
  onCloseAdd?: () => void;
}) {
  const t = useTranslations("projectMembers");
  const common = useTranslations("common");
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const confirmation = useModal();
  const [search, setSearch] = useState("");
  const [focusedId, setFocusedId] = useState<string>();
  const [selected, setSelected] = useState<ProjectMembership>();
  const [addFormVersion, setAddFormVersion] = useState(0);
  const [localAddModalOpen, setLocalAddModalOpen] = useState(false);
  const [appointLeaderOnAdd, setAppointLeaderOnAdd] = useState(false);
  const addModalOpen = Boolean(controlledAddModalOpen || localAddModalOpen);
  const mutationInFlight = useRef(false);
  const addDialog = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<
    "added" | "removed" | "leaderAppointed" | "leaderRevoked"
  >();
  const [leaderBusyUserId, setLeaderBusyUserId] = useState<string>();
  const [soleLeaderBlocked, setSoleLeaderBlocked] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!addModalOpen) return;
    const previouslyFocused = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      addDialog.current
        ?.querySelector<HTMLInputElement>("#project-member-email-search")
        ?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }
    };
  }, [addModalOpen]);

  const members = useProjectMembersQuery(organizationId, projectId, {
    page,
    pageSize: 20,
    status,
  });
  const leaders = useProjectLeadersQuery(organizationId, projectId);
  const leaderActions = useProjectLeaderActions(organizationId, projectId);
  const add = useAddProjectMember(organizationId, projectId);
  const remove = useRemoveProjectMember(organizationId, projectId);
  const membersAccessLost = isAccessOrResourceUnavailableError(members.error);
  const leadersAccessLost = isAccessOrResourceUnavailableError(leaders.error);

  const leaderRoleStatus: LeaderRoleStatus =
    leaders.isPending && !leaders.data
      ? "loading"
      : leaders.isError
        ? "unavailable"
        : "ready";
  const leaderRolesKnown = leaderRoleStatus === "ready";
  const canManageLeaders = leaderRolesKnown && canAppointLeaders;
  const leaderUserIds = useMemo(
    () =>
      new Set(
        leaders.data && !leadersAccessLost
          ? leaders.data
              .filter((leader) => leader.status === "ACTIVE")
              .map((leader) => leader.userId)
          : [],
      ),
    [leaders.data, leadersAccessLost],
  );
  const inactiveLeaders = useMemo(
    () =>
      leaders.data && !leadersAccessLost
        ? leaders.data.filter((leader) => leader.status === "INACTIVE")
        : [],
    [leaders.data, leadersAccessLost],
  );
  const inactiveLeaderUserIds = useMemo(
    () => new Set(inactiveLeaders.map((leader) => leader.userId)),
    [inactiveLeaders],
  );

  const leaderPending =
    leaderActions.assign.isPending || leaderActions.revoke.isPending;
  const leaderError = leaderActions.assign.error ?? leaderActions.revoke.error;
  const busy = add.isPending || remove.isPending || leaderPending;

  function checkAccess() {
    if (busy) return;
    confirmation.closeModal();
    add.reset();
    remove.reset();
    leaderActions.assign.reset();
    leaderActions.revoke.reset();
    setSelected(undefined);
    setNotice(undefined);
    setSoleLeaderBlocked(false);
    void members.refetch();
    void leaders.refetch();
  }

  function handleRevokeByUserId(userId: string) {
    if (mutationInFlight.current || busy || !canManageLeaders) return;
    if (leaderUserIds.has(userId) && leaderUserIds.size <= 1) {
      setSoleLeaderBlocked(true);
      return;
    }
    if (!leaderUserIds.has(userId) && leaderUserIds.size === 0) {
      setSoleLeaderBlocked(true);
      return;
    }
    mutationInFlight.current = true;
    setNotice(undefined);
    setSoleLeaderBlocked(false);
    setLeaderBusyUserId(userId);
    leaderActions.assign.reset();
    leaderActions.revoke.reset();

    leaderActions.revoke.mutate(userId, {
      onSuccess: () => {
        setNotice("leaderRevoked");
      },
      onSettled: () => {
        mutationInFlight.current = false;
        setLeaderBusyUserId(undefined);
      },
    });
  }

  function handleToggleLeader(
    member: ProjectMembership,
    isCurrentlyLeader: boolean,
  ) {
    if (mutationInFlight.current || busy || !canManageLeaders) return;
    if (isCurrentlyLeader) {
      handleRevokeByUserId(member.userId);
      return;
    }
    mutationInFlight.current = true;
    setNotice(undefined);
    setSoleLeaderBlocked(false);
    setLeaderBusyUserId(member.userId);
    leaderActions.assign.reset();
    leaderActions.revoke.reset();

    leaderActions.assign.mutate(member.userId, {
      onSuccess: () => {
        setNotice("leaderAppointed");
      },
      onSettled: () => {
        mutationInFlight.current = false;
        setLeaderBusyUserId(undefined);
      },
    });
  }

  const memberPage = membersAccessLost ? undefined : members.data;
  const visibleMembers = memberPage?.data ?? [];
  const listedMembers = visibleMembers.filter((member) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const matchEmail = member.user?.email.toLowerCase().includes(term);
    const matchName = member.user?.fullName?.toLowerCase().includes(term);
    const matchUserId = member.userId.toLowerCase().includes(term);
    return Boolean(matchEmail || matchName || matchUserId);
  });
  const focusedMember = listedMembers.find((member) => member.id === focusedId);

  function requestRemoval(member: ProjectMembership) {
    if (!leaderRolesKnown) return;
    if (
      leaderUserIds.has(member.userId) ||
      inactiveLeaderUserIds.has(member.userId)
    ) {
      if (leaderUserIds.size <= 1) {
        setSoleLeaderBlocked(true);
      }
      return;
    }
    remove.reset();
    setNotice(undefined);
    setSoleLeaderBlocked(false);
    setSelected(member);
    confirmation.openModal();
  }
  function openAddModal(shouldAppointLeader = false) {
    setAppointLeaderOnAdd(shouldAppointLeader);
    setLocalAddModalOpen(true);
    onOpenAdd?.();
  }
  function closeAddModal() {
    if (busy) return;
    setAppointLeaderOnAdd(false);
    setLocalAddModalOpen(false);
    onCloseAdd?.();
  }

  return (
    <div className="@container min-w-0 space-y-6">
      {notice && <MemberNotification message={t(notice)} />}
      {(members.isError || add.isError || remove.isError) && (
        <Button
          variant="outline"
          disabled={busy || members.isFetching}
          onClick={checkAccess}
        >
          {t("checkAccess")}
        </Button>
      )}
      {leaderRoleStatus === "unavailable" &&
        memberPage && (
          <p
            role="status"
            className="rounded-xl border border-warning-200 bg-warning-50/70 px-4 py-3 text-xs font-medium text-warning-800 sm:text-sm dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-warning-300"
          >
            {t("leaderRoleUnverifiedNotice")}
          </p>
        )}

      {/* Leaderless Project Governance Recovery Banner (Manager only) */}
      {canManageLeaders &&
        leaderUserIds.size === 0 &&
        memberPage && (
          <section
            aria-label={t("leaderlessRecoveryTitle")}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-error-200 bg-error-50/80 p-4 sm:flex-row sm:items-center sm:p-5 dark:border-error-500/30 dark:bg-error-500/10"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-error-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-error-700 dark:border-error-500/40 dark:bg-gray-900 dark:text-error-300">
                  {t("zeroEffectiveLeaderBadge")}
                </span>
                <h3 className="text-sm font-semibold text-error-900 sm:text-base dark:text-error-200">
                  {t("leaderlessRecoveryTitle")}
                </h3>
              </div>
              <p className="text-xs leading-5 text-error-800 sm:text-sm dark:text-error-300/90">
                {t("leaderlessRecoveryDescription")}
              </p>
            </div>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => openAddModal(true)}
              startIcon={<PlusIcon aria-hidden="true" className="size-4" />}
              className="shrink-0"
            >
              {t("addAndAppointLeaderCta")}
            </Button>
          </section>
        )}

      {/* Inactive Leaders Governance Callout (Manager only) */}
      {canManageLeaders &&
        inactiveLeaders.length > 0 &&
        memberPage && (
          <section
            aria-label={t("inactiveLeadersNoticeTitle")}
            className="space-y-3 rounded-2xl border border-warning-200 bg-warning-50/70 p-4 sm:p-5 dark:border-warning-500/30 dark:bg-warning-500/10"
          >
            <div>
              <h3 className="text-sm font-semibold text-warning-900 dark:text-warning-200">
                {t("inactiveLeadersNoticeTitle")}
              </h3>
              <p className="mt-0.5 text-xs text-warning-800 dark:text-warning-300/90">
                {t("inactiveLeadersNoticeDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {inactiveLeaders.map((leader) => (
                <div
                  key={leader.userId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-warning-200 bg-white px-3.5 py-2.5 dark:border-warning-500/25 dark:bg-gray-900"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                        {leader.fullName || leader.email}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-800 dark:bg-warning-500/20 dark:text-warning-300">
                        <LockIcon aria-hidden="true" className="size-3" />
                        {t("inactiveLeaderBadge")}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {leader.email}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || leaderUserIds.size === 0}
                    onClick={() => handleRevokeByUserId(leader.userId)}
                  >
                    {t("revokeLeader")}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

      {(leaderError || soleLeaderBlocked) && (
        <p
          role="alert"
          className="rounded-xl border border-error-200 bg-error-50/60 px-4 py-3 text-sm text-error-700 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-300"
        >
          {soleLeaderBlocked ||
          (leaderError instanceof ApiError &&
            leaderError.code === "LAST_PROJECT_LEADER_REQUIRED")
            ? t("soleLeaderCannotRevoke")
            : t("leaderActionFailed")}
        </p>
      )}
      <section
        aria-label={t("list")}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <GroupIcon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                  {t("title")}
                </h2>
                {memberPage && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {format.number(memberPage.pagination.totalItems)}{" "}
                    {t("membersMetric")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                {t("directoryDescription")}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end xl:flex-1 xl:justify-end">
            <div className="min-w-0 flex-1 sm:max-w-xs sm:min-w-64 xl:w-80 xl:flex-none">
              <Label htmlFor="member-roster-search" className="sr-only">
                {t("searchPage")}
              </Label>
              <div className="relative">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-gray-400"
                />
                <Input
                  id="member-roster-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSelected(undefined);
                    confirmation.closeModal();
                  }}
                  placeholder={t("searchPlaceholder")}
                  className="ps-10"
                />
              </div>
            </div>
            <MemberStatusFilter
              value={status}
              disabled={busy}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
                setSelected(undefined);
                setFocusedId(undefined);
                confirmation.closeModal();
              }}
            />
            {showAddButton && (
              <Button
                ariaLabel={t("openAdd")}
                onClick={() => openAddModal(false)}
                className="shrink-0"
              >
                {t("add")}
              </Button>
            )}
          </div>
        </div>

        {members.isPending && !memberPage ? (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-3 p-4">
            <span className="sr-only">{t("loading")}</span>
            <TableSkeleton rows={5} columns={4} />
          </div>
        ) : members.isError && !memberPage ? (
          <div className="p-5">
            <MemberError error={members.error} action="list" />
          </div>
        ) : memberPage ? (
          <>
            {members.isFetching && <UpdatingStatus>{common("updating")}</UpdatingStatus>}
            {members.isRefetchError && (
              <BackgroundRefreshError
                retryLabel={common("retry")}
                onRetry={() => void members.refetch()}
              >
                {common("updateFailed")}
              </BackgroundRefreshError>
            )}
            <MemberDirectory
              members={listedMembers}
              selectedId={focusedMember?.id}
              disabled={busy}
              removeDisabled={
                busy || isMemberActionDenied(remove.error) || !leaderRolesKnown
              }
              leaderUserIds={leaderUserIds}
              inactiveLeaderUserIds={inactiveLeaderUserIds}
              leaderRoleStatus={leaderRoleStatus}
              canManageLeaders={canManageLeaders}
              leaderBusyUserId={leaderBusyUserId}
              onSelect={setFocusedId}
              onRemove={requestRemoval}
              onToggleLeader={handleToggleLeader}
            />
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {t("pageOf", {
                  page: memberPage.pagination.page,
                  total: Math.max(1, memberPage.pagination.totalPages),
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || page <= 1}
                  onClick={() => {
                    setPage(page - 1);
                    setFocusedId(undefined);
                    setSelected(undefined);
                  }}
                >
                  {t("previous")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || page >= memberPage.pagination.totalPages}
                  onClick={() => {
                    setPage(page + 1);
                    setFocusedId(undefined);
                    setSelected(undefined);
                  }}
                >
                  {t("next")}
                </Button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
      <div className="[&_.modal>div:first-child]:bg-gray-900/35 [&_.modal>div:first-child]:backdrop-blur-none">
        <Modal
          isOpen={addModalOpen}
          onClose={closeAddModal}
          showCloseButton={false}
          className="mx-4 max-w-2xl"
        >
          <div
            ref={addDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-add-heading"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                addDialog.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)',
                ) ?? [],
              );
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (!first) {
                event.preventDefault();
                return;
              }
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl sm:p-7 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <GroupIcon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2
                      id="member-add-heading"
                      tabIndex={-1}
                      className="text-lg font-semibold text-gray-900 outline-none dark:text-white/90"
                    >
                      {t("add")}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t("addDescription")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeAddModal}
                  className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t("closeAdd")}
                </button>
              </div>
              {canManageLeaders && (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-brand-200/80 bg-brand-50/50 px-3.5 py-2.5 text-xs font-medium text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300">
                  <input
                    type="checkbox"
                    checked={appointLeaderOnAdd}
                    disabled={busy}
                    onChange={(event) =>
                      setAppointLeaderOnAdd(event.target.checked)
                    }
                    className="size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{t("appointAsLeaderAfterAddLabel")}</span>
                </label>
              )}
              <MemberAddForm
                key={addFormVersion}
                organizationId={organizationId}
                projectId={projectId}
                pending={add.isPending || leaderActions.assign.isPending}
                disabled={busy || isMemberActionDenied(add.error)}
                defaultRole={appointLeaderOnAdd ? "TEAM_LEADER" : "MEMBER"}
                onRoleChange={(role) =>
                  setAppointLeaderOnAdd(role === "TEAM_LEADER")
                }
                onAdd={(userId, role) => {
                  if (
                    mutationInFlight.current ||
                    busy ||
                    isMemberActionDenied(add.error)
                  )
                    return;
                  mutationInFlight.current = true;
                  setNotice(undefined);
                  const effectiveRole =
                    role ?? (appointLeaderOnAdd ? "TEAM_LEADER" : "MEMBER");
                  const shouldAppoint = effectiveRole === "TEAM_LEADER";
                  add.mutate(
                    shouldAppoint ? { userId, role: "TEAM_LEADER" } : userId,
                    {
                      onSuccess: () => {
                        setPage(1);
                        setAddFormVersion((version) => version + 1);
                        if (shouldAppoint && canManageLeaders) {
                          leaderActions.assign.mutate(userId, {
                            onSuccess: () => {
                              setNotice("leaderAppointed");
                              setAppointLeaderOnAdd(false);
                            },
                            onError: () => {
                              setNotice("leaderAppointed");
                              setAppointLeaderOnAdd(false);
                            },
                            onSettled: () => {
                              mutationInFlight.current = false;
                            },
                          });
                        } else if (shouldAppoint) {
                          setNotice("leaderAppointed");
                          setAppointLeaderOnAdd(false);
                          void leaders.refetch();
                        } else {
                          setNotice("added");
                        }
                      },
                      onError: () => {
                        mutationInFlight.current = false;
                      },
                      onSettled: () => {
                        if (!(shouldAppoint && canManageLeaders)) {
                          mutationInFlight.current = false;
                        }
                      },
                    },
                  );
                }}
              />
              {add.isError && <MemberError error={add.error} action="add" />}
            </section>
          </div>
        </Modal>
      </div>
      {focusedMember && (
        <div className="grid gap-4 @2xl:grid-cols-2">
          <MemberDetails
            member={focusedMember}
            isLeader={leaderUserIds.has(focusedMember.userId)}
            leaderRoleStatus={leaderRoleStatus}
          />
          <MemberLifecycle member={focusedMember} />
        </div>
      )}
      {((selected && memberPage) ||
        remove.isError) && (
        <MemberRemoveConfirmation
          isOpen={confirmation.isOpen}
          member={members.isError || members.isFetching ? undefined : selected}
          error={remove.error}
          pending={busy}
          disabled={
            busy ||
            members.isError ||
            members.isFetching ||
            isMemberActionDenied(remove.error)
          }
          onCancel={() => {
            confirmation.closeModal();
            setSelected(undefined);
          }}
          onConfirm={() => {
            if (
              !selected ||
              mutationInFlight.current ||
              busy ||
              members.isError ||
              members.isFetching ||
              isMemberActionDenied(remove.error)
            )
              return;
            mutationInFlight.current = true;
            setNotice(undefined);
            remove.mutate(selected.id, {
              onSuccess: () => {
                setSelected(undefined);
                setNotice("removed");
                confirmation.closeModal();
              },
              onSettled: () => {
                mutationInFlight.current = false;
              },
            });
          }}
        />
      )}
    </div>
  );
}

export default function ProjectMembers({
  projectId,
  showAddButton = true,
  addModalOpen,
  onOpenAdd,
  onCloseAdd,
}: {
  projectId: string;
  showAddButton?: boolean;
  addModalOpen?: boolean;
  onOpenAdd?: () => void;
  onCloseAdd?: () => void;
}) {
  const user = useCurrentUserQuery();
  const common = useTranslations("common");
  const invalidIdentity =
    user.error instanceof ApiError && [401, 403, 404].includes(user.error.status);
  if (user.isPending && !user.data) return <ProjectState />;
  if (user.isError && (!user.data || invalidIdentity))
    return <ProjectState error={user.error} retry={() => void user.refetch()} />;
  if (!user.data?.organizationId)
    return <ProjectState error={new Error("No trusted organization")} />;
  if (!isResourceId(projectId))
    return (
      <MemberError
        error={
          new ApiError(422, "VALIDATION_FAILED", "Invalid Project context")
        }
        action="list"
      />
    );
  return (
    <div className="space-y-3">
      {user.isFetching && <UpdatingStatus>{common("updating")}</UpdatingStatus>}
      {user.isRefetchError && !invalidIdentity && (
        <BackgroundRefreshError
          retryLabel={common("retry")}
          onRetry={() => void user.refetch()}
        >
          {common("updateFailed")}
        </BackgroundRefreshError>
      )}
      <ScopedProjectMembers
        key={`${user.data.id}:${user.data.organizationId}:${projectId}`}
        organizationId={user.data.organizationId}
        projectId={projectId}
        canAppointLeaders={Boolean(user.data.roles?.includes("ADMIN"))}
        showAddButton={showAddButton}
        addModalOpen={addModalOpen}
        onOpenAdd={onOpenAdd}
        onCloseAdd={onCloseAdd}
      />
    </div>
  );
}
