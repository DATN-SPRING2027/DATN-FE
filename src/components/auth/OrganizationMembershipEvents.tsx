"use client";

import { useTranslations } from "next-intl";
import {
  useAccountEventsQuery,
  type NotificationItem,
} from "@/lib/queries/notifications/useNotifications";

function isMembershipEvent(item: NotificationItem): boolean {
  return (
    item.type === "ORGANIZATION_MEMBER_INVITED" ||
    item.type === "ORGANIZATION_MEMBER_REMOVED"
  );
}

export default function OrganizationMembershipEvents({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}) {
  const t = useTranslations("auth");
  const query = useAccountEventsQuery({ userId, enabled });
  const events = (query.data?.items ?? []).filter(isMembershipEvent);

  if (!enabled || (!query.isLoading && !query.isError && events.length === 0)) {
    return null;
  }

  return (
    <section
      aria-labelledby="organization-membership-events-title"
      className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900"
    >
      <h2
        id="organization-membership-events-title"
        className="text-sm font-semibold text-gray-800 dark:text-gray-100"
      >
        {t("onboardingMembershipEventsTitle")}
      </h2>

      {query.isLoading && events.length === 0 && (
        <p role="status" className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          {t("onboardingMembershipEventsLoading")}
        </p>
      )}

      {query.isError && events.length === 0 && (
        <p role="alert" className="mt-2 text-sm text-error-600 dark:text-error-400">
          {t("onboardingMembershipEventsError")}
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="min-w-0 rounded-xl border border-gray-200/80 bg-gray-50/70 px-3.5 py-3 dark:border-gray-800 dark:bg-gray-950/50"
            >
              <p className="break-words text-sm font-semibold text-gray-800 dark:text-gray-100">
                {event.title}
              </p>
              <p className="mt-1 break-words text-sm leading-5 text-gray-700 dark:text-gray-300">
                {event.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
