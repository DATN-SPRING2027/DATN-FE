"use client";

import { useRef } from "react";
import PlatformRecordModal from "./ui/PlatformRecordModal";
import Button from "@/components/ui/button/Button";
import { useTranslations } from "next-intl";
import PlatformPagination from "@/components/platform/PlatformPagination";
import EmptyState from "@/components/platform/ui/EmptyState";
import StatusBadge from "@/components/platform/ui/StatusBadge";
import {
  DirectoryTable,
  formatPlatformDate,
  DirectoryToolbar,
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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
          <DirectoryToolbar title={t("adminSessions")} />
          {userSessions.data !== undefined &&
            !isReadAccessLost(userSessions.error) &&
            (userSessions.isFetching || userSessions.isRefetchError) && (
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
          ) : userSessions.isError &&
            (!userSessions.data || isReadAccessLost(userSessions.error)) ? (
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
                    {formatPlatformDate(session.expiresAt)}
                  </td>
                  <td className={cell}>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          triggerRef.current = event.currentTarget;
                          setSelectedSessionId(session.id);
                        }}
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
          {userSessions.data?.pagination &&
            !isReadAccessLost(userSessions.error) && (
              <PlatformPagination
                ariaLabel={t("adminSessions")}
                page={userSessions.data.pagination.page}
                totalPages={userSessions.data.pagination.totalPages}
                totalItems={userSessions.data.pagination.totalItems}
                alwaysShow
                pageSize={userSessions.data.pagination.pageSize}
                returnedItems={userSessions.data.data.length}
                disabled={userSessions.isFetching}
                onPageChange={setSessionPage}
              />
            )}
          {selectedSessionId && !isReadAccessLost(userSessions.error) && (
            <PlatformRecordModal
              title={t("detailTitle")}
              closeLabel={t("closeDetails")}
              triggerRef={triggerRef}
              onClose={() => setSelectedSessionId("")}
            >
              <div className="p-4">
                {selectedSession.data !== undefined &&
                  !isReadAccessLost(selectedSession.error) &&
                  (selectedSession.isFetching ||
                    selectedSession.isRefetchError) && (
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
                ) : !selectedSession.data ||
                  (selectedSession.isError &&
                    isReadAccessLost(selectedSession.error)) ? (
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
                      value={`${formatPlatformDate(selectedSession.data.createdAt)} · ${formatPlatformDate(selectedSession.data.updatedAt)}`}
                    />
                    <TextField
                      label="Expires"
                      value={formatPlatformDate(selectedSession.data.expiresAt)}
                    />
                  </dl>
                )}
              </div>
            </PlatformRecordModal>
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
