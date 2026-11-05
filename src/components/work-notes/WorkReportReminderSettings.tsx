"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Check } from "lucide-react";
import Button from "@/components/ui/button/Button";
import {
  workNotesApi,
  workNoteKeys,
  useWorkNotesMutation,
  type WorkReportScope,
} from "@/lib/queries/work-notes/useWorkNotes";

const OPTIONS = ["off", "60", "120", "1440", "2880"] as const;

export default function WorkReportReminderSettings({
  projectId,
  scope,
  leadMinutes,
  canConfigure,
  variant = "inline",
}: {
  projectId: string;
  scope: WorkReportScope;
  leadMinutes: number | null;
  canConfigure: boolean;
  variant?: "inline" | "toolbar";
}) {
  const t = useTranslations("aiCompanionNotifications");
  const saved = leadMinutes === null ? "off" : String(leadMinutes);
  const stateKey = `${scope}:${saved}`;
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(
    null,
  );
  const selection = draft?.key === stateKey ? draft.value : saved;
  const setSelection = (value: string) => setDraft({ key: stateKey, value });

  const mutation = useWorkNotesMutation(
    (minutes: number | null) =>
      workNotesApi.updateReportReminder(projectId, minutes, scope),
    [workNoteKeys.settings(projectId, scope)],
  );

  const isDirty = selection !== saved;

  if (variant === "toolbar") {
    if (!canConfigure) {
      return (
        <span
          title={t("settingsHelp")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200/90 bg-gray-50/80 px-2.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
        >
          <Bell className="h-3.5 w-3.5 text-brand-500 dark:text-brand-400" />
          <span>
            {t("leadTime")}: {t(`leadTimes.${saved}`)}
          </span>
        </span>
      );
    }

    return (
      <form
        className="inline-flex flex-wrap items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation
            .mutateAsync(selection === "off" ? null : Number(selection))
            .catch(() => {});
        }}
      >
        <div
          title={t("settingsHelp")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white ps-2.5 pe-1 text-xs shadow-theme-xs transition focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900"
        >
          <Bell className="h-3.5 w-3.5 shrink-0 text-brand-500 dark:text-brand-400" />
          <select
            aria-label={t("leadTime")}
            value={selection}
            disabled={mutation.isPending}
            onChange={(event) => setSelection(event.target.value)}
            className="h-7 cursor-pointer bg-transparent pe-1 text-xs font-medium text-gray-800 outline-none disabled:opacity-50 dark:bg-gray-900 dark:text-gray-100"
          >
            {OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`leadTimes.${value}`)}
              </option>
            ))}
          </select>
        </div>

        {(isDirty || mutation.isPending) && (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{t("save")}</span>
          </button>
        )}

        {mutation.isError && (
          <p
            role="alert"
            className="text-xs font-medium text-error-600 dark:text-error-400"
          >
            {t("saveError")}
          </p>
        )}
        {mutation.isSuccess && !isDirty && (
          <p
            role="status"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Check className="h-3 w-3 stroke-[2.5]" />
            <span>{t("saved")}</span>
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="mt-3 grid gap-3 border-t border-gray-200 pt-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center dark:border-gray-800">
      <div className="max-w-xl min-w-0">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
          {t("settingsTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {t("settingsHelp")}
        </p>
      </div>
      {canConfigure ? (
        <form
          className="flex flex-wrap items-center gap-2 lg:justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            void mutation
              .mutateAsync(selection === "off" ? null : Number(selection))
              .catch(() => {});
          }}
        >
          <label className="inline-flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span>{t("leadTime")}</span>
            <select
              value={selection}
              disabled={mutation.isPending}
              onChange={(event) => setSelection(event.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 pointer-coarse:min-h-11"
            >
              {OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`leadTimes.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            size="sm"
            variant={isDirty ? "primary" : "outline"}
            className="h-8 rounded-lg! px-3! py-1! text-xs! shadow-theme-xs"
            disabled={!isDirty}
            isLoading={mutation.isPending}
          >
            {t("save")}
          </Button>
          {mutation.isError && (
            <p
              role="alert"
              className="w-full text-xs text-error-600 dark:text-error-400"
            >
              {t("saveError")}
            </p>
          )}
          {mutation.isSuccess && (
            <p
              role="status"
              className="text-xs text-success-600 dark:text-success-400"
            >
              {t("saved")}
            </p>
          )}
        </form>
      ) : (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {t("leadTime")}: {t(`leadTimes.${saved}`)}
        </p>
      )}
    </div>
  );
}
