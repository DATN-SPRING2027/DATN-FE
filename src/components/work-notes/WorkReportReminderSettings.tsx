"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
}: {
  projectId: string;
  scope: WorkReportScope;
  leadMinutes: number | null;
  canConfigure: boolean;
}) {
  const t = useTranslations("aiCompanionNotifications");
  const [selection, setSelection] = useState(
    leadMinutes === null ? "off" : String(leadMinutes),
  );
  const saved = leadMinutes === null ? "off" : String(leadMinutes);
  const mutation = useWorkNotesMutation(
    (minutes: number | null) =>
      workNotesApi.updateReportReminder(projectId, minutes, scope),
    [workNoteKeys.settings(projectId, scope)],
  );
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
              className="h-8 rounded-sm border border-gray-300 bg-white px-2 text-xs text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 pointer-coarse:min-h-11"
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
            variant="outline"
            className="h-8 rounded-sm! px-3! py-1! text-xs! shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 pointer-coarse:min-h-11"
            disabled={selection === saved}
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
