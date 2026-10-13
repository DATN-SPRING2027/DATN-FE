"use client";

import { useTranslations } from "next-intl";
import Label from "@/components/form/Label";
import { ChevronDownIcon } from "@/icons";

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
      <Label htmlFor="member-status-filter">{t("status")}</Label>
      <div className="relative">
        <select
          id="member-status-filter"
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value as "ACTIVE" | "INACTIVE")
          }
          className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-4 pe-10 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="ACTIVE">{t("ACTIVE")}</option>
          <option value="INACTIVE">{t("INACTIVE")}</option>
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-3.5 size-4 text-gray-500"
        />
      </div>
    </div>
  );
}
