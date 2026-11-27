"use client";

import type { FormEvent, RefObject } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import {
  ANIMATE_UI_BUTTON_SPRING,
  useHydratedReducedMotion,
} from "@/components/ui/button/buttonMotion";
import { CloseLineIcon, SearchIcon } from "@/icons";
import type { McpKeyScopeMode } from "@/lib/queries/mcp-keys/mcp-keys.types";
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";

export type ExpirationPreset = "30" | "90" | "365" | "never";

interface CreateMcpKeySheetProps {
  dialogRef: RefObject<HTMLDivElement | null>;
  keyNameInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
  formValidationError: string | null;
  mutationErrorMessage: string | null;
  keyName: string;
  onKeyNameChange: (value: string) => void;
  selectedScope: McpKeyScopeMode;
  onSelectScope: (scope: McpKeyScopeMode) => void;
  projectPartitionMode: "all" | "selected";
  onProjectPartitionModeChange: (mode: "all" | "selected") => void;
  selectedProjectIds: readonly string[];
  activeProjects: readonly Project[];
  filteredModalProjects: readonly Project[];
  projectsLoading: boolean;
  projectsError: boolean;
  onRetryProjects: () => void;
  projectSearchQuery: string;
  onProjectSearchChange: (value: string) => void;
  onSelectAllFilteredProjects: () => void;
  onClearSelectedProjects: () => void;
  onToggleProjectId: (projectId: string) => void;
  expirationPreset: ExpirationPreset;
  onExpirationPresetChange: (preset: ExpirationPreset) => void;
}

/**
 * Right-docked HIG inspector sheet for minting personal Streamable HTTP MCP keys.
 * Preserves keyboard focus trap ordering: close button first, submit CTA last.
 */
