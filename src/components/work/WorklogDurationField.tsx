"use client";

import { useTranslations } from "next-intl";

const QUICK_DURATIONS = ["15m", "30m", "1h", "2h", "4h", "8h"] as const;

export default function WorklogDurationField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const t = useTranslations("work");
  const selectedDuration = QUICK_DURATIONS.find((duration) => duration === value) ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t("worklogQuickDuration")}
        value={selectedDuration}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
      >
        <option value="">{t("worklogQuickDuration")}</option>
        {QUICK_DURATIONS.map((duration) => (
          <option key={duration} value={duration}>
            {duration}
          </option>
        ))}
      </select>
      <input
        id={id}
        aria-label={t("worklogDurationLabel")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("worklogDurationPlaceholder")}
        className="h-8 w-40 border border-gray-200 bg-white px-2.5 text-xs tabular-nums text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="w-full text-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </div>
  );
}
