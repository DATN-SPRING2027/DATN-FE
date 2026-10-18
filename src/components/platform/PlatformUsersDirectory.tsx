"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  TextField,
  box,
  cell,
  input,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformUsersDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [archiveAcknowledged, setArchiveAcknowledged] = useState(false);
  const [userActionAttempted, setUserActionAttempted] = useState(false);
  const {
    canReadUsers,
    users,
    search,
    setSearch,
    setPage,
    status,
    setStatus,
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
    canManageUsers,
    operatorId,
    handleSubmit,
    changeUserStatus,
    updateUserProfile,
    archiveUser,
    canReadSessions,
    userSessions,
    canManageSessions,
    revokeSession,
    runOperation,
    selectedSession,
    formMessage,
  } = model;
  const currentUser = selectedUser.data;
  const isArchived = Boolean(currentUser?.archivedAt);
  const displayedStatus = isArchived ? "ARCHIVED" : currentUser?.status;

  function openProfileEditor() {
    if (!currentUser) return;
    setEditFullName(currentUser.fullName);
    setEditAvatarUrl(currentUser.avatarUrl ?? "");
    setUserActionAttempted(false);
    setEditModalOpen(true);
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    if (!currentUser) return;
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      updateUserProfile.mutateAsync({
        userId: currentUser.id,
        fullName: editFullName.trim(),
        avatarUrl: editAvatarUrl.trim() || null,
        expectedUpdatedAt: currentUser.updatedAt,
      }),
    );
    if (success) setEditModalOpen(false);
  }

  async function submitStatusChange(event: FormEvent<HTMLFormElement>) {
    if (!currentUser || !displayedStatus) return;
    const status = displayedStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      changeUserStatus.mutateAsync({
        userId: currentUser.id,
        status,
        expectedUpdatedAt: currentUser.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    if (success) setStatusModalOpen(false);
  }

  async function submitArchive(event: FormEvent<HTMLFormElement>) {
    if (!currentUser) return;
    setUserActionAttempted(true);
    const success = await handleSubmit(event, () =>
      archiveUser.mutateAsync({
        userId: currentUser.id,
        expectedUpdatedAt: currentUser.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    if (success) {
      setArchiveModalOpen(false);
      setArchiveAcknowledged(false);
    }
  }
  return (
    <div className="space-y-6">
      {!canReadUsers ? (
        <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
          Your Platform session does not grant platform.users.account.read.
        </p>
      ) : (
        <>
          <section className={`${box} overflow-hidden`}>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-sm font-bold">Users</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Safe account and membership projections from the Platform API.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className={input}
                  aria-label="Search users"
                  placeholder="Search users"
                  maxLength={100}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <select
                  className={input}
                  aria-label="User status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING_INVITE">Pending invite</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
            {users.isPending ? (
              <Loading />
            ) : users.isError ? (
              <ErrorState retry={() => void users.refetch()} />
            ) : users.data?.data.length ? (
              <DirectoryTable
                headers={[
                  "User",
                  "Status",
                  "Organizations",
                  "Updated",
                  "Action",
                ]}
              >
                {users.data.data.map((user) => (
                  <tr key={user.id}>
                    <td className={cell}>
                      <span className="font-semibold">{user.fullName}</span>
                      <span className="mt-1 block text-[11px] break-all text-gray-500">
                        {user.email}
                      </span>
                    </td>
                    <td className={cell}>
                      <StatusBadge
                        status={user.archivedAt ? "ARCHIVED" : user.status}
                        label={user.archivedAt ? "ARCHIVED" : user.status}
                      />
                    </td>
                    <td className={cell}>
                      {user.memberships.length}
                      {user.membershipsTruncated ? "+" : ""}
                    </td>
                    <td className={cell}>
                      <time dateTime={user.updatedAt}>
                        {new Date(user.updatedAt).toLocaleString()}
                      </time>
                    </td>
                    <td className={cell}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedId(user.id);
                          setOrganizationPage(1);
                          setSessionPage(1);
                          setSelectedSessionId("");
                        }}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </DirectoryTable>
            ) : (
              <EmptyState
                title="No users found"
                body="Adjust the search or filters and refresh the directory."
              />
            )}
            {users.data?.pagination && (
              <PlatformPagination
                ariaLabel="Users"
                page={users.data.pagination.page}
                totalPages={users.data.pagination.totalPages}
                totalItems={users.data.pagination.totalItems}
                onPageChange={setPage}
              />
            )}
          </section>
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
              className="m-auto max-h-[92vh] w-[calc(100%-1.5rem)] max-w-4xl space-y-5 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg backdrop:bg-gray-900/15 backdrop:backdrop-blur-[1px] dark:border-gray-800 dark:bg-gray-900 dark:backdrop:bg-gray-950/25"
            >
              <header className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    {selectedUser.data?.fullName.charAt(0).toUpperCase() ?? "U"}
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="platform-user-detail-title"
                      className="truncate text-base font-semibold text-gray-900 dark:text-white"
                    >
                      {selectedUser.data?.fullName ?? "User detail"}
                    </h2>
                    {selectedUser.data?.email && (
                      <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                        {selectedUser.data.email}
                      </p>
                    )}
                  </div>
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
              {selectedUser.isPending ? (
                <Loading columns={3} />
              ) : selectedUser.isError || !selectedUser.data ? (
                <ErrorState retry={() => void selectedUser.refetch()} />
              ) : (
                <>
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                      <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                        Status
                      </dt>
                      <dd className="mt-2">
                        <StatusBadge
                          status={displayedStatus ?? selectedUser.data.status}
                          label={displayedStatus ?? selectedUser.data.status}
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
                    {userOrganizations.isPending ? (
                      <Loading columns={2} />
                    ) : userOrganizations.isError ? (
                      <ErrorState
                        retry={() => void userOrganizations.refetch()}
                      />
                    ) : userOrganizations.data?.data.length ? (
                      <>
                        <ul className="mt-2 space-y-2">
                          {userOrganizations.data.data.map((membership) => (
                            <li
                              key={membership.organizationId}
                              className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-800/50"
                            >
                              <strong>{membership.organizationName}</strong>
                              <span className="ms-2 text-gray-500">
                                {membership.status} ·{" "}
                                {membership.organizationRoles.join(", ") ||
                                  "No role"}
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
                  {canManageUsers && (
                    <section className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Account actions
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                          Profile edits are limited to the full name and avatar
                          URL. Account lifecycle actions use the current record
                          version.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isArchived && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={updateUserProfile.isPending}
                            onClick={openProfileEditor}
                          >
                            Edit profile
                          </Button>
                        )}
                        {!isArchived &&
                          selectedUser.data.id !== operatorId &&
                          selectedUser.data.status === "ACTIVE" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={changeUserStatus.isPending}
                              onClick={() => {
                                setUserActionAttempted(false);
                                setStatusModalOpen(true);
                              }}
                            >
                              Suspend account
                            </Button>
                          )}
                        {!isArchived &&
                          selectedUser.data.id !== operatorId &&
                          selectedUser.data.status === "SUSPENDED" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={changeUserStatus.isPending}
                              onClick={() => {
                                setUserActionAttempted(false);
                                setStatusModalOpen(true);
                              }}
                            >
                              Reactivate account
                            </Button>
                          )}
                        {!isArchived &&
                          selectedUser.data.id !== operatorId &&
                          ["ACTIVE", "SUSPENDED"].includes(
                            selectedUser.data.status,
                          ) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                              disabled={archiveUser.isPending}
                              onClick={() => {
                                setArchiveAcknowledged(false);
                                setUserActionAttempted(false);
                                setArchiveModalOpen(true);
                              }}
                            >
                              Archive user
                            </Button>
                          )}
                      </div>
                    </section>
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
                      {userSessions.isPending ? (
                        <Loading columns={4} />
                      ) : userSessions.isError ? (
                        <ErrorState retry={() => void userSessions.refetch()} />
                      ) : userSessions.data?.data.length ? (
                        <ul className="space-y-2">
                          {userSessions.data.data.map((session) => (
                            <li
                              key={session.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-800/50"
                            >
                              <span>
                                <span className="font-mono">{session.id}</span>
                                <span className="ms-2 text-gray-500">
                                  {session.context} · {session.status} · expires{" "}
                                  {new Date(session.expiresAt).toLocaleString()}
                                </span>
                              </span>
                              {canManageSessions &&
                                session.status === "ACTIVE" &&
                                selectedUser.data.id !== operatorId && (
                                  <div className="flex gap-2">
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
                                        if (!window.confirm("Revoke this session?"))
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
                          {selectedSession.isPending ? (
                            <Loading columns={3} />
                          ) : selectedSession.isError ||
                            !selectedSession.data ? (
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
            </dialog>
          )}
          {currentUser && (
            <>
              <Modal
                isOpen={editModalOpen}
                onClose={() => {
                  if (!updateUserProfile.isPending) setEditModalOpen(false);
                }}
                showCloseButton={false}
                className="mx-3 max-w-xl border border-gray-200 p-6 shadow-theme-lg dark:border-gray-800"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-edit-user-title"
                  className="space-y-5"
                >
                  <header className="space-y-1 pr-10">
                    <h2
                      id="platform-edit-user-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      Edit user profile
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Change the user’s display name or avatar. Account access
                      and organization roles are not changed.
                    </p>
                  </header>
                  <form className="space-y-4" onSubmit={submitProfile}>
                    <label
                      className="block space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                      htmlFor="platform-user-full-name"
                    >
                      Full name
                      <input
                        id="platform-user-full-name"
                        className={input}
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
                      className="block space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                      htmlFor="platform-user-avatar-url"
                    >
                      Avatar URL <span className="font-normal text-gray-500">(optional)</span>
                      <input
                        id="platform-user-avatar-url"
                        className={input}
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
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {formMessage}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditModalOpen(false)}
                        disabled={updateUserProfile.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          updateUserProfile.isPending || !editFullName.trim()
                        }
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
                onClose={() => {
                  if (!changeUserStatus.isPending) setStatusModalOpen(false);
                }}
                showCloseButton={false}
                className="mx-3 max-w-lg border border-gray-200 p-6 shadow-theme-lg dark:border-gray-800"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-user-status-title"
                  className="space-y-5"
                >
                  <header className="space-y-1 pr-10">
                    <h2
                      id="platform-user-status-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {displayedStatus === "ACTIVE"
                        ? "Suspend account?"
                        : "Reactivate account?"}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {currentUser.fullName} · {currentUser.email}
                    </p>
                  </header>
                  <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                    {displayedStatus === "ACTIVE"
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
                      onClick={() => setStatusModalOpen(false)}
                      disabled={changeUserStatus.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={changeUserStatus.isPending}>
                      {changeUserStatus.isPending
                        ? "Updating…"
                        : displayedStatus === "ACTIVE"
                          ? "Suspend account"
                          : "Reactivate account"}
                    </Button>
                  </form>
                </section>
              </Modal>

              <Modal
                isOpen={archiveModalOpen}
                onClose={() => {
                  if (!archiveUser.isPending) setArchiveModalOpen(false);
                }}
                showCloseButton={false}
                className="mx-3 max-w-lg border border-gray-200 p-6 shadow-theme-lg dark:border-gray-800"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="platform-user-archive-title"
                  className="space-y-5"
                >
                  <header className="space-y-1 pr-10">
                    <h2
                      id="platform-user-archive-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      Archive user?
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {currentUser.fullName} · {currentUser.email}
                    </p>
                  </header>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    This keeps the account, organization memberships, and audit
                    history. The account will be suspended, marked archived,
                    and all active sessions revoked. This action cannot be
                    undone in this console.
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
                        onClick={() => setArchiveModalOpen(false)}
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
            </>
          )}
        </>
      )}
    </div>
  );
}
