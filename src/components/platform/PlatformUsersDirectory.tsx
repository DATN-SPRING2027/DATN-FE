"use client";

import Button from "@/components/ui/button/Button";
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
    canReadSessions,
    userSessions,
    canManageSessions,
    revokeSession,
    runOperation,
    selectedSession,
    formMessage,
  } = model;
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
                      <StatusBadge status={user.status} label={user.status} />
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
                          status={selectedUser.data.status}
                          label={selectedUser.data.status}
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
                  {canManageUsers && selectedUser.data.id !== operatorId && (
                    <form
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                      onSubmit={(e) => {
                        const status =
                          selectedUser.data!.status === "ACTIVE"
                            ? "SUSPENDED"
                            : "ACTIVE";
                        if (
                          !window.confirm(`Change account status to ${status}?`)
                        ) {
                          e.preventDefault();
                          return;
                        }
                        void handleSubmit(e, () =>
                          changeUserStatus.mutateAsync({
                            userId: selectedUser.data!.id,
                            status,
                            expectedUpdatedAt: selectedUser.data!.updatedAt,
                            reasonCode: "ACCESS_REVIEW",
                          }),
                        );
                      }}
                    >
                      <p className="max-w-2xl text-xs leading-5 text-gray-500 dark:text-gray-400">
                        Account status changes require the displayed version and
                        ACCESS_REVIEW reason.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={changeUserStatus.isPending}
                      >
                        {selectedUser.data.status === "ACTIVE"
                          ? "Suspend account"
                          : "Reactivate account"}
                      </Button>
                    </form>
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
                                        if (
                                          window.confirm("Revoke this session?")
                                        )
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
                  {formMessage && (
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
        </>
      )}
    </div>
  );
}
