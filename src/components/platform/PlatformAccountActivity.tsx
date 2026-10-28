"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePlatformAuditEventsQuery } from "@/lib/queries/platform/usePlatformOperations";
import {
  ErrorState,
  Loading,
  QueryRefreshStatus,
  formatPlatformDate,
  isReadAccessLost,
} from "./PlatformOperationsUi";
import PlatformPagination from "./PlatformPagination";
import EmptyState from "./ui/EmptyState";
import styles from "./PlatformAccountDirectory.module.css";

export default function PlatformAccountActivity({
  operatorId,
}: {
  operatorId: string;
}) {
  const t = useTranslations("platformConsole.profile");
  const [page, setPage] = useState(1);
  const activity = usePlatformAuditEventsQuery(
    { page, pageSize: 10, actorUserId: operatorId },
    true,
  );
  const hasData =
    activity.data !== undefined && !isReadAccessLost(activity.error);
  return (
    <>
      <QueryRefreshStatus
        hasData={hasData}
        isFetching={activity.isFetching}
        isRefetchError={activity.isRefetchError}
        onRetry={() => void activity.refetch()}
      />
      {activity.isPending && !activity.data ? (
        <Loading columns={2} />
      ) : activity.isError && !hasData ? (
        <ErrorState retry={() => void activity.refetch()} />
      ) : activity.data?.data.length ? (
        <ol className={styles.permissions}>
          {activity.data.data.map((event) => (
            <li key={event.eventId}>
              <div>
                <strong>{event.action}</strong>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {event.resourceType} · {formatPlatformDate(event.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title={t("noActivity")} />
      )}
      {hasData && activity.data && (
        <PlatformPagination
          alwaysShow
          page={activity.data.pagination.page}
          pageSize={activity.data.pagination.pageSize}
          returnedItems={activity.data.data.length}
          totalItems={activity.data.pagination.totalItems}
          totalPages={activity.data.pagination.totalPages}
          ariaLabel={t("activity")}
          disabled={activity.isFetching}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
