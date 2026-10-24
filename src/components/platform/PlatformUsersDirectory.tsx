"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRoleDisplayLabel } from "@/components/common/RoleLabel";
import Button from "@/components/ui/button/Button";
import dialogStyles from "./ui/platformDialog.module.css";
import { Modal } from "@/components/ui/modal";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import UserDirectory from "./users/UserDirectory";
import type { PlatformUserAction } from "@/components/platform/PlatformUserActionsMenu";
import { UserCircleIcon } from "@/icons";
import {
  ErrorState,
  Loading,
  QueryRefreshStatus,
  TextField,
  box,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";
import type { PlatformUserRecord } from "@/lib/queries/platform/usePlatformOperations";

export default function PlatformUsersDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformUserActions");
  const roleLabel = useRoleDisplayLabel();
  const directoryT = useTranslations("platformUserDirectory");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [userActionAttempted, setUserActionAttempted] = useState(false);
  const [actionTarget, setActionTarget] = useState<PlatformUserRecord | null>(
    null,
  );
  const [actionFeedback, setActionFeedback] = useState("");
  const actionReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const editFullNameRef = useRef<HTMLInputElement>(null);
  const userSearchRef = useRef<HTMLInputElement>(null);
  const {
    canReadUsers,
    setSelectedId,
    setOrganizationPage,
    setSessionPage,
    setSelectedSessionId,
    selectedSessionId,
    selectedId,
    userDetailDialogRef,
    closeUserDetails,
    userDetailCloseButtonRef,
    selectedUser,
    userOrganizations,
    operatorId,
    handleSubmit,
    changeUserStatus,
    updateUserProfile,
    archiveUser,
    restoreUser,
    canReadSessions,
    userSessions,
    canManageSessions,
    revokeSession,
    runOperation,
    selectedSession,
    formMessage,
    setFormMessage,
  } = model;
  const currentUser = selectedUser.data;
  const isArchived = Boolean(currentUser?.archivedAt);
  const displayedStatus = isArchived ? "ARCHIVED" : currentUser?.status;
  const actionUser = actionTarget ?? currentUser;
  const actionUserStatus = actionUser?.archivedAt
    ? "ARCHIVED"
    : actionUser?.status;

  useEffect(() => {
    if (editModalOpen) editFullNameRef.current?.focus();
  }, [editModalOpen]);

  useEffect(() => {
    if (statusModalOpen) {
      document
        .querySelector<HTMLElement>(
          '[aria-labelledby="platform-user-status-title"] button',
        )
        ?.focus();
    }
  }, [statusModalOpen]);

  useEffect(() => {
    if (archiveModalOpen) {
      document
        .querySelector<HTMLElement>(
          '[aria-labelledby="platform-user-archive-title"] button',
        )
        ?.focus();
    }
  }, [archiveModalOpen]);

  useEffect(() => {
    if (restoreModalOpen) {
      document
        .querySelector<HTMLElement>(
          '[aria-labelledby="platform-user-restore-title"] button',
        )
        ?.focus();
    }
  }, [restoreModalOpen]);

  function restoreActionMenuFocus() {
    const trigger = actionReturnFocusRef.current;
    actionReturnFocusRef.current = null;
    if (trigger?.isConnected) trigger.focus();
    else userSearchRef.current?.focus();
  }

  function openProfileEditor(
    user: PlatformUserRecord | undefined = currentUser,
  ) {
    if (!user || user.archivedAt) return;
    setActionFeedback("");
    setActionTarget(user);
    setEditFullName(user.fullName ?? "");
    setEditAvatarUrl(user.avatarUrl ?? "");
    setUserActionAttempted(false);
    setFormMessage("");
    setEditModalOpen(true);
  }

  function openStatusConfirmation(
    user: PlatformUserRecord | undefined = currentUser,
  ) {
    if (
      !user ||
      user.archivedAt ||
      !["ACTIVE", "SUSPENDED"].includes(user.status)
    )
      return;
    setActionFeedback("");
    setActionTarget(user);
    setUserActionAttempted(false);
    setFormMessage("");
    setStatusModalOpen(true);
  }

  function openArchiveConfirmation(
    user: PlatformUserRecord | undefined = currentUser,
  ) {
    if (
      !user ||
      user.archivedAt ||
      !["ACTIVE", "SUSPENDED"].includes(user.status)
    )
      return;
    setActionFeedback("");
    setActionTarget(user);
    setArchiveAcknowledged(false);
    setUserActionAttempted(false);
    setFormMessage("");
    setArchiveModalOpen(true);
  }

  function openRestoreConfirmation(
    user: PlatformUserRecord | undefined = currentUser,
  ) {
    if (!user || !user.archivedAt || user.status !== "SUSPENDED") return;
    setActionFeedback("");
    setActionTarget(user);
    setUserActionAttempted(false);
    setFormMessage("");
    setRestoreModalOpen(true);
  }

  function closeEditProfile() {
    if (updateUserProfile.isPending) return;
    setEditModalOpen(false);
    setActionTarget(null);
    setUserActionAttempted(false);
    setFormMessage("");
    restoreActionMenuFocus();
  }

  function closeStatusConfirmation() {
    if (changeUserStatus.isPending) return;
    setStatusModalOpen(false);
    setActionTarget(null);
    setUserActionAttempted(false);
    setFormMessage("");
    restoreActionMenuFocus();
  }

  function closeArchiveConfirmation() {
    if (archiveUser.isPending) return;
    setArchiveModalOpen(false);
    setArchiveAcknowledged(false);
    setActionTarget(null);
    setUserActionAttempted(false);
    setFormMessage("");
    restoreActionMenuFocus();
  }

  function closeRestoreConfirmation() {
    if (restoreUser.isPending) return;
    setRestoreModalOpen(false);
    setActionTarget(null);
    setUserActionAttempted(false);
    setFormMessage("");
    restoreActionMenuFocus();
  }

  function handleUserAction(
    action: PlatformUserAction,
    user: PlatformUserRecord,
    trigger: HTMLButtonElement,
  ) {
    if (action === "view-details") {
      setSelectedId(user.id);
      setOrganizationPage(1);
      setSessionPage(1);
      setSelectedSessionId("");
      return;
    }

    actionReturnFocusRef.current = trigger;
    if (action === "edit-profile") openProfileEditor(user);
    else if (action === "suspend" || action === "reactivate")
      openStatusConfirmation(user);
    else if (action === "archive") openArchiveConfirmation(user);
    else if (action === "restore") openRestoreConfirmation(user);
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    if (!actionUser) return;
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      updateUserProfile.mutateAsync({
        userId: actionUser.id,
        fullName: (editFullName ?? "").trim(),
        avatarUrl: editAvatarUrl.trim() || null,
        expectedUpdatedAt: actionUser.updatedAt,
      }),
    );
    if (success) {
      setEditModalOpen(false);
      setActionFeedback(`Profile updated for ${actionUser.fullName}.`);
      setActionTarget(null);
      setUserActionAttempted(false);
      restoreActionMenuFocus();
    }
  }

  async function submitStatusChange(event: FormEvent<HTMLFormElement>) {
    if (!actionUser || !actionUserStatus) return;
    const status = actionUserStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      changeUserStatus.mutateAsync({
        userId: actionUser.id,
        status,
        expectedUpdatedAt: actionUser.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    if (success) {
      setStatusModalOpen(false);
      setActionFeedback(`Account status updated to ${status}.`);
      setActionTarget(null);
      setUserActionAttempted(false);
      restoreActionMenuFocus();
    }
  }

  async function submitArchive(event: FormEvent<HTMLFormElement>) {
    if (!actionUser) return;
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      archiveUser.mutateAsync({
        userId: actionUser.id,
        expectedUpdatedAt: actionUser.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    if (success) {
      setArchiveModalOpen(false);
      setArchiveAcknowledged(false);
      setActionFeedback(
        "Account archived. User record and audit history were retained.",
      );
      setActionTarget(null);
      setUserActionAttempted(false);
      restoreActionMenuFocus();
    }
  }

  async function submitRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !actionUser ||
      !actionUser.archivedAt ||
      actionUser.status !== "SUSPENDED"
    )
      return;
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      restoreUser.mutateAsync({
        userId: actionUser.id,
        expectedUpdatedAt: actionUser.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    if (success) {
      setRestoreModalOpen(false);
      setActionFeedback(t("restoreSuccess"));
      setActionTarget(null);
      setUserActionAttempted(false);
      restoreActionMenuFocus();
    }
  }
  return (
    <div className="space-y-6">
      {!canReadUsers ? (
        <section className={`${box} p-6`}>
          <h1 className="text-xl font-semibold text-gray-950 dark:text-white">
            {directoryT("title")}
          </h1>
          <p
            role="status"
            className="mt-3 text-sm text-gray-600 dark:text-gray-300"
          >
            {directoryT("denied")}
          </p>
        </section>
      ) : (
        <>
          <UserDirectory
            model={model}
            searchRef={userSearchRef}
            onAction={handleUserAction}
            actionsPending={
              updateUserProfile.isPending ||
              changeUserStatus.isPending ||
              archiveUser.isPending ||
              restoreUser.isPending
            }
          />
          {actionFeedback && (
            <p
              role="status"
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
            >
              {actionFeedback}
            </p>
          )}
          {selectedId && (
            <dialog
              ref={userDetailDialogRef}
              aria-labelledby="platform-user-detail-title"
              onCancel={closeUserDetails}
              onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (
                  event.clientX < bounds.left ||
                  event.clientX > bounds.right ||
                  event.clientY < bounds.top ||
                  event.clientY > bounds.bottom
                ) {
                  closeUserDetails();
                }
              }}
              className={`${dialogStyles.surface} ${dialogStyles.native} ${dialogStyles.detailSurface}`}
            >
              <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
                <div className="min-w-0">
                  <p className={dialogStyles.detailBreadcrumb}>
                    Users / {selectedId}
                  </p>
                  <h2
                    id="platform-user-detail-title"
                    className={dialogStyles.recordTitle}
                  >
                    {selectedUser.data?.fullName ?? "User detail"}
                  </h2>
                  {selectedUser.data?.email && (
                    <p className={dialogStyles.recordSubtitle}>
                      {selectedUser.data.email}
                    </p>
                  )}
                </div>
                <button
                  ref={userDetailCloseButtonRef}
                  type="button"
                  onClick={closeUserDetails}
                  className="shrink-0 cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Close
                </button>
              </header>
              <div
                className={dialogStyles.userDetailGrid}
                aria-busy={selectedUser.isFetching}
              >
                {selectedUser.data !== undefined &&
                  !isReadAccessLost(selectedUser.error) &&
                  (selectedUser.isFetching || selectedUser.isRefetchError) && (
                    <div className="col-span-full">
                      <QueryRefreshStatus
                        hasData
                        isFetching={selectedUser.isFetching}
                        isRefetchError={selectedUser.isRefetchError}
                        onRetry={() => void selectedUser.refetch()}
                      />
                    </div>
                  )}
                {selectedUser.isPending && !selectedUser.data ? (
                  <Loading columns={3} />
                ) : selectedUser.isError &&
                  (!selectedUser.data || isReadAccessLost(selectedUser.error)) ? (
                  <ErrorState retry={() => void selectedUser.refetch()} />
                ) : (
                  <>
                    <aside className={dialogStyles.detailAside}>
                      <h3>Details</h3>
                      <dl className={dialogStyles.detailList}>
                        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                          <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                            Status
                          </dt>
                          <dd className="mt-2">
                            <StatusBadge
                              status={
                                displayedStatus ?? selectedUser.data.status
                              }
                              label={
                                displayedStatus ?? selectedUser.data.status
                              }
                            />
                          </dd>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                          <TextField
                            label="Created"
                            value={new Date(
                              selectedUser.data.createdAt,
                            ).toLocaleString()}
                          />
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                          <TextField
                            label="Updated"
                            value={new Date(
                              selectedUser.data.updatedAt,
                            ).toLocaleString()}
                          />
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                          <TextField
                            label="Last login"
                            value={
                              selectedUser.data.lastLoginAt
                                ? new Date(
                                    selectedUser.data.lastLoginAt,
                                  ).toLocaleString()
                                : "—"
                            }
                          />
                        </div>
                        {selectedUser.data.archivedAt && (
                          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                            <TextField
                              label="Archived"
                              value={new Date(
                                selectedUser.data.archivedAt,
                              ).toLocaleString()}
                            />
                          </div>
                        )}
                      </dl>
                    </aside>
                    <section
                      aria-labelledby="platform-user-organizations-title"
                      className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3
                          id="platform-user-organizations-title"
                          className="text-sm font-semibold text-gray-900 dark:text-white"
                        >
                          Organizations
                        </h3>
                        {userOrganizations.data?.pagination && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {userOrganizations.data.pagination.totalItems}
                          </span>
                        )}
                      </div>
                      {userOrganizations.data !== undefined &&
                        !isReadAccessLost(userOrganizations.error) &&
                        (userOrganizations.isFetching ||
                          userOrganizations.isRefetchError) && (
                          <div className="mb-3">
                            <QueryRefreshStatus
                              hasData
                              isFetching={userOrganizations.isFetching}
                              isRefetchError={userOrganizations.isRefetchError}
                              onRetry={() => void userOrganizations.refetch()}
                            />
                          </div>
                        )}
                      {userOrganizations.isPending &&
                      !userOrganizations.data ? (
                        <Loading columns={2} />
                      ) : userOrganizations.isError &&
                        (!userOrganizations.data ||
                          isReadAccessLost(userOrganizations.error)) ? (
                        <ErrorState
                          retry={() => void userOrganizations.refetch()}
                        />
                      ) : userOrganizations.data?.data.length ? (
                        <>
                          <ul className="space-y-2">
                            {userOrganizations.data.data.map((membership) => (
                              <li
                                key={membership.organizationId}
                                className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-800/50"
                              >
                                <strong>{membership.organizationName}</strong>
                                <span className="ms-2 text-gray-500">
                                  {membership.status} ·{" "}
                                  {membership.organizationRoles
                                    .map(roleLabel)
                                    .join(", ") || "No role"}
                                </span>
                                <span className="font-mono mt-1 block text-[10px] text-gray-500">
                                  {membership.organizationSlug}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {userOrganizations.data.pagination && (
                            <PlatformPagination
                              ariaLabel="User organizations"
                              page={userOrganizations.data.pagination.page}
                              totalPages={
                                userOrganizations.data.pagination.totalPages
                              }
                              totalItems={
                                userOrganizations.data.pagination.totalItems
                              }
                              onPageChange={setOrganizationPage}
                            />
                          )}
                        </>
                      ) : (
                        <EmptyState
                          title="No organization memberships"
                          body="The Platform API returned no organization memberships for this user."
                        />
                      )}
                    </section>
                    {!canReadSessions && (
                      <p
                        role="status"
                        className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300"
                      >
                        {t("sessionsDenied")}
                      </p>
                    )}
                    {canReadSessions && (
                      <section
                        aria-labelledby="platform-user-sessions-title"
                        className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3
                            id="platform-user-sessions-title"
                            className="text-sm font-semibold text-gray-900 dark:text-white"
                          >
                            Sessions
                          </h3>
                          {userSessions.data?.pagination && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              {userSessions.data.pagination.totalItems}
                            </span>
                          )}
                        </div>
                        {userSessions.data !== undefined &&
                          !isReadAccessLost(userSessions.error) &&
                          (userSessions.isFetching ||
                            userSessions.isRefetchError) && (
                            <div className="mb-3">
                              <QueryRefreshStatus
                                hasData
                                isFetching={userSessions.isFetching}
                                isRefetchError={userSessions.isRefetchError}
                                onRetry={() => void userSessions.refetch()}
                              />
                            </div>
                          )}
                        {userSessions.isPending && !userSessions.data ? (
                          <Loading columns={4} />
                        ) : userSessions.isError &&
                          (!userSessions.data ||
                            isReadAccessLost(userSessions.error)) ? (
                          <ErrorState
                            retry={() => void userSessions.refetch()}
                          />
                        ) : userSessions.data?.data.length ? (
                          <ul className="space-y-2">
                            {userSessions.data.data.map((session) => (
                              <li
                                key={session.id}
                                className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-800/50"
                              >
                                <div className="min-w-0">
                                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                    <span
                                      className="font-mono max-w-full truncate text-gray-800 dark:text-gray-200"
                                      title={session.id}
                                    >
                                      {session.id}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {session.context} · {session.status}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                                    expires{" "}
                                    {new Date(
                                      session.expiresAt,
                                    ).toLocaleString()}
                                  </p>
                                </div>
                                {canManageSessions &&
                                  session.status === "ACTIVE" &&
                                  selectedUser.data.id !== operatorId && (
                                    <div className="flex shrink-0 gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setSelectedSessionId(session.id)
                                        }
                                      >
                                        Details
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={revokeSession.isPending}
                                        onClick={() => {
                                          if (
                                            !window.confirm(
                                              "Revoke this session?",
                                            )
                                          )
                                            return;
                                          void runOperation(() =>
                                            revokeSession.mutateAsync({
                                              userId: selectedUser.data!.id,
                                              sessionId: session.id,
                                              expectedUpdatedAt:
                                                session.updatedAt,
                                              reasonCode: "ACCESS_REVIEW",
                                            }),
                                          );
                                        }}
                                      >
                                        Revoke
                                      </Button>
                                    </div>
                                  )}
                                {(!canManageSessions ||
                                  session.status !== "ACTIVE" ||
                                  selectedUser.data.id === operatorId) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setSelectedSessionId(session.id)
                                    }
                                  >
                                    Details
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyState
                            title="No sessions"
                            body="The API returned no sessions for this user."
                          />
                        )}
                        {userSessions.data?.pagination && (
                          <PlatformPagination
                            ariaLabel="User sessions"
                            page={userSessions.data.pagination.page}
                            totalPages={userSessions.data.pagination.totalPages}
                            totalItems={userSessions.data.pagination.totalItems}
                            onPageChange={setSessionPage}
                          />
                        )}
                        {selectedSessionId && (
                          <div className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="text-xs font-bold">
                                Session detail
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSessionId("")}
                              >
                                Close
                              </Button>
                            </div>
                            {selectedSession.data !== undefined &&
                              !isReadAccessLost(selectedSession.error) &&
                              (selectedSession.isFetching ||
                                selectedSession.isRefetchError) && (
                                <div className="mb-3">
                                  <QueryRefreshStatus
                                    hasData
                                    isFetching={selectedSession.isFetching}
                                    isRefetchError={selectedSession.isRefetchError}
                                    onRetry={() =>
                                      void selectedSession.refetch()
                                    }
                                  />
                                </div>
                              )}
                            {selectedSession.isPending &&
                            !selectedSession.data ? (
                              <Loading columns={3} />
                            ) : !selectedSession.data ||
                              (selectedSession.isError &&
                                isReadAccessLost(selectedSession.error)) ? (
                              <ErrorState
                                retry={() => void selectedSession.refetch()}
                              />
                            ) : (
                              <dl className="grid gap-3 sm:grid-cols-2">
                                <TextField
                                  label="Session ID"
                                  value={selectedSession.data.id}
                                />
                                <TextField
                                  label="Status / context"
                                  value={`${selectedSession.data.status} · ${selectedSession.data.context}`}
                                />
                                <TextField
                                  label="Created / updated"
                                  value={`${new Date(selectedSession.data.createdAt).toLocaleString()} · ${new Date(selectedSession.data.updatedAt).toLocaleString()}`}
                                />
                                <TextField
                                  label="Expires"
                                  value={new Date(
                                    selectedSession.data.expiresAt,
                                  ).toLocaleString()}
                                />
                              </dl>
                            )}
                          </div>
                        )}
                      </section>
                    )}
                    {formMessage && !userActionAttempted && (
                      <p
                        className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        role="status"
                      >
                        {formMessage}
                      </p>
                    )}
                  </>
                )}
              </div>
            </dialog>
          )}
          {actionUser && (
            <>
              <Modal
                isOpen={editModalOpen}
                onClose={closeEditProfile}
                backdropClassName="bg-gray-950/45"
                showCloseButton={false}
                className={`${dialogStyles.surface} ${dialogStyles.userSurface}`}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-edit-user-title"
                  className="overflow-hidden rounded-3xl"
                >
                  <header className="flex items-start gap-4 border-b border-gray-100 bg-gray-50/80 px-5 py-5 pe-12 sm:px-7 sm:py-6 dark:border-gray-800 dark:bg-gray-800/40">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                      <UserCircleIcon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="space-y-1">
                      <h2
                        id="platform-edit-user-title"
                        className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white"
                      >
                        Edit user profile
                      </h2>
                      <p className="max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                        Change the user’s display name or avatar. Account access
                        and organization roles are not changed.
                      </p>
                    </div>
                  </header>
                  <form
                    className="space-y-5 p-5 sm:p-7"
                    onSubmit={submitProfile}
                  >
                    <label
                      className="block space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                      htmlFor="platform-user-full-name"
                    >
                      Full name
                      <input
                        ref={editFullNameRef}
                        id="platform-user-full-name"
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 shadow-theme-xs transition-colors outline-none placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500 dark:hover:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-500/10"
                        autoComplete="name"
                        autoFocus
                        required
                        minLength={1}
                        maxLength={200}
                        value={editFullName}
                        onChange={(event) =>
                          setEditFullName(event.target.value)
                        }
                      />
                    </label>
                    <label
                      className="block space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                      htmlFor="platform-user-avatar-url"
                    >
                      Avatar URL{" "}
                      <span className="font-normal text-gray-500 dark:text-gray-400">
                        (optional)
                      </span>
                      <input
                        id="platform-user-avatar-url"
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 shadow-theme-xs transition-colors outline-none placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500 dark:hover:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-500/10"
                        type="url"
                        maxLength={2000}
                        placeholder="https://…"
                        value={editAvatarUrl}
                        onChange={(event) =>
                          setEditAvatarUrl(event.target.value)
                        }
                      />
                    </label>
                    {userActionAttempted && formMessage && (
                      <p
                        role="alert"
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {formMessage}
                      </p>
                    )}
                    <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end dark:border-gray-800">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeEditProfile}
                        disabled={updateUserProfile.isPending}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          updateUserProfile.isPending ||
                          !(editFullName ?? "").trim()
                        }
                        className="w-full sm:w-auto"
                      >
                        {updateUserProfile.isPending
                          ? "Saving…"
                          : "Save changes"}
                      </Button>
                    </div>
                  </form>
                </section>
              </Modal>

              <Modal
                isOpen={statusModalOpen}
                backdropClassName="bg-gray-950/45"
                onClose={closeStatusConfirmation}
                showCloseButton={false}
                className="mx-3 max-w-lg border border-gray-200 p-6 shadow-theme-lg dark:border-gray-800"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-user-status-title"
                  className="space-y-5"
                >
                  <header className="space-y-1 pe-10">
                    <h2
                      id="platform-user-status-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {actionUserStatus === "ACTIVE"
                        ? "Suspend account?"
                        : "Reactivate account?"}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {actionUser.fullName} · {actionUser.email}
                    </p>
                  </header>
                  <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                    {actionUserStatus === "ACTIVE"
                      ? "Suspending blocks account access and revokes the user’s active sessions. Organization memberships are retained."
                      : "Reactivating restores account access. Existing organization memberships and roles remain unchanged."}
                  </p>
                  {userActionAttempted && formMessage && (
                    <p
                      role="alert"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      {formMessage}
                    </p>
                  )}
                  <form
                    className="flex flex-wrap justify-end gap-2"
                    onSubmit={submitStatusChange}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      autoFocus
                      onClick={closeStatusConfirmation}
                      disabled={changeUserStatus.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={changeUserStatus.isPending}>
                      {changeUserStatus.isPending
                        ? "Updating…"
                        : actionUserStatus === "ACTIVE"
                          ? "Suspend account"
                          : "Reactivate account"}
                    </Button>
                  </form>
                </section>
              </Modal>

              <Modal
                isOpen={archiveModalOpen}
                backdropClassName="bg-gray-950/45"
                onClose={closeArchiveConfirmation}
                showCloseButton={false}
                className="mx-3 max-w-lg border border-gray-200 p-6 shadow-theme-lg dark:border-gray-800"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-user-archive-title"
                  className="space-y-5"
                >
                  <header className="space-y-1 pe-10">
                    <h2
                      id="platform-user-archive-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      Archive user?
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {actionUser.fullName} · {actionUser.email}
                    </p>
                  </header>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    This keeps the account, organization memberships, and audit
                    history. The account will be suspended, marked archived, and
                    all active sessions revoked. You can restore it to SUSPENDED
                    from the Archived filter; use Reactivate separately to
                    restore sign-in access.
                  </div>
                  <form className="space-y-4" onSubmit={submitArchive}>
                    <label className="flex items-start gap-2 text-sm leading-5 text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        checked={archiveAcknowledged}
                        onChange={(event) =>
                          setArchiveAcknowledged(event.target.checked)
                        }
                      />
                      <span>
                        I understand the account will be suspended and archived,
                        while its records and memberships are retained.
                      </span>
                    </label>
                    {userActionAttempted && formMessage && (
                      <p
                        role="alert"
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {formMessage}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        autoFocus
                        onClick={closeArchiveConfirmation}
                        disabled={archiveUser.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={!archiveAcknowledged || archiveUser.isPending}
                      >
                        {archiveUser.isPending ? "Archiving…" : "Archive user"}
                      </Button>
                    </div>
                  </form>
                </section>
              </Modal>

              <Modal
                isOpen={restoreModalOpen}
                backdropClassName="bg-gray-950/45"
                onClose={closeRestoreConfirmation}
                showCloseButton={false}
                className="mx-3 max-w-lg border border-gray-200 p-6 shadow-theme-lg dark:border-gray-800"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-user-restore-title"
                  className="space-y-5"
                >
                  <header className="space-y-1 pe-10">
                    <h2
                      id="platform-user-restore-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {t("restoreTitle")}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {actionUser.fullName} · {actionUser.email}
                    </p>
                  </header>
                  <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                    {t("restoreDescription")}
                  </p>
                  {userActionAttempted && formMessage && (
                    <p
                      role="alert"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      {formMessage}
                    </p>
                  )}
                  <form
                    className="flex flex-wrap justify-end gap-2"
                    onSubmit={submitRestore}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      autoFocus
                      onClick={closeRestoreConfirmation}
                      disabled={restoreUser.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={restoreUser.isPending}>
                      {restoreUser.isPending ? t("restoring") : t("restore")}
                    </Button>
                  </form>
                </section>
              </Modal>
            </>
          )}
        </>
      )}
    </div>
  );
}
