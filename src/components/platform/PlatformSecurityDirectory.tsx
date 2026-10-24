"use client";

import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  ErrorState,
  Loading,
  QueryRefreshStatus,
  TextField,
  box,
  cell,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

export default function PlatformSecurityDirectory({
  model,
}: {
  model: PlatformOperationsViewModel;
}) {
  const t = useTranslations("platformConsole.security");
  const {
    canReadSessions,
    userSessions,
    operatorId,
    canManageSessions,
    setSelectedSessionId,
    selectedSessionId,
    revokeSession,
    setFormMessage,
    setSessionPage,
    selectedSession,
    formMessage,
  } = model;
  return (
    <div className="space-y-6">
      {!canReadSessions ? (
        <p role="status" className={`${box} p-6 text-xs text-amber-700`}>
          Your Platform session does not grant platform.sessions.session.read.
        </p>
      ) : (
        <section className={`${box} overflow-hidden`}>
          <div className="border-b border-gray-100 p-5 dark:border-gray-800">
            <h2 className="text-sm font-bold">{t("adminSessions")}</h2>
            <p className="mt-1 text-xs text-gray-500">
              Session metadata for the authenticated Platform account.
            </p>
          </div>
          {userSessions.data !== undefined && !isReadAccessLost(userSessions.error) && (userSessions.isFetching || userSessions.isRefetchError) && (
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <QueryRefreshStatus
                hasData
                isFetching={userSessions.isFetching}
                isRefetchError={userSessions.isRefetchError}
                onRetry={() => void userSessions.refetch()}
              />
            </div>
          )}
          {userSessions.isPending && !userSessions.data ? (
            <Loading columns={5} />
          ) : userSessions.isError && (!userSessions.data || isReadAccessLost(userSessions.error)) ? (
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
              ariaLabel={t("adminSessions")}
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
              {t("currentAdminSessionGuard")}
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
              {selectedSession.data !== undefined && !isReadAccessLost(selectedSession.error) && (selectedSession.isFetching || selectedSession.isRefetchError) && (
                <div className="mb-3">
                  <QueryRefreshStatus
                    hasData
                    isFetching={selectedSession.isFetching}
                    isRefetchError={selectedSession.isRefetchError}
                    onRetry={() => void selectedSession.refetch()}
                  />
                </div>
              )}
              {selectedSession.isPending && !selectedSession.data ? (
                <Loading columns={3} />
              ) : !selectedSession.data || (selectedSession.isError && isReadAccessLost(selectedSession.error)) ? (
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
