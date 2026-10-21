"use client";
import { useFormatter, useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

function FieldIcon({ kind }: { kind: "user" | "scope" | "status" | "date" }) {
  if (kind === "user") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="h-4 w-4"
      >
        <circle
          cx="8"
          cy="5.5"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M3.25 13.25c0-2.1 2.13-3.5 4.75-3.5s4.75 1.4 4.75 3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "scope") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="h-4 w-4"
      >
        <circle
          cx="6.25"
          cy="5.5"
          r="2.25"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M2.5 12.75c0-1.9 1.68-3.25 3.75-3.25S10 10.85 10 12.75"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M10.75 4.25a2 2 0 0 1 0 3.75M13.5 12.75c0-1.45-1.05-2.65-2.5-3.05"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "status") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="h-4 w-4"
      >
        <circle
          cx="8"
          cy="8"
          r="5.75"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M5.5 8.25l1.75 1.75 3.5-3.75"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4"
    >
      <circle
        cx="8"
        cy="8"
        r="5.75"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 5v3.25l2.25 1.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MemberDetails({
  member,
  isLeader = false,
}: {
  member: ProjectMembership;
  isLeader?: boolean;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  const fields: Array<{
    label: string;
    value: string;
    icon: "user" | "scope" | "status" | "date";
    isDate: boolean;
  }> = [
    ...(member.user?.fullName
      ? [
          {
            label: "userName",
            value: member.user.fullName,
            icon: "user" as const,
            isDate: false,
          },
        ]
      : []),
    ...(member.user?.email
      ? [
          {
            label: "email",
            value: member.user.email,
            icon: "user" as const,
            isDate: false,
          },
        ]
      : []),
    ...(!member.user
      ? [
          {
            label: "userId",
            value: member.userId,
            icon: "user" as const,
            isDate: false,
          },
        ]
      : []),
    {
      label: "accessLevel",
      value: isLeader
        ? `${t("projectLeaderBadge")} · ${t("projectScope")}`
        : t("projectScope"),
      icon: "scope",
      isDate: false,
    },
    {
      label: "statusColumn",
      value: t(member.status),
      icon: "status",
      isDate: false,
    },
    {
      label: "joinedAt",
      value: format.dateTime(new Date(member.joinedAt), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }),
      icon: "date",
      isDate: true,
    },
  ];
  return (
    <section role="region" aria-label={t("memberDetails")} className="min-w-0">
      <ComponentCard
        title={t("basicInformation")}
        className="h-full shadow-theme-xs"
      >
        <dl className="space-y-4">
          {fields.map(({ label, value, icon, isDate }) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <FieldIcon kind={icon} />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {t(label)}
                </dt>
                <dd
                  className={`mt-1 text-xs font-semibold break-all text-gray-800 dark:text-gray-200 ${
                    isDate ? "tabular-nums" : ""
                  }`}
                >
                  {isDate ? (
                    <time dateTime={member.joinedAt}>{value}</time>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </ComponentCard>
    </section>
  );
}
