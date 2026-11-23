"use client";

import { useTranslations } from "next-intl";
import Label from "@/components/form/Label";

export default function MemberStatusFilter({
  value,
  disabled,
  onChange,
}: {
  value: "ACTIVE" | "INACTIVE";
  disabled: boolean;
  onChange: (value: "ACTIVE" | "INACTIVE") => void;
}) {
  const t = useTranslations("projectMembers");
  return (
    <div className="w-full sm:w-44">
      <Label
        htmlFor="member-status-filter"
        className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400"
      >
        {t("status")}
      </Label>
      <div className="relative">
        <select
          id="member-status-filter"
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value as "ACTIVE" | "INACTIVE")
          }
          className="h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-xs leading-5 font-medium text-gray-700 shadow-theme-xs transition-colors hover:border-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 sm:text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="ACTIVE">{t("ACTIVE")}</option>
          <option value="INACTIVE">{t("INACTIVE")}</option>
        </select>
      </div>
    </div>
  );
}
