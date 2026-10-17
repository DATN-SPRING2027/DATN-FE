"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "@/components/ui/button/Button";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import { TableSkeleton } from "@/components/platform/ui/LoadingSkeleton";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import {
  usePlatformAiOperationsQuery,
  usePlatformChangeProjectMetadataMutation,
  usePlatformChangeUserStatusMutation,
  usePlatformCreateIncidentMutation,
  usePlatformIncidentActionMutation,
  usePlatformIncidentQuery,
  usePlatformIncidentHistoryQuery,
  usePlatformIncidentsQuery,
  usePlatformIntegrationsQuery,
  usePlatformJobCommandMutation,
  usePlatformJobsQuery,
  usePlatformProjectQuery,
  usePlatformProjectsQuery,
  usePlatformQueuesQuery,
  usePlatformRequestTraceQuery,
  usePlatformRevokeSessionMutation,
  usePlatformServicesQuery,
  usePlatformUserQuery,
  usePlatformUserOrganizationsQuery,
  usePlatformUserSessionQuery,
  usePlatformUserSessionsQuery,
  usePlatformUsersQuery,
} from "@/lib/queries/platform/usePlatformOperations";

type Section =
  | "users"
  | "projects"
  | "services"
  | "jobs"
  | "ai"
  | "integrations"
  | "incidents"
  | "diagnostics"
  | "security";
type Props = Readonly<{
  section: Section;
  permissions: readonly PlatformPermission[];
  operatorId: string;
}>;
const box =
  "rounded-2xl border border-gray-200/80 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900";
const input =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-white";
const cell = "px-5 py-3.5 text-xs text-gray-600 dark:text-gray-300";

function has(
  permissions: readonly PlatformPermission[],
  permission: PlatformPermission,
) {
  return permissions.includes(permission);
}
function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-5 py-6 text-xs text-rose-600"
      role="alert"
    >
      <span>
        Could not load this Platform data. Check access or connection, then
        retry.
      </span>
      <Button variant="outline" size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
