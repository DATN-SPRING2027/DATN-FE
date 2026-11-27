"use client";
import { useFormatter, useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import {
  CheckCircleIcon,
  TimeIcon,
  UserIcon,
  UsersOutlineIcon,
} from "@/icons";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export type LeaderRoleStatus = "ready" | "loading" | "unavailable";

function FieldIcon({ kind }: { kind: "user" | "scope" | "status" | "date" }) {
  if (kind === "user") {
    return <UserIcon aria-hidden="true" className="h-4 w-4" />;
  }
  if (kind === "scope") {
    return <UsersOutlineIcon aria-hidden="true" className="h-4 w-4" />;
  }
  if (kind === "status") {
    return <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />;
  }
  return <TimeIcon aria-hidden="true" className="h-4 w-4" />;
}

export default function MemberDetails({
  member,
  isLeader = false,
  leaderRoleStatus = "ready",
}: {
  member: ProjectMembership;
  isLeader?: boolean;
  leaderRoleStatus?: LeaderRoleStatus;
}) {
  const t = useTranslations("projectMembers");
  const format = useFormatter();
  const accessLevelValue =
    leaderRoleStatus === "loading"
      ? `${t("leaderRoleLoading")} · ${t("projectScope")}`
      : leaderRoleStatus === "unavailable"
        ? `${t("leaderRoleUnavailable")} · ${t("projectScope")}`
        : isLeader
          ? `${t("projectLeaderBadge")} · ${t("projectScope")}`
          : t("projectScope");

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
      value: accessLevelValue,
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
