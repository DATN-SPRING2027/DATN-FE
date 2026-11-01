"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { type WorkReport } from "@/lib/queries/work-notes/useWorkNotes";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
} from "@/lib/queries/notifications/useNotifications";

/** Server-persisted reminders also appear after returning to the app. */
export default function WorkReportReminderNotice({
  visible,
}: {
  visible: boolean;
}) {
  const t = useTranslations("aiCompanionNotifications");
  const format = useFormatter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const user = useCurrentUserQuery();
  const authenticated =
    Boolean(user.data?.id) && !isAccessOrResourceUnavailableError(user.error);
  const query = useNotificationsQuery({
    unreadOnly: true,
    limit: 100,
    enabled: authenticated,
  });
  const read = useMarkNotificationReadMutation();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const candidates =
    authenticated && !query.isError
      ? (query.data?.items.filter(
          (item) =>
            item.recipientId === user.data?.id &&
            item.type === "WORK_REPORT_DEADLINE_APPROACHING" &&
            !item.readAt &&
            !dismissed.includes(item.id) &&
            item.target?.projectId &&
            item.target.reportId &&
            item.target.url ===
              `/projects/${item.target.projectId}/work-reports` &&
            item.organizationId === user.data?.organizationId,
        ) ?? [])
      : [];
  const eligible = useQuery({
    queryKey: [
      "work-notes",
      "companion-reminders",
      user.data?.id,
      user.data?.organizationId,
      candidates.map((item) => item.id),
    ],
    queryFn: async ({ signal }) => {
      // Skip stale reminders so a submitted report cannot hide another project's deadline.
      for (const item of candidates) {
        const projectId = item.target!.projectId!;
        const reportId = item.target!.reportId!;
        try {
          const report = await apiClient<WorkReport>(
            `/capture/projects/${encodeURIComponent(projectId)}/work-reports/${encodeURIComponent(reportId)}`,
            { signal, cache: "no-store" },
          );
          if (
            ["DRAFT", "CHANGES_REQUESTED"].includes(report.status) &&
            Date.parse(report.dueAt) > now
          ) {
            return { reminder: item, report };
          }
        } catch {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          // Access denial, deleted reports and network errors never expose cached content.
        }
      }
      return null;
    },
    enabled: visible && candidates.length > 0,
    refetchInterval: 30_000,
    retry: false,
  });
  const reminder = eligible.data?.reminder;
  const report = eligible.data?.report;
  if (
    !visible ||
    !authenticated ||
    eligible.isError ||
    query.isError ||
    !reminder?.target?.projectId ||
    !report ||
    !candidates.some((item) => item.id === reminder.id) ||
    Date.parse(report.dueAt) <= now
  )
    return null;
  return (
    <aside
      role="status"
      aria-live="polite"
      data-no-drag="true"
      className="mb-3 w-72 max-w-full rounded-2xl border border-brand-200 bg-white p-3 text-sm text-gray-800 shadow-theme-md dark:border-brand-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold">{t("reminderTitle")}</p>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={() => {
            setDismissed((previous) => [...previous, reminder.id]);
            read.mutate(reminder.id);
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed break-words text-gray-600 dark:text-gray-300">
        {t("reminderBody", {
          remaining: format.relativeTime(new Date(report.dueAt), new Date(now)),
        })}
      </p>
      <Link
        href={`/projects/${encodeURIComponent(reminder.target.projectId)}/work-reports`}
        className="mt-2 inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-brand-600 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
      >
        {t("openReport")}
      </Link>
    </aside>
  );
}