function Loading({ columns = 5 }: { columns?: number }) {
  return (
    <>
      <p className="sr-only" role="status">
        Loading Platform data
      </p>
      <TableSkeleton rows={4} columns={columns} />
    </>
  );
}
function TextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs break-words text-gray-800 dark:text-gray-200">
        {value || "—"}
      </dd>
    </div>
  );
}
function DirectoryTable({
  children,
  headers,
}: {
  children: React.ReactNode;
  headers: readonly string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/40">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-5 py-3 text-start">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export default function PlatformOperationsDirectory({
  section,
  permissions,
  operatorId,
}: Props) {
  const canReadUsers = has(permissions, "platform.users.account.read");
  const canManageUsers = has(permissions, "platform.users.account.manage");
  const canReadSessions = has(permissions, "platform.sessions.session.read");
  const canManageSessions = has(
    permissions,
    "platform.sessions.session.manage",
  );
  const canReadProjects = has(permissions, "platform.projects.project.read");
  const canManageProjects = has(
    permissions,
    "platform.projects.project.manage",
  );
  const canReadServices = has(permissions, "platform.services.service.read");
  const canReadJobs = has(permissions, "platform.jobs.job.read");
  const canManageJobs = has(permissions, "platform.jobs.job.manage");
  const canReadAi = has(permissions, "platform.ai.operations.read");
  const canReadIntegrations = has(
    permissions,
    "platform.integrations.integration.read",
  );
  const canReadIncidents = has(permissions, "platform.incidents.incident.read");
  const canManageIncidents = has(
    permissions,
    "platform.incidents.incident.manage",
  );
  const [page, setPage] = useState(1);
  const [organizationPage, setOrganizationPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [incidentHistoryPage, setIncidentHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [traceId, setTraceId] = useState("");
  const [note, setNote] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const userDetailDialogRef = useRef<HTMLDialogElement>(null);
  const userDetailCloseButtonRef = useRef<HTMLButtonElement>(null);
  const userDetailTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selectedId) {
      userDetailTriggerRef.current?.focus();
      return;
    }

    const dialog = userDetailDialogRef.current;
    if (!dialog) return;

    userDetailTriggerRef.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    if (!dialog.open) dialog.showModal();
    userDetailCloseButtonRef.current?.focus();
  }, [selectedId]);

  function closeUserDetails() {
    setSelectedId("");
    setSelectedSessionId("");
  }

  const users = usePlatformUsersQuery(
    {
      page,
      pageSize: 25,
      search: search.trim() || undefined,
      status: status as "ACTIVE" | "SUSPENDED" | "PENDING_INVITE" | undefined,
    },
    section === "users" && canReadUsers,
  );
  const selectedUser = usePlatformUserQuery(
    selectedId,
    section === "users" && canReadUsers,
  );
  const userOrganizations = usePlatformUserOrganizationsQuery(
    selectedId,
    section === "users" && canReadUsers && Boolean(selectedId),
    organizationPage,
  );
  const userSessions = usePlatformUserSessionsQuery(
    section === "security" ? operatorId : selectedId,
    (section === "security" && canReadSessions) ||
      (section === "users" && canReadSessions && Boolean(selectedId)),
    sessionPage,
  );
  const selectedSession = usePlatformUserSessionQuery(
    section === "security" ? operatorId : selectedId,
    selectedSessionId,
    Boolean(selectedSessionId) &&
      ((section === "security" && canReadSessions) ||
        (section === "users" && canReadSessions && Boolean(selectedId))),
  );
  const changeUserStatus = usePlatformChangeUserStatusMutation();
  const revokeSession = usePlatformRevokeSessionMutation();
  const projects = usePlatformProjectsQuery(
    {
      page,
      pageSize: 25,
      search: search.trim() || undefined,
      visibility: status ? (status as "PUBLIC" | "PRIVATE") : undefined,
    },
    section === "projects" && canReadProjects,
  );
  const selectedProject = usePlatformProjectQuery(
    selectedId,
    section === "projects" && canReadProjects,
  );
  const changeProject = usePlatformChangeProjectMetadataMutation();
  const services = usePlatformServicesQuery(
    section === "services" && canReadServices,
  );
  const queues = usePlatformQueuesQuery(section === "jobs" && canReadJobs);
  const jobs = usePlatformJobsQuery(
    { page, pageSize: 25, status: status || undefined },
    section === "jobs" && canReadJobs,
  );
  const jobCommand = usePlatformJobCommandMutation();
  const ai = usePlatformAiOperationsQuery(section === "ai" && canReadAi);
  const integrations = usePlatformIntegrationsQuery(
    { page, pageSize: 25, status: status || undefined },
    section === "integrations" && canReadIntegrations,
  );
  const incidents = usePlatformIncidentsQuery(
    { page, pageSize: 25, status: status || undefined },
    section === "incidents" && canReadIncidents,
  );
  const incidentHistory = usePlatformIncidentHistoryQuery(
    selectedId,
    section === "incidents" && canReadIncidents && Boolean(selectedId),
    incidentHistoryPage,
  );
  const selectedIncident = usePlatformIncidentQuery(
    selectedId,
    section === "incidents" && canReadIncidents && Boolean(selectedId),
  );
  const createIncident = usePlatformCreateIncidentMutation();
  const incidentAction = usePlatformIncidentActionMutation();
  const trace = usePlatformRequestTraceQuery(
    traceId,
    section === "diagnostics" &&
      Boolean(traceId) &&
      has(permissions, "platform.diagnostics.trace.read"),
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    action: () => Promise<unknown>,
  ) {
    event.preventDefault();
    setFormMessage("");
    try {
      await action();
      setFormMessage(
        "Operation completed. The Platform state and audit projection are refreshing.",
      );
      setNote("");
    } catch {
      setFormMessage(
        "The operation was not confirmed. Refresh the record before trying again.",
      );
    }
  }
  async function runOperation(action: () => Promise<unknown>) {
    setFormMessage("");
    try {
      await action();
      setFormMessage(
        "Operation completed. The Platform state and audit projection are refreshing.",
      );
      setNote("");
    } catch {
      setFormMessage(
        "The operation was not confirmed. Refresh the record before trying again.",
      );
    }
  }

  if (section === "users")
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
                    Safe account and membership projections from the Platform
                    API.
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
                      {selectedUser.data?.fullName.charAt(0).toUpperCase() ??
                        "U"}
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
                                  <span className="mt-1 block font-mono text-[10px] text-gray-500">
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
                            !window.confirm(
                              `Change account status to ${status}?`,
                            )
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
                          Account status changes require the displayed version
                          and ACCESS_REVIEW reason.
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
                          <ErrorState
                            retry={() => void userSessions.refetch()}
                          />
                        ) : userSessions.data?.data.length ? (
                          <ul className="space-y-2">
                            {userSessions.data.data.map((session) => (
                              <li
                                key={session.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-800/50"
                              >
                                <span>
                                  <span className="font-mono">
                                    {session.id}
                                  </span>
                                  <span className="ms-2 text-gray-500">
                                    {session.context} · {session.status} ·
                                    expires{" "}
                                    {new Date(
                                      session.expiresAt,
                                    ).toLocaleString()}
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
                                            window.confirm(
                                              "Revoke this session?",
                                            )
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

  if (section === "projects")
    return (
      <div className="space-y-6">
        {!canReadProjects ? (
          <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
            Your Platform session does not grant platform.projects.project.read.
          </p>
        ) : (
          <>
            <section className={`${box} overflow-hidden`}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
                <div>
                  <h2 className="text-sm font-bold">Projects</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Project metadata only. Tenant content is never exposed here.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={input}
                    aria-label="Search projects"
                    placeholder="Search projects"
                    value={search}
                    maxLength={100}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <select
                    className={input}
                    aria-label="Project visibility"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All visibility</option>
                    <option value="PRIVATE">Private</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </div>
              </div>
              {projects.isPending ? (
                <Loading />
              ) : projects.isError ? (
                <ErrorState retry={() => void projects.refetch()} />
              ) : projects.data?.data.length ? (
                <DirectoryTable
                  headers={[
                    "Project",
                    "Organization",
                    "Visibility",
                    "Members",
                    "Action",
                  ]}
                >
                  {projects.data.data.map((project) => (
                    <tr key={project.id}>
                      <td className={cell}>
                        <strong>{project.name}</strong>
                        <span className="font-mono mt-1 block text-[10px] text-gray-500">
                          {project.code}
                        </span>
                      </td>
                      <td className={cell}>{project.organization.name}</td>
                      <td className={cell}>
                        <StatusBadge
                          status={project.visibility}
                          label={project.visibility}
                        />
                      </td>
                      <td className={cell}>{project.memberCount}</td>
                      <td className={cell}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedId(project.id)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </DirectoryTable>
              ) : (
                <EmptyState
                  title="No projects"
                  body="The Platform API returned no projects for these filters."
                />
              )}
              {projects.data?.pagination && (
                <PlatformPagination
                  ariaLabel="Projects"
                  page={projects.data.pagination.page}
                  totalPages={projects.data.pagination.totalPages}
                  totalItems={projects.data.pagination.totalItems}
                  onPageChange={setPage}
                />
              )}
            </section>
            {selectedId && (
              <section className={`${box} p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold">Project detail</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedId("")}
                  >
                    Close
                  </Button>
                </div>
                {selectedProject.isPending ? (
                  <Loading columns={3} />
                ) : selectedProject.isError || !selectedProject.data ? (
                  <ErrorState retry={() => void selectedProject.refetch()} />
                ) : (
                  <>
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <TextField
                        label="Project"
                        value={selectedProject.data.name}
                      />
                      <TextField
                        label="Organization"
                        value={`${selectedProject.data.organization.name} · ${selectedProject.data.organization.slug}`}
                      />
                      <TextField
                        label="Visibility"
                        value={selectedProject.data.visibility}
                      />
                      <TextField
                        label="Status and members"
                        value={`${selectedProject.data.status} · ${selectedProject.data.memberCount}`}
                      />
                    </dl>
                    <p className="mt-3 text-xs text-gray-500">
                      Leaders:{" "}
                      {selectedProject.data.leaders
                        .map((leader) => `${leader.fullName} (${leader.email})`)
                        .join(", ") || "None"}
                      {selectedProject.data.leadersTruncated
                        ? " · list truncated"
                        : ""}
                    </p>
                    {canManageProjects && (
                      <form
                        className="mt-5 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"
                        onSubmit={(e) => {
                          const visibility = (
                            e.currentTarget.elements.namedItem(
                              "visibility",
                            ) as HTMLSelectElement
                          ).value as "PUBLIC" | "PRIVATE";
                          if (visibility === selectedProject.data!.visibility) {
                            e.preventDefault();
                            setFormMessage(
                              "No project metadata changes to save.",
                            );
                            return;
                          }
                          if (
                            !window.confirm(
                              `Change project visibility to ${visibility}?`,
                            )
                          ) {
                            e.preventDefault();
                            return;
                          }
                          void handleSubmit(e, () =>
                            changeProject.mutateAsync({
                              projectId: selectedProject.data!.id,
                              visibility,
                              expectedUpdatedAt:
                                selectedProject.data!.updatedAt,
                              reasonCode: "ACCESS_REVIEW",
                            }),
                          );
                        }}
                      >
                        <label className="grid gap-1 text-xs">
                          Visibility
                          <select
                            name="visibility"
                            defaultValue={selectedProject.data.visibility}
                            className={input}
                          >
                            <option value="PRIVATE">Private</option>
                            <option value="PUBLIC">Public</option>
                          </select>
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={changeProject.isPending}
                        >
                          Save metadata
                        </Button>
                      </form>
                    )}
                    {formMessage && (
                      <p className="mt-3 text-xs" role="status">
                        {formMessage}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    );

  if (section === "services")
    return !canReadServices ? (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant platform.services.service.read.
      </p>
    ) : (
      <section className={`${box} overflow-hidden`}>
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="text-sm font-bold">Service operations</h2>
          <p className="mt-1 text-xs text-gray-500">
            Readiness, dependency status, and bounded diagnostics from the
            Platform API.
          </p>
        </div>
        {services.isPending ? (
          <Loading columns={4} />
        ) : services.isError ? (
          <ErrorState retry={() => void services.refetch()} />
        ) : services.data?.length ? (
          <DirectoryTable
            headers={[
              "Service",
              "Status",
              "Availability",
              "Dependencies",
              "Checked",
            ]}
          >
            {services.data.map((service) => (
              <tr key={service.id}>
                <td className={cell}>
                  <strong>{service.name}</strong>
                  <span className="font-mono mt-1 block text-[10px] text-gray-500">
                    {service.id}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge status={service.status} label={service.status} />
                </td>
                <td className={cell}>
                  {service.availability} / {service.liveness}
                </td>
                <td className={cell}>
                  {Object.entries(service.dependencies)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(" · ") || "No dependency detail"}
                </td>
                <td className={cell}>
                  {service.lastCheckedAt
                    ? new Date(service.lastCheckedAt).toLocaleString()
                    : "—"}
                  <span className="mt-1 block max-w-sm text-[10px] text-gray-500">
                    {service.diagnosticsSummary}
                  </span>
                </td>
              </tr>
            ))}
          </DirectoryTable>
        ) : (
          <EmptyState
            title="No service data"
            body="No service projections were returned."
          />
        )}
      </section>
    );

  if (section === "jobs")
    return !canReadJobs ? (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant platform.jobs.job.read.
      </p>
    ) : (
      <div className="space-y-6">
        <section className={`${box} overflow-hidden`}>
          <div className="border-b border-gray-100 p-5 dark:border-gray-800">
            <h2 className="text-sm font-bold">Queues</h2>
            <p className="mt-1 text-xs text-gray-500">
              Live queue health, worker counts, and bounded job counts.
            </p>
          </div>
          {queues.isPending ? (
            <Loading columns={4} />
          ) : queues.isError ? (
            <ErrorState retry={() => void queues.refetch()} />
          ) : queues.data?.length ? (
            <DirectoryTable
              headers={["Queue", "Status", "Paused", "Workers", "Depth"]}
            >
              {queues.data.map((queue) => (
                <tr key={queue.id}>
                  <td className={cell}>{queue.id}</td>
                  <td className={cell}>
                    <StatusBadge status={queue.status} label={queue.status} />
                  </td>
                  <td className={cell}>
                    {queue.paused === null
                      ? "Unknown"
                      : queue.paused
                        ? "Yes"
                        : "No"}
                  </td>
                  <td className={cell}>{queue.workers ?? "—"}</td>
                  <td className={cell}>{queue.depth ?? "—"}</td>
                </tr>
              ))}
            </DirectoryTable>
          ) : (
            <EmptyState
              title="No queue data"
              body="The configured queue runtime returned no queue projections."
            />
          )}
        </section>
        <section className={`${box} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
            <div>
              <h2 className="text-sm font-bold">Jobs</h2>
              <p className="mt-1 text-xs text-gray-500">
                Payload, result, and raw failure text are withheld by the API.
              </p>
            </div>
            <select
              className={input}
              aria-label="Job status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All states</option>
              {[
                "WAITING",
                "ACTIVE",
                "COMPLETED",
                "FAILED",
                "DELAYED",
                "PAUSED",
                "WAITING_CHILDREN",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {jobs.isPending ? (
            <Loading />
          ) : jobs.isError ? (
            <ErrorState retry={() => void jobs.refetch()} />
          ) : jobs.data?.data.length ? (
            <DirectoryTable
              headers={[
                "Job",
                "Queue",
                "Status",
                "Attempts",
                "Failure summary",
                "Action",
              ]}
            >
              {jobs.data.data.map((job) => (
                <tr key={`${job.queueId}-${job.id}`}>
                  <td className={`${cell} font-mono`}>{job.id}</td>
                  <td className={cell}>{job.queueId}</td>
                  <td className={cell}>
                    <StatusBadge status={job.status} label={job.status} />
                  </td>
                  <td className={cell}>
                    {job.attemptsMade}/{job.attempts}
                  </td>
                  <td className={cell}>{job.failureSummary ?? "—"}</td>
                  <td className={cell}>
                    {canManageJobs && job.status === "FAILED" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={jobCommand.isPending}
                        onClick={() => {
                          if (window.confirm(`Retry failed job ${job.id}?`))
                            void jobCommand
                              .mutateAsync({
                                queueId: job.queueId,
                                jobId: job.id,
                                action: "retry",
                                expectedStatus: "FAILED",
                              })
                              .catch(() =>
                                setFormMessage(
                                  "Job state changed or the operation was blocked. Refreshed Platform data is required.",
                                ),
                              );
                        }}
                      >
                        Retry
                      </Button>
                    ) : canManageJobs &&
                      ["WAITING", "DELAYED"].includes(job.status) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={jobCommand.isPending}
                        onClick={() => {
                          if (window.confirm(`Cancel job ${job.id}?`))
                            void jobCommand
                              .mutateAsync({
                                queueId: job.queueId,
                                jobId: job.id,
                                action: "cancel",
                                expectedStatus: job.status as
                                  "WAITING" | "DELAYED",
                              })
                              .catch(() =>
                                setFormMessage(
                                  "Job state changed or the operation was blocked. Refreshed Platform data is required.",
                                ),
                              );
                        }}
                      >
                        Cancel
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </DirectoryTable>
          ) : (
            <EmptyState
              title="No jobs found"
              body="The Platform API returned no jobs for these filters."
            />
          )}
          {jobs.data?.pagination && (
            <PlatformPagination
              ariaLabel="Jobs"
              page={jobs.data.pagination.page}
              totalPages={jobs.data.pagination.totalPages}
              totalItems={jobs.data.pagination.totalItems}
              onPageChange={setPage}
            />
          )}
        </section>
        {formMessage && (
          <p role="status" className="text-xs">
            {formMessage}
          </p>
        )}
      </div>
    );

  if (section === "ai")
    return !canReadAi ? (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant platform.ai.operations.read.
      </p>
    ) : (
      <section className={`${box} p-5`}>
        <h2 className="text-sm font-bold">SAG / RAG operations</h2>
        <p className="mt-1 text-xs text-gray-500">
          Operational metadata only; model/provider health and processing job
          details are not exposed by the current BE contract.
        </p>
        {ai.isPending ? (
          <Loading columns={3} />
        ) : ai.isError || !ai.data ? (
          <ErrorState retry={() => void ai.refetch()} />
        ) : (
          <>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="Service" value={ai.data.name} />
              <TextField label="Readiness" value={ai.data.readiness} />
              <TextField label="Availability" value={ai.data.availability} />
              <TextField
                label="Last checked"
                value={new Date(ai.data.lastCheckedAt).toLocaleString()}
              />
            </dl>
            <p className="mt-4 rounded-xl bg-gray-50 p-4 text-xs dark:bg-gray-800">
              {ai.data.diagnosticsSummary}
            </p>
            <p className="mt-3 text-xs text-gray-500">
              Dependencies:{" "}
              {Object.entries(ai.data.dependencies)
                .map(([key, value]) => `${key}: ${String(value)}`)
                .join(" · ") || "No dependency detail"}
            </p>
          </>
        )}
      </section>
    );

  if (section === "integrations")
    return !canReadIntegrations ? (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant
        platform.integrations.integration.read.
      </p>
    ) : (
      <section className={`${box} overflow-hidden`}>
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="text-sm font-bold">Integrations</h2>
          <p className="mt-1 text-xs text-gray-500">
            Safe Jira metadata only. Site URLs, credentials, and raw errors are
            withheld.
          </p>
        </div>
        {integrations.isPending ? (
          <Loading columns={4} />
        ) : integrations.isError ? (
          <ErrorState retry={() => void integrations.refetch()} />
        ) : integrations.data?.data.length ? (
          <DirectoryTable
            headers={[
              "Provider",
              "Organization / Project",
              "Status",
              "Last sync",
              "Failure summary",
            ]}
          >
            {integrations.data.data.map((integration) => (
              <tr key={integration.id}>
                <td className={cell}>
                  {integration.provider}
                  <span className="font-mono mt-1 block text-[10px] text-gray-500">
                    {integration.id}
                  </span>
                </td>
                <td className={cell}>
                  {integration.organizationId}
                  <span className="mt-1 block">{integration.projectId}</span>
                </td>
                <td className={cell}>
                  <StatusBadge
                    status={integration.status}
                    label={integration.status}
                  />
                </td>
                <td className={cell}>
                  {integration.lastSyncAt
                    ? new Date(integration.lastSyncAt).toLocaleString()
                    : "—"}
                </td>
                <td className={cell}>
                  {integration.lastFailureSummary ?? "—"}
                </td>
              </tr>
            ))}
          </DirectoryTable>
        ) : (
          <EmptyState
            title="No integrations found"
            body="The Platform API returned no integration projections."
          />
        )}
        {integrations.data?.pagination && (
          <PlatformPagination
            ariaLabel="Integrations"
            page={integrations.data.pagination.page}
            totalPages={integrations.data.pagination.totalPages}
            totalItems={integrations.data.pagination.totalItems}
            onPageChange={setPage}
          />
        )}
        <p className="border-t border-gray-100 px-5 py-4 text-xs text-amber-700 dark:border-gray-800 dark:text-amber-400">
          Test and reconnect commands are currently blocked by the BE provider
          readiness gate; no action has been sent.
        </p>
      </section>
    );

  if (section === "incidents")
    return !canReadIncidents ? (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant platform.incidents.incident.read.
      </p>
    ) : (
      <div className="space-y-6">
        <section className={`${box} p-5`}>
          <h2 className="text-sm font-bold">Create incident</h2>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              const form = e.currentTarget;
              const values = new FormData(form);
              void handleSubmit(e, () =>
                createIncident.mutateAsync({
                  title: String(values.get("title") ?? ""),
                  severity: String(values.get("severity") ?? "HIGH") as
                    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
                  affectedServiceId: String(values.get("service") ?? "iam"),
                }),
              );
            }}
          >
            <label className="grid flex-1 gap-1 text-xs">
              Title
              <input name="title" maxLength={160} required className={input} />
            </label>
            <label className="grid gap-1 text-xs">
              Severity
              <select name="severity" className={input}>
                <option>HIGH</option>
                <option>CRITICAL</option>
                <option>MEDIUM</option>
                <option>LOW</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Service
              <select name="service" className={input}>
                {[
                  "iam",
                  "capture",
                  "jira",
                  "lifecycle",
                  "chat",
                  "handover",
                  "ingestion",
                  "notification",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={!canManageIncidents || createIncident.isPending}
            >
              Create
            </Button>
          </form>
          {!canManageIncidents && (
            <p className="mt-2 text-[11px] text-amber-700">
              Incident management permission is required to create incidents.
            </p>
          )}
        </section>
        <section className={`${box} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
            <div>
              <h2 className="text-sm font-bold">Incidents</h2>
              <p className="mt-1 text-xs text-gray-500">
                Actions use expectedVersion; a conflict refreshes current
                records.
              </p>
            </div>
            <select
              className={input}
              aria-label="Incident status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {incidents.isPending ? (
            <Loading />
          ) : incidents.isError ? (
            <ErrorState retry={() => void incidents.refetch()} />
          ) : incidents.data?.data.length ? (
            <DirectoryTable
              headers={[
                "Incident",
                "Severity",
                "Service",
                "Status",
                "Version",
                "Action",
              ]}
            >
              {incidents.data.data.map((incident) => (
                <tr key={incident.id}>
                  <td className={cell}>
                    <strong>{incident.title}</strong>
                    <span className="font-mono mt-1 block text-[10px] text-gray-500">
                      {incident.id}
                    </span>
                  </td>
                  <td className={cell}>
                    <StatusBadge
                      status={incident.severity}
                      label={incident.severity}
                    />
                  </td>
                  <td className={cell}>{incident.affectedServiceId}</td>
                  <td className={cell}>{incident.status}</td>
                  <td className={cell}>{incident.version}</td>
                  <td className={cell}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedId(incident.id);
                        setIncidentHistoryPage(1);
                      }}
                    >
                      Details & history
                    </Button>
                  </td>
                </tr>
              ))}
            </DirectoryTable>
          ) : (
            <EmptyState
              title="No incidents"
              body="The Platform API returned no incidents for these filters."
            />
          )}
          {incidents.data?.pagination && (
            <PlatformPagination
              ariaLabel="Incidents"
              page={incidents.data.pagination.page}
              totalPages={incidents.data.pagination.totalPages}
              totalItems={incidents.data.pagination.totalItems}
              onPageChange={setPage}
            />
          )}
        </section>
        {selectedId && (
          <section className={`${box} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Incident detail & history</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedId("");
                  setIncidentHistoryPage(1);
                  setNote("");
                }}
              >
                Close
              </Button>
            </div>
            {selectedIncident.isPending ? (
              <Loading columns={4} />
            ) : selectedIncident.isError || !selectedIncident.data ? (
              <ErrorState retry={() => void selectedIncident.refetch()} />
            ) : (
              <dl className="mb-5 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-gray-800">
                <TextField label="Title" value={selectedIncident.data.title} />
                <TextField
                  label="Severity / status"
                  value={`${selectedIncident.data.severity} · ${selectedIncident.data.status}`}
                />
                <TextField
                  label="Affected service"
                  value={selectedIncident.data.affectedServiceId}
                />
                <TextField
                  label="Version / updated"
                  value={`v${selectedIncident.data.version} · ${new Date(selectedIncident.data.updatedAt).toLocaleString()}`}
                />
              </dl>
            )}
            {incidentHistory.isPending ? (
              <Loading columns={4} />
            ) : incidentHistory.isError ? (
              <ErrorState retry={() => void incidentHistory.refetch()} />
            ) : incidentHistory.data?.data.length ? (
              <ul className="space-y-2">
                {incidentHistory.data.data.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800"
                  >
                    <strong>{item.action}</strong> · {item.fromStatus ?? "—"} →{" "}
                    {item.toStatus} · v{item.version}
                    <p className="mt-1 text-gray-500">
                      {new Date(item.occurredAt).toLocaleString()} ·{" "}
                      {item.actorUserId}
                    </p>
                    {item.note && (
                      <p className="mt-2 break-words">{item.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No history"
                body="No history records were returned."
              />
            )}
            {incidentHistory.data?.pagination && (
              <PlatformPagination
                ariaLabel="Incident history"
                page={incidentHistory.data.pagination.page}
                totalPages={incidentHistory.data.pagination.totalPages}
                totalItems={incidentHistory.data.pagination.totalItems}
                onPageChange={setIncidentHistoryPage}
              />
            )}
            {canManageIncidents && selectedIncident.data && (
              <form
                className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800"
                onSubmit={(e) => {
                  const incident = selectedIncident.data;
                  if (incident)
                    void handleSubmit(e, () =>
                      incidentAction.mutateAsync({
                        incidentId: incident.id,
                        action: "notes",
                        expectedVersion: incident.version,
                        note,
                      }),
                    );
                }}
              >
                <label className="grid min-w-56 flex-1 gap-1 text-xs">
                  Redacted operational note
                  <textarea
                    className={`${input} min-h-20 py-2`}
                    maxLength={2000}
                    required
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={incidentAction.isPending}
                  onClick={() => {
                    const incident = selectedIncident.data;
                    if (
                      incident &&
                      window.confirm(`Acknowledge incident ${incident.id}?`)
                    )
                      void runOperation(() =>
                        incidentAction.mutateAsync({
                          incidentId: incident.id,
                          action: "acknowledge",
                          expectedVersion: incident.version,
                          note,
                        }),
                      );
                  }}
                >
                  Acknowledge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={incidentAction.isPending}
                  onClick={() => {
                    const incident = selectedIncident.data;
                    if (
                      incident &&
                      window.confirm(`Resolve incident ${incident.id}?`)
                    )
                      void runOperation(() =>
                        incidentAction.mutateAsync({
                          incidentId: incident.id,
                          action: "resolve",
                          expectedVersion: incident.version,
                          note,
                        }),
                      );
                  }}
                >
                  Resolve
                </Button>
                <Button variant="outline" size="sm" type="submit">
                  Add note
                </Button>
              </form>
            )}
            {formMessage && (
              <p className="mt-3 text-xs" role="status">
                {formMessage}
              </p>
            )}
          </section>
        )}
      </div>
    );

  if (section === "diagnostics")
    return !has(permissions, "platform.diagnostics.trace.read") ? (
      <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
        Your Platform session does not grant platform.diagnostics.trace.read.
      </p>
    ) : (
      <section className={`${box} overflow-hidden`}>
        <div className="border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="text-sm font-bold">Request trace</h2>
          <p className="mt-1 text-xs text-gray-500">
            Enter a request ID to view up to 50 safe audit events. Raw logs and
            tenant content are not returned.
          </p>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTraceId(requestId.trim());
            }}
          >
            <input
              className={`${input} font-mono min-w-64 flex-1`}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              aria-label="Request ID"
              maxLength={128}
              pattern="[A-Za-z0-9._:-]+"
              required
              placeholder="Request ID"
            />
            <Button variant="outline" size="sm">
              Find trace
            </Button>
          </form>
        </div>
        {trace.isPending && traceId ? (
          <Loading />
        ) : trace.isError ? (
          <ErrorState retry={() => void trace.refetch()} />
        ) : trace.data ? (
          <>
            <DirectoryTable
              headers={["Time", "Action", "Resource", "Actor", "Result"]}
            >
              {trace.data.events.map((event) => (
                <tr key={event.eventId}>
                  <td className={cell}>
                    {new Date(event.occurredAt).toLocaleString()}
                  </td>
                  <td className={cell}>{event.action}</td>
                  <td className={cell}>
                    {event.resourceType} · {event.resourceId}
                  </td>
                  <td className={cell}>{event.actorUserId}</td>
                  <td className={cell}>{event.result}</td>
                </tr>
              ))}
            </DirectoryTable>
            {trace.data.truncated && (
              <p className="px-5 py-3 text-xs text-amber-700">
                The API truncated this trace to its bounded event limit.
              </p>
            )}
          </>
        ) : (
          <EmptyState
            title="No trace selected"
            body="Submit a request ID to query the diagnostics API."
          />
        )}
      </section>
    );

  return (
    <div className="space-y-6">
      {!canReadSessions ? (
        <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
          Your Platform session does not grant platform.sessions.session.read.
        </p>
      ) : (
        <section className={`${box} overflow-hidden`}>
          <div className="border-b border-gray-100 p-5 dark:border-gray-800">
            <h2 className="text-sm font-bold">Operator sessions</h2>
            <p className="mt-1 text-xs text-gray-500">
              Session metadata for the authenticated Platform account.
            </p>
          </div>
          {userSessions.isPending ? (
            <Loading columns={5} />
          ) : userSessions.isError ? (
            <ErrorState retry={() => void userSessions.refetch()} />
          ) : userSessions.data?.data.length ? (
            <DirectoryTable
              headers={["Session", "Context", "Status", "Expires", "Action"]}
            >
              {userSessions.data.data.map((session) => (
                <tr key={session.id}>
                  <td className={`${cell} font-mono`}>{session.id}</td>
                  <td className={cell}>
                    {session.context}
                    {session.organizationId && (
                      <span className="font-mono mt-1 block text-[10px]">
                        {session.organizationId}
                      </span>
                    )}
                  </td>
                  <td className={cell}>
                    <StatusBadge
                      status={session.status}
                      label={session.status}
                    />
                  </td>
                  <td className={cell}>
                    {new Date(session.expiresAt).toLocaleString()}
                  </td>
                  <td className={cell}>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSessionId(session.id)}
                      >
                        Details
                      </Button>
                      {canManageSessions &&
                        session.status === "ACTIVE" &&
                        session.userId !== operatorId && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={revokeSession.isPending}
                            onClick={() => {
                              if (window.confirm("Revoke this session?"))
                                void revokeSession
                                  .mutateAsync({
                                    userId: session.userId,
                                    sessionId: session.id,
                                    expectedUpdatedAt: session.updatedAt,
                                    reasonCode: "ACCESS_REVIEW",
                                  })
                                  .catch(() =>
                                    setFormMessage(
                                      "Session state changed or the operation was blocked. Refresh the list.",
                                    ),
                                  );
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </DirectoryTable>
          ) : (
            <EmptyState
              title="No sessions"
              body="The Platform API returned no session records."
            />
          )}
          {userSessions.data?.pagination && (
            <PlatformPagination
              ariaLabel="Operator sessions"
              page={userSessions.data.pagination.page}
              totalPages={userSessions.data.pagination.totalPages}
              totalItems={userSessions.data.pagination.totalItems}
              onPageChange={setSessionPage}
            />
          )}
          {userSessions.data?.data.some(
            (session) => session.userId === operatorId,
          ) && (
            <p className="border-t border-gray-100 px-5 py-3 text-[11px] text-amber-700 dark:border-gray-800 dark:text-amber-400">
              Revoke is withheld for current-operator sessions because the API
              does not identify which session belongs to this browser.
            </p>
          )}
          {selectedSessionId && (
            <div className="border-t border-gray-100 p-5 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold">Session detail</h3>
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
              ) : selectedSession.isError || !selectedSession.data ? (
                <ErrorState retry={() => void selectedSession.refetch()} />
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
        <p role="status" className="text-xs">
          {formMessage}
        </p>
      )}
    </div>
  );
}
