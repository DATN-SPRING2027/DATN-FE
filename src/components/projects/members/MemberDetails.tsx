"use client";
import { useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import { UserCircleIcon, GroupIcon, FolderIcon, ListIcon } from "@/icons";
import type { ProjectMembership } from "@/lib/queries/projects/useProjectMembers";

export default function MemberDetails({
  member,
}: {
  member: ProjectMembership;
}) {
  const t = useTranslations("projectMembers");
  const fields = [
    ...(member.user?.email
      ? [{ label: "email", value: member.user.email, Icon: UserCircleIcon }]
      : []),
    ...(member.user?.fullName
      ? [
          {
            label: "userName",
            value: member.user.fullName,
            Icon: UserCircleIcon,
          },
        ]
      : []),
    ...(!member.user
      ? [{ label: "userId", value: member.userId, Icon: UserCircleIcon }]
      : []),
    { label: "membershipId", value: member.id, Icon: ListIcon },
    { label: "organizationId", value: member.organizationId, Icon: GroupIcon },
    { label: "projectId", value: member.projectId, Icon: FolderIcon },
  ];
  return (
    <section role="region" aria-label={t("memberDetails")} className="min-w-0">
      <ComponentCard
        title={t("basicInformation")}
        className="h-full shadow-theme-xs"
      >
        <dl className="space-y-5">
          {fields.map(({ label, value, Icon }) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {t(label)}
                </dt>
                <dd className="font-mono mt-1 text-xs font-medium break-all text-gray-800 dark:text-gray-200">
                  {value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </ComponentCard>
    </section>
  );
}
