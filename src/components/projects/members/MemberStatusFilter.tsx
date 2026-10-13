"use client";
import { useTranslations } from "next-intl";

export default function MemberStatusFilter({
  value,
  disabled,
  onChange,
}: {
  value: "" | "ACTIVE" | "INACTIVE";
  disabled: boolean;
  onChange: (value: "" | "ACTIVE" | "INACTIVE") => void;
}) {
  const t = useTranslations("projectMembers");
  return (
    <div
      role="group"
      aria-label={t("status")}
      className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
    >
      {(["", "ACTIVE", "INACTIVE"] as const).map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={value === status}
          disabled={disabled}
          onClick={() => onChange(status)}
          className={`flex-1 cursor-pointer rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 ${value === status ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-700 dark:text-brand-300" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
        >
          {status ? t(status) : t("allShort")}
        </button>
      ))}
    </div>
  );
}