export default function CreateMcpKeySheet({
  dialogRef,
  keyNameInputRef,
  onClose,
  onSubmit,
  isPending,
  formValidationError,
  mutationErrorMessage,
  keyName,
  onKeyNameChange,
  selectedScope,
  onSelectScope,
  projectPartitionMode,
  onProjectPartitionModeChange,
  selectedProjectIds,
  activeProjects,
  filteredModalProjects,
  projectsLoading,
  projectsError,
  onRetryProjects,
  projectSearchQuery,
  onProjectSearchChange,
  onSelectAllFilteredProjects,
  onClearSelectedProjects,
  onToggleProjectId,
  expirationPreset,
  onExpirationPresetChange,
}: CreateMcpKeySheetProps) {
  const t = useTranslations("organizationIntegrations");
  const shouldReduceMotion = useHydratedReducedMotion();

  const scopeTiers = [
    {
      value: "FULL_OPERATIONS" as const,
      title: t("scopeFullOpsTitle"),
      desc: t("scopeFullOpsDesc"),
      toolBadge: t("tierToolCountFull"),
      code: "FULL_OPERATIONS",
      level: 3,
      count: 36,
    },
    {
      value: "READ_WRITE" as const,
      title: t("scopeReadWriteTitle"),
      desc: t("scopeReadWriteDesc"),
      toolBadge: t("tierToolCountReadWrite"),
      code: "READ_WRITE",
      level: 2,
      count: 26,
    },
    {
      value: "READ_ONLY" as const,
      title: t("scopeReadOnlyTitle"),
      desc: t("scopeReadOnlyDesc"),
      toolBadge: t("tierToolCountReadOnly"),
      code: "READ_ONLY",
      level: 1,
      count: 20,
    },
  ] as const;

  const activeTierMeta =
    scopeTiers.find((tier) => tier.value === selectedScope) ?? scopeTiers[0];

  const expirationOptions: ReadonlyArray<{
    value: ExpirationPreset;
    label: string;
    recommended?: boolean;
  }> = [
    { value: "30", label: t("exp30Days") },
    { value: "90", label: t("exp90DaysShort"), recommended: true },
    { value: "365", label: t("exp365Days") },
    { value: "never", label: t("expNeverShort") },
  ];

  const expiryShort =
    expirationOptions.find((option) => option.value === expirationPreset)
      ?.label ?? t("exp90DaysShort");

  const expiryNote =
    expirationPreset === "90"
      ? t("expRecommendedNote")
      : expirationPreset === "never"
        ? t("expNeverNote")
        : t("expFixedNote", { days: expirationPreset });

  const projectSummaryLabel =
    projectPartitionMode === "all"
      ? t("allProjectsBadge")
      : t("restrictedProjectsBadge", { count: selectedProjectIds.length });

  const trimmedLabel = keyName.trim();

  return (
    <div
      data-testid="mcp-create-modal-backdrop"
      onClick={onClose}
      className="continuum-backdrop-enter fixed inset-0 z-99999 flex items-end justify-center bg-gray-950/35 backdrop-blur-[2px] sm:items-stretch sm:justify-end dark:bg-gray-950/60"
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-mcp-key-dialog-title"
        aria-describedby="create-mcp-key-dialog-desc"
        onClick={(event) => event.stopPropagation()}
        initial={shouldReduceMotion ? false : { x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-gray-200/90 bg-white shadow-[-16px_0_48px_-12px_rgba(16,24,40,0.12)] sm:h-dvh sm:max-h-dvh sm:w-[min(540px,100vw)] sm:rounded-none sm:border-t-0 sm:border-s dark:border-gray-800 dark:bg-gray-900 dark:shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.45)]"
      >
        {/* Sheet Header — close button remains the FIRST focusable dialog element */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200/80 px-6 py-3.5 dark:border-gray-800">
          <div className="min-w-0">
            <h2
              id="create-mcp-key-dialog-title"
              className="text-base font-semibold tracking-tight text-balance text-gray-950 sm:text-lg dark:text-white"
            >
              {t("createModalTitle")}
            </h2>
            <p
              id="create-mcp-key-dialog-desc"
              className="mt-0.5 text-xs leading-5 text-pretty text-gray-500 dark:text-gray-400"
            >
              {t("createModalSubtitle")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("closeModalAria")}
            disabled={isPending}
            onClick={onClose}
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <CloseLineIcon className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Live Credential Blueprint Bar */}
        <div
          data-testid="mcp-key-live-preview"
          aria-label={t("keyPreviewLabel")}
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200/80 bg-gray-50/75 px-6 py-2 dark:border-gray-800 dark:bg-gray-950/70"
        >
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-success-500"
            />
            <span className="shrink-0 text-gray-700 dark:text-gray-300">
              ctm_mcp_••••••••
            </span>
            <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">
              /
            </span>
            <span
              className={cn(
                "truncate",
                trimmedLabel
                  ? "font-medium text-gray-950 dark:text-white"
                  : "text-gray-400 italic dark:text-gray-500",
              )}
            >
              {trimmedLabel || t("keyNamePlaceholder")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
            <span>{activeTierMeta.count}/36</span>
            <span aria-hidden="true">·</span>
            <span>{projectSummaryLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{expiryShort}</span>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          noValidate
        >
          <div className="custom-scrollbar-modal min-h-0 flex-1 divide-y divide-gray-200/80 overflow-y-auto overscroll-contain px-6 dark:divide-gray-800/80">
            {(formValidationError || mutationErrorMessage) && (
              <div className="space-y-3 py-4">
                {formValidationError && (
                  <div role="alert">
                    <Alert
                      variant="warning"
                      title={t("errorTitle")}
                      message={formValidationError}
                    />
                  </div>
                )}

                {mutationErrorMessage && (
                  <div role="alert">
                    <Alert
                      variant="error"
                      title={t("errorTitle")}
                      message={mutationErrorMessage}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 1. Key Identity */}
            <div className="py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label htmlFor="mcp-key-name-input" className="mb-0">
                  {t("keyNameLabel")}
                </Label>
                <span className="font-mono text-xs text-gray-400 tabular-nums dark:text-gray-500">
                  {trimmedLabel.length}/80
                </span>
              </div>
              <input
                ref={keyNameInputRef}
                id="mcp-key-name-input"
                type="text"
                maxLength={80}
                required
                value={keyName}
                disabled={isPending}
                onChange={(event) => onKeyNameChange(event.target.value)}
                placeholder={t("keyNamePlaceholder")}
                className="h-9.5 w-full rounded-lg border border-gray-300/90 bg-white px-3.5 py-1.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-brand-400 dark:focus:ring-brand-400/20"
              />
              <p className="mt-1 text-xs text-pretty text-gray-500 dark:text-gray-400">
                {t("keyNameHelp")}
              </p>
            </div>

            {/* 2. Capability Scope — Hairline Radio List (no card soup) */}
            <fieldset className="py-3">
              <legend className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("scopeLabel")}
              </legend>
              <div className="divide-y divide-gray-200/80 overflow-hidden rounded-lg border border-gray-200/90 dark:divide-gray-800 dark:border-gray-800">
                {scopeTiers.map((tier) => {
                  const active = selectedScope === tier.value;
                  return (
                    <button
                      key={tier.value}
                      type="button"
                      aria-pressed={active}
                      disabled={isPending}
                      onClick={() => onSelectScope(tier.value)}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 border-s-2 px-3.5 py-2.5 text-start transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500",
                        active
                          ? "border-s-gray-900 bg-gray-50/90 dark:border-s-brand-400 dark:bg-gray-800/45"
                          : "border-s-transparent bg-white hover:bg-gray-50/55 dark:bg-gray-950/60 dark:hover:bg-gray-900",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                          active
                            ? "border-gray-900 dark:border-brand-400"
                            : "border-gray-300 dark:border-gray-600",
                        )}
                      >
                        {active && (
                          <span className="size-2 rounded-full bg-gray-900 dark:bg-brand-400" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="text-sm font-semibold text-gray-950 dark:text-white">
                              {tier.title}
                            </span>
                            <code className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                              {tier.code}
                            </code>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
                              {tier.toolBadge}
                            </span>
                            <span
                              aria-hidden="true"
                              className="flex items-center gap-0.5"
                            >
                              {[1, 2, 3].map((step) => (
                                <span
                                  key={step}
                                  className={cn(
                                    "h-1.5 w-2.5 rounded-xs",
                                    step <= tier.level
                                      ? active
                                        ? "bg-gray-900 dark:bg-brand-400"
                                        : "bg-gray-400 dark:bg-gray-500"
                                      : "bg-gray-200 dark:bg-gray-800",
                                  )}
                                />
                              ))}
                            </span>
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-xs leading-4.5",
                            active
                              ? "text-gray-600 dark:text-gray-300"
                              : "text-gray-500 dark:text-gray-400",
                          )}
                        >
                          {tier.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 3. Project Access — 2-Segment HIG Control + Progressive Checklist */}
            <fieldset className="py-3">
              <legend className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("projectScopeLabel")}
              </legend>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200/80 bg-gray-100/85 p-1 dark:border-gray-800 dark:bg-gray-950/90">
                {(
                  [
                    {
                      id: "all" as const,
                      label: t("allProjectsOption"),
                      badge: null,
                    },
                    {
                      id: "selected" as const,
                      label: t("selectedProjectsOption"),
                      badge:
                        selectedProjectIds.length > 0
                          ? t("selectedProjectsCount", {
                              count: selectedProjectIds.length,
                            })
                          : null,
                    },
                  ] as const
                ).map((option) => {
                  const active = projectPartitionMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      disabled={isPending}
                      onClick={() => onProjectPartitionModeChange(option.id)}
                      className={cn(
                        "relative flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-center text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                        active
                          ? "text-gray-950 dark:text-white"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                      )}
                    >
                      {active &&
                        (shouldReduceMotion ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-md bg-white shadow-xs ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700"
                          />
                        ) : (
                          <motion.span
                            layoutId="mcp-create-project-mode-pill"
                            transition={ANIMATE_UI_BUTTON_SPRING}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-md bg-white shadow-xs ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700"
                          />
                        ))}
                      <span className="relative z-10 truncate">
                        {option.label}
                      </span>
                      {option.badge && (
                        <span className="relative z-10 shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          {option.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-1.5 text-xs text-pretty text-gray-500 dark:text-gray-400">
                {projectPartitionMode === "all"
                  ? t("allProjectsDesc")
                  : t("selectedProjectsDesc")}
              </p>

              {projectPartitionMode === "selected" && (
                <div className="mt-3 rounded-lg border border-gray-200/90 bg-gray-50/55 p-2.5 dark:border-gray-800 dark:bg-gray-950/60">
                  {projectsLoading ? (
                    <p className="px-2 py-2 text-xs text-gray-500">
                      {t("projectsLoading")}
                    </p>
                  ) : projectsError ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 text-xs">
                      <span className="text-error-700 dark:text-error-300">
                        {t("projectsLoadError")}
                      </span>
                      <button
                        type="button"
                        onClick={onRetryProjects}
                        className="cursor-pointer rounded-md bg-white px-2.5 py-1 font-semibold text-gray-700 ring-1 ring-gray-200 ring-inset hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"
                      >
                        {t("retry")}
                      </button>
                    </div>
                  ) : activeProjects.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-gray-500">
                      {t("projectsEmpty")}
                    </p>
                  ) : (
                    <>
                      {activeProjects.length > 6 && (
                        <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-gray-200/80 pb-2 dark:border-gray-800">
                          <div className="relative min-w-0 flex-1">
                            <SearchIcon
                              aria-hidden="true"
                              className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
                            />
                            <input
                              type="search"
                              value={projectSearchQuery}
                              onChange={(event) =>
                                onProjectSearchChange(event.target.value)
                              }
                              placeholder={t("searchProjectsPlaceholder")}
                              aria-label={t("searchProjectsPlaceholder")}
                              className="h-8 w-full rounded-md border border-gray-200 bg-white ps-8 pe-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-brand-400"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={onSelectAllFilteredProjects}
                            className="cursor-pointer rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 ring-inset hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"
                          >
                            {t("selectAllProjects")}
                          </button>
                          <button
                            type="button"
                            onClick={onClearSelectedProjects}
                            className="cursor-pointer rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 ring-inset hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
                          >
                            {t("clearSelectedProjects")}
                          </button>
                        </div>
                      )}

                      <ul className="custom-scrollbar-modal max-h-44 space-y-1 overflow-y-auto pe-1">
                        {filteredModalProjects.map((proj) => {
                          const checked = selectedProjectIds.includes(proj.id);
                          return (
                            <li key={proj.id}>
                              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs hover:bg-white dark:hover:bg-gray-900">
                                <span className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onToggleProjectId(proj.id)}
                                    className="size-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                  />
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {proj.name}
                                  </span>
                                </span>
                                <code className="rounded bg-gray-200/70 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  {proj.code}
                                </code>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </fieldset>

            {/* 4. Expiration Policy — 4-Segment HIG Control (replaces raw <select>) */}
            <fieldset className="py-3">
              <legend className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("expirationLabel")}
              </legend>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200/80 bg-gray-100/85 p-1 sm:grid-cols-4 dark:border-gray-800 dark:bg-gray-950/90">
                {expirationOptions.map((option) => {
                  const active = expirationPreset === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      disabled={isPending}
                      onClick={() => onExpirationPresetChange(option.value)}
                      className={cn(
                        "relative flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                        active
                          ? "text-gray-950 dark:text-white"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                      )}
                    >
                      {active &&
                        (shouldReduceMotion ? (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-md bg-white shadow-xs ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700"
                          />
                        ) : (
                          <motion.span
                            layoutId="mcp-create-expiry-pill"
                            transition={ANIMATE_UI_BUTTON_SPRING}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-md bg-white shadow-xs ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700"
                          />
                        ))}
                      <span className="relative z-10 truncate">
                        {option.label}
                      </span>
                      {option.recommended && (
                        <span
                          aria-hidden="true"
                          className="relative z-10 size-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-pretty text-gray-500 dark:text-gray-400">
                {expiryNote}
              </p>
            </fieldset>
          </div>

          {/* Sticky Footer — submit CTA remains the LAST focusable dialog element */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200/80 bg-white px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900">
            <div
              aria-hidden="true"
              className="hidden items-center gap-1.5 text-[11px] text-gray-400 sm:inline-flex dark:text-gray-500"
            >
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Esc
              </kbd>
              <span>{t("escHint")}</span>
            </div>

            <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={onClose}
              >
                {t("cancelCta")}
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? t("mintingKey") : t("mintKeySubmit")}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
