"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  CalenderIcon,
  LockIcon,
  SettingsIcon,
  TimeIcon,
} from "@/icons";
import {
  REPORT_FREQUENCIES,
  type ReportFrequency,
  type WorkReportScope,
  type WorkReportSettings,
} from "@/lib/queries/work-notes/useWorkNotes";

const FREQUENCIES: readonly ReportFrequency[] = REPORT_FREQUENCIES;

export interface WorkReportCadencePopoverProps {
  activeScope: WorkReportScope;
  actorRole?: "MANAGER" | "LEADER" | "MEMBER";
  settingsData?: WorkReportSettings;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  isRefetchError: boolean;
  accessLost: boolean;
  onRetry: () => void;
  isSaving: boolean;
  saveError: unknown;
  saveSuccess: boolean;
  onApplyFrequency: (frequency: ReportFrequency) => Promise<void>;
}

export default function WorkReportCadencePopover({
  activeScope,
  actorRole,
  settingsData,
  isPending,
  isError,
  error,
  isFetching,
  isRefetchError,
  accessLost,
  onRetry,
  isSaving,
  saveError,
  saveSuccess,
  onApplyFrequency,
}: WorkReportCadencePopoverProps) {
  const t = useTranslations("workNotes.reports");
  const common = useTranslations("workNotes");
  const format = useFormatter();

  const [isOpen, setIsOpen] = useState(false);
  const [frequency, setFrequency] = useState<ReportFrequency | null>(null);
  const [isConfirmingSchedule, setIsConfirmingSchedule] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  useClickOutside(containerRef, closePopover);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const activeFrequency = settingsData?.frequency ?? "WEEKLY";
  const selectedFrequency = frequency ?? activeFrequency;
  const canConfigure = Boolean(settingsData?.permissions.canConfigure);

  function prepareScheduleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsConfirmingSchedule(true);
  }

  async function handleConfirmSchedule() {
    if (!frequency) return;
    try {
      await onApplyFrequency(frequency);
      setFrequency(null);
      setIsConfirmingSchedule(false);
    } catch {
      // Keep selection open for retry if request fails.
    }
  }

  if (isPending && !settingsData) {
    return (
      <span
        role="status"
        className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
      >
        {common("loading")}
      </span>
    );
  }

  if (isError && !settingsData) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-xs text-error-700 dark:text-error-300"
      >
        <span>
          {error instanceof Error ? error.message : t("permissionDenied")}
        </span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {common("retry")}
        </Button>
      </div>
    );
  }

  const popoverHeading =
    activeScope === "LEADER" && actorRole === "MANAGER"
      ? t("leaderScheduleSettingsTitle")
      : t("settingsTitle");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
          isOpen
            ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-300"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        }`}
      >
        {canConfigure ? (
          <SettingsIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
        ) : (
          <LockIcon className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
        )}
        <span className="tabular-nums">
          {t("cadenceButtonLabel", { days: t(`daysShort.${activeFrequency}`) })}
        </span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={popoverHeading}
          className="absolute end-0 top-10 z-99 w-80 max-w-xs rounded-xl border border-gray-200 bg-white p-3.5 shadow-theme-lg sm:max-w-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex items-start justify-between gap-2 pb-2.5">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white/90">
              {popoverHeading}
            </h3>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              {t("notificationLinkedBadge")}
            </span>
          </div>

          {canConfigure && settingsData ? (
            <div className="space-y-2.5">
              <form onSubmit={prepareScheduleChange} className="space-y-2">
                <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <CalenderIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>{t("frequency")}</span>
                  </span>
                  <select
                    aria-label={t("frequency")}
                    value={selectedFrequency}
                    onChange={(event) => {
                      const next = event.target.value as ReportFrequency;
                      setFrequency(
                        next === settingsData.frequency ? null : next,
                      );
                      setIsConfirmingSchedule(false);
                    }}
                    className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-800 outline-none transition hover:border-gray-300 focus:border-brand-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {FREQUENCIES.map((value) => (
                      <option key={value} value={value}>
                        {t(value)} ({t(`daysShort.${value}`)})
                      </option>
                    ))}
                  </select>
                </label>

                {frequency &&
                  frequency !== settingsData.frequency &&
                  !isConfirmingSchedule && (
                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setFrequency(null);
                          setIsConfirmingSchedule(false);
                        }}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        {common("cancel")}
                      </button>
                      <Button type="submit" size="sm" isLoading={isSaving}>
                        {t("saveFrequency")}
                      </Button>
                    </div>
                  )}
              </form>

              {isConfirmingSchedule && frequency && (
                <div
                  role="group"
                  aria-label={t("scheduleConfirmationTitle")}
                  className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/70 p-2.5 dark:border-brand-500/30 dark:bg-brand-500/10"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white/90">
                      {t("scheduleConfirmationTitle")}
                    </h4>
                    <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-300">
                      {t("scheduleConfirmation", { frequency: t(frequency) })}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsConfirmingSchedule(false);
                        setFrequency(null);
                      }}
                    >
                      {common("cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      isLoading={isSaving}
                      onClick={() => void handleConfirmSchedule()}
                    >
                      {t("confirmScheduleChange")}
                    </Button>
                  </div>
                </div>
              )}

              {settingsData.nextEffectiveAt && (
                <p className="rounded-lg bg-brand-50/60 px-2.5 py-1.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  {t("scheduledChange", {
                    date: format.dateTime(
                      new Date(settingsData.nextEffectiveAt),
                      {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      },
                    ),
                  })}
                </p>
              )}
            </div>
          ) : settingsData ? (
            <div className="space-y-1.5 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/70">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                <LockIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>
                  {activeScope === "LEADER"
                    ? t("mandatoryLeaderScheduleLabel")
                    : t("mandatoryScheduleLabel")}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                <CalenderIcon className="h-3.5 w-3.5" />
                <span>{t(`daysFull.${settingsData.frequency}`)}</span>
              </div>
            </div>
          ) : null}

          {(Boolean(saveError) || saveSuccess) && (
            <div className="mt-2.5 border-t border-gray-100 pt-2 dark:border-gray-800">
              {Boolean(saveError) && (
                <p
                  role="alert"
                  className="text-xs text-error-600 dark:text-error-400"
                >
                  {saveError instanceof Error
                    ? saveError.message
                    : t("permissionDenied")}
                </p>
              )}
              {saveSuccess && (
                <p
                  role="status"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
                >
                  {t("frequencySaved")}
                </p>
              )}
            </div>
          )}

          {settingsData !== undefined &&
            !accessLost &&
            (isFetching || isRefetchError) && (
              <div className="mt-2.5 border-t border-gray-100 pt-2 dark:border-gray-800">
                {isFetching && (
                  <UpdatingStatus>{common("loading")}</UpdatingStatus>
                )}
                {isRefetchError && (
                  <BackgroundRefreshError
                    retryLabel={common("retry")}
                    onRetry={onRetry}
                  >
                    {common("updateFailed")}
                  </BackgroundRefreshError>
                )}
              </div>
            )}

          {settingsData?.history.length ? (
            <div className="mt-3 border-t border-gray-100 pt-2.5 dark:border-gray-800">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <TimeIcon className="h-3 w-3 shrink-0" />
                <span>
                  {t("scheduleHistory")} ({settingsData.history.length})
                </span>
              </div>
              <ol className="max-h-32 space-y-1 overflow-y-auto">
                {settingsData.history.map((entry, idx) => (
                  <li
                    key={`${entry.effectiveAt}-${entry.frequency}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800/70 dark:text-gray-400"
                  >
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {t(entry.frequency)} ({t(`daysShort.${entry.frequency}`)})
                    </span>
                    <time className="tabular-nums">
                      {format.dateTime(new Date(entry.effectiveAt), {
                        dateStyle: "short",
                        timeZone: "UTC",
                      })}
                    </time>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
