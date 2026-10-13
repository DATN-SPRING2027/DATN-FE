"use client";
import { useTranslations } from "next-intl";
import ComponentCard from "@/components/common/ComponentCard";
import { CheckCircleIcon, LockIcon, UserCircleIcon } from "@/icons";

export default function MemberSafeguards() {
  const t = useTranslations("projectMembers");
  return (
    <ComponentCard title={t("safeguards")} className="h-full shadow-theme-xs">
      <ul className="space-y-3">
        {[
          { key: "scopeSafeguard", Icon: LockIcon },
          { key: "memberSafeguard", Icon: UserCircleIcon },
          { key: "historySafeguard", Icon: CheckCircleIcon },
        ].map(({ key, Icon }) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
          >
            <Icon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-brand-500 dark:text-brand-400"
            />
            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t(key)}
            </p>
          </li>
        ))}
      </ul>
    </ComponentCard>
  );
}
