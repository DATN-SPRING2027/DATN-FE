"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpenIcon,
  CalenderIcon,
  ChatIcon,
  CheckLineIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CloseIcon,
  MindMapIcon,
  PencilIcon,
  TaskIcon,
} from "@/icons";
import UserAvatar from "@/components/common/UserAvatar";
import { Modal } from "@/components/ui/modal";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useTokenUsageQuery,
  type AiTokenUsageScope,
  type AiTokenUsageTaskKind,
} from "@/lib/queries/token-usage/useTokenUsage";
import { cn } from "@/utils";
import TokenUsageChart, { type ChartGroupMode } from "./TokenUsageChart";
import TokenUsageHeatmap from "./TokenUsageHeatmap";
import TokenUsageSpanPicker from "./TokenUsageSpanPicker";
import {
  addDays,
  aggregateTokenUsage,
  formatCompactTokens,
  formatSharePercent,
  RANGE_PRESETS,
  startOfDay,
  TASK_COLOR_MAP,
  type DateSpan,
  type FocusFilter,
  type TimeRangeId,
} from "./token-usage-data";
import { useTokenUsageModalStore } from "./token-usage.store";
import { useGlide, useTween } from "./useTokenUsageSpring";

const TASK_ICON_MAP: Readonly<
  Record<AiTokenUsageTaskKind, ComponentType<{ className?: string }>>
> = {
  ai_chat: ChatIcon,
  mind_map: MindMapIcon,
  knowledge_sync: BookOpenIcon,
  note_assessment: TaskIcon,
  note_rewrite: PencilIcon,
};

function AnimatedCounter({
  value,
  compact = true,
  suffix,
}: {
  value: number;
  compact?: boolean;
  suffix?: string;
}) {
  const tweened = useTween(value);
  const formatted = compact
    ? formatCompactTokens(tweened)
    : Math.round(tweened).toLocaleString();
  return (
    <span>
      {formatted}
      {suffix ?? ""}
    </span>
  );
}

export default function TokenUsageModal() {
  const { isOpen, initialScope, initialProjectId, closeModal } =
    useTokenUsageModalStore();
  if (!isOpen) return null;
  return (
    <TokenUsageModalContent
      initialScope={initialScope}
      initialProjectId={initialProjectId}
      closeModal={closeModal}
    />
  );
}

function TokenUsageModalContent({
  initialScope,
  initialProjectId,
  closeModal,
}: {
  readonly initialScope?: AiTokenUsageScope;
  readonly initialProjectId?: string | null;
  readonly closeModal: () => void;
}) {
  const t = useTranslations("TokenUsage");
  const locale = useLocale();

  const currentUserQuery = useCurrentUserQuery();
  const organizationId = currentUserQuery.data?.organizationId ?? "";

  const [scope, setScope] = useState<AiTokenUsageScope | undefined>(
    initialScope,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId ?? null,
  );
  const [rangeId, setRangeId] = useState<TimeRangeId>("7d");
  const [customSpan, setCustomSpan] = useState<DateSpan | null>(() => {
    const today = startOfDay(new Date());
    return { from: addDays(today, -13), to: today };
  });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [chartMode, setChartMode] = useState<ChartGroupMode>("owner");
  const [focus, setFocus] = useState<FocusFilter>(() =>
    (!initialScope || initialScope === "personal") &&
    initialProjectId &&
    initialProjectId !== "all"
      ? { kind: "owner", id: initialProjectId }
      : null,
  );
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isProjectMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(e.target as Node)
      ) {
        setIsProjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isProjectMenuOpen]);

  const usageQuery = useTokenUsageQuery(organizationId, {
    scope,
    projectId: selectedProjectId,
    enabled: Boolean(organizationId),
  });

  const responseData = usageQuery.data;
  const effectiveScope = responseData?.effectiveScope ?? scope ?? "personal";
  const availableScopes = responseData?.availableScopes ?? ["personal"];
  const ownerGroupKind = responseData?.ownerGroupKind ?? "project";
  const projects = useMemo(
    () => responseData?.projects ?? [],
    [responseData?.projects],
  );

  const aggregated = useMemo(
    () =>
      aggregateTokenUsage(
        responseData,
        rangeId,
        customSpan,
        focus,
        locale,
      ),
    [responseData, rangeId, customSpan, focus, locale],
  );

  const { containerRef: rangeContainerRef, thumbRef: rangeThumbRef } =
    useGlide<HTMLDivElement>(rangeId);
  const { containerRef: scopeContainerRef, thumbRef: scopeThumbRef } =
    useGlide<HTMLDivElement>(effectiveScope);

  const taskNames: Readonly<Record<AiTokenUsageTaskKind, string>> = useMemo(
    () => ({
      ai_chat: t("tasks.ai_chat"),
      mind_map: t("tasks.mind_map"),
      knowledge_sync: t("tasks.knowledge_sync"),
      note_assessment: t("tasks.note_assessment"),
      note_rewrite: t("tasks.note_rewrite"),
    }),
    [t],
  );

  const shortDayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  const rangeTitleLabel = useMemo(() => {
    if (rangeId === "custom" && customSpan) {
      return `${shortDayFmt.format(customSpan.from)} – ${shortDayFmt.format(customSpan.to)}`;
    }
    switch (rangeId) {
      case "24h":
        return t("ranges.last24h");
      case "7d":
        return t("ranges.last7d");
      case "30d":
        return t("ranges.last30d");
      case "12w":
        return t("ranges.last12w");
      case "12m":
        return t("ranges.last12m");
      default:
        return t("ranges.last7d");
    }
  }, [customSpan, rangeId, shortDayFmt, t]);

  const unitLabel = useMemo(() => {
    switch (aggregated.unit) {
      case "hour":
        return t("units.perHour");
      case "day":
        return t("units.perDay");
      case "week":
        return t("units.perWeek");
      case "month":
        return t("units.perMonth");
    }
  }, [aggregated.unit, t]);

  const focusedMeta = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === "owner") {
      const unFocusedAgg = aggregateTokenUsage(
        responseData,
        rangeId,
        customSpan,
        null,
        locale,
      );
      const item = unFocusedAgg.ownersList.find((o) => o.id === focus.id);
      if (!item) return null;
      return {
        kind: "owner" as const,
        title: item.name,
        color: item.color,
        share: item.share,
      };
    }
    const unFocusedAgg = aggregateTokenUsage(
      responseData,
      rangeId,
      customSpan,
      null,
      locale,
    );
    const taskItem = unFocusedAgg.tasksList.find((tk) => tk.id === focus.id);
    return {
      kind: "task" as const,
      taskId: focus.id,
      title: taskNames[focus.id],
      color: TASK_COLOR_MAP[focus.id],
      share: taskItem?.share ?? 1,
    };
  }, [customSpan, focus, locale, rangeId, responseData, taskNames]);

  const selectableProjectsForScope = useMemo(() => {
    if (effectiveScope === "project") {
      const isOrgAdmin = responseData?.actor.role === "ADMIN";
      return isOrgAdmin ? projects : projects.filter((p) => p.isLeader);
    }
    return projects;
  }, [effectiveScope, projects, responseData?.actor.role]);

  const activeProjectOption = useMemo(() => {
    const targetId = responseData?.selectedProjectId ?? selectedProjectId;
    if (!targetId) return null;
    return projects.find((p) => p.id === targetId) ?? null;
  }, [projects, responseData?.selectedProjectId, selectedProjectId]);

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      showCloseButton={false}
      className="mx-3 w-full max-w-[940px] overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-0 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Explicit Flex Height Container inside Modal's inner div */}
      <div className="flex max-h-[85vh] flex-col overflow-hidden bg-white dark:bg-gray-900">
        {/* Minimal Header: "Usage" on left, Scope + Close on right */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {focusedMeta && (
              <button
                type="button"
                onClick={() => {
                  setFocus(null);
                  if (effectiveScope === "personal") {
                    setSelectedProjectId(null);
                  }
                }}
                aria-label={t("backToOverview")}
                className="flex size-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.12] dark:hover:text-white"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>
            )}
            <h2 className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-white">
              {focusedMeta ? focusedMeta.title : t("modalTitle")}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {availableScopes.length > 1 && (
              <div
                ref={scopeContainerRef}
                className="relative inline-flex items-center rounded-full bg-gray-100 p-0.5 dark:bg-white/[0.06]"
              >
                <span
                  ref={scopeThumbRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-white shadow-theme-xs dark:bg-gray-800"
                />
                {availableScopes.map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    data-pill={sc}
                    onClick={() => {
                      setFocus(null);
                      setScope(sc);
                      if (sc === "project" && !selectedProjectId) {
                        const firstLed =
                          projects.find((p) => p.isLeader) ?? projects[0];
                        if (firstLed) setSelectedProjectId(firstLed.id);
                      }
                      if (sc === "organization") {
                        setSelectedProjectId(null);
                      }
                    }}
                    className={cn(
                      "relative z-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      effectiveScope === sc
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                    )}
                  >
                    {sc === "organization"
                      ? t("scopes.organization")
                      : sc === "project"
                        ? t("scopes.project")
                        : t("scopes.personal")}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={closeModal}
              aria-label={t("close")}
              className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.12] dark:hover:text-white"
            >
              <CloseIcon className="size-3.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          data-testid="token-usage-scroll-body"
          className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-6"
        >
          {/* Toolbar Row: Time Range Pill Bar + Project Filter */}
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative">
              <div
                ref={rangeContainerRef}
                className="relative inline-flex flex-wrap items-center rounded-full bg-gray-100 p-1 dark:bg-white/[0.05]"
              >
                <span
                  ref={rangeThumbRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 left-0 rounded-full bg-white shadow-theme-xs dark:bg-gray-800"
                />
                {RANGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-pill={preset.id}
                    onClick={() => {
                      setRangeId(preset.id);
                      setIsPickerOpen(false);
                    }}
                    className={cn(
                      "relative z-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      rangeId === preset.id
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                    )}
                  >
                    {t(`ranges.${preset.id}`)}
                  </button>
                ))}

                <button
                  type="button"
                  data-pill="custom"
                  data-custom-span-trigger="true"
                  onClick={() => {
                    setRangeId("custom");
                    setIsPickerOpen((prev) => !prev);
                  }}
                  className={cn(
                    "relative z-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    rangeId === "custom"
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                >
                  <CalenderIcon className="size-3.5" />
                  <span>
                    {rangeId === "custom" && customSpan
                      ? `${shortDayFmt.format(customSpan.from)} – ${shortDayFmt.format(customSpan.to)}`
                      : t("ranges.custom")}
                  </span>
                </button>
              </div>

              {isPickerOpen && (
                <TokenUsageSpanPicker
                  span={customSpan}
                  activeDayKeys={aggregated.heatmap.activeDayKeys}
                  locale={locale}
                  labels={{
                    thisMonth: t("calendar.thisMonth"),
                    lastMonth: t("calendar.lastMonth"),
                    thisYear: t("calendar.thisYear"),
                    selectStartDate: t("calendar.selectStartDate"),
                    selectEndDate: t("calendar.selectEndDate"),
                    daysUnit: t("calendar.daysUnit"),
                    prevMonth: t("calendar.prevMonth"),
                    nextMonth: t("calendar.nextMonth"),
                  }}
                  onChange={(nextSpan) => {
                    setCustomSpan(nextSpan);
                    setRangeId("custom");
                  }}
                  onClose={() => setIsPickerOpen(false)}
                />
              )}
            </div>

            {selectableProjectsForScope.length > 0 &&
              (effectiveScope === "project" || effectiveScope === "personal") && (
                <div ref={projectMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProjectMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                  >
                    <span className="max-w-[180px] truncate">
                      {effectiveScope === "personal"
                        ? focus?.kind === "owner"
                          ? (projects.find((p) => p.id === focus.id)?.name ??
                            t("allMyProjects"))
                          : t("allMyProjects")
                        : (activeProjectOption?.name ?? t("selectProject"))}
                    </span>
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 text-gray-400 transition-transform",
                        isProjectMenuOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {isProjectMenuOpen && (
                    <div className="cu-usage-popover-enter absolute end-0 top-[calc(100%+6px)] z-50 w-60 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                      {effectiveScope === "personal" && (
                        <button
                          type="button"
                          onClick={() => {
                            setFocus(null);
                            setSelectedProjectId(null);
                            setIsProjectMenuOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-xs font-medium transition-colors",
                            focus === null
                              ? "bg-gray-100 text-gray-900 dark:bg-white/[0.08] dark:text-white"
                              : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]",
                          )}
                        >
                          <span className="truncate">{t("allMyProjects")}</span>
                          {focus === null && (
                            <CheckLineIcon className="size-3.5 shrink-0" />
                          )}
                        </button>
                      )}

                      {selectableProjectsForScope.map((proj) => {
                        const isSelected =
                          effectiveScope === "personal"
                            ? focus?.kind === "owner" && focus.id === proj.id
                            : activeProjectOption?.id === proj.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              if (effectiveScope === "personal") {
                                setFocus({ kind: "owner", id: proj.id });
                              } else {
                                setFocus(null);
                                setSelectedProjectId(proj.id);
                              }
                              setIsProjectMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-xs font-medium transition-colors",
                              isSelected
                                ? "bg-gray-100 text-gray-900 dark:bg-white/[0.08] dark:text-white"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]",
                            )}
                          >
                            <span className="truncate">{proj.name}</span>
                            {isSelected && (
                              <CheckLineIcon className="size-3.5 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Clean Card Stack (Matches Reference Screenshots 3 & 4) */}
          <div className="flex flex-col gap-3">
            {/* Row 1: 4-Column KPI Strip */}
            <div className="grid grid-cols-2 divide-y divide-gray-200/90 overflow-hidden rounded-2xl border border-gray-200/90 bg-white lg:grid-cols-[1.45fr_1fr_1fr_1fr] lg:divide-x lg:divide-y-0 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
              {/* Total Tokens */}
              <div className="flex flex-col justify-between p-5">
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  {rangeTitleLabel}
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-[32px] leading-none font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
                    <AnimatedCounter value={aggregated.totals.tokens} />
                  </span>
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    {t("metrics.tokens")}
                  </span>
                </div>
              </div>

              {/* Cache Hit Rate */}
              <div className="flex flex-col justify-between p-5">
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  {t("metrics.cacheHitRate")}
                </span>
                <div className="mt-2.5 text-[22px] leading-none font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
                  <AnimatedCounter
                    value={aggregated.totals.cacheHitRate * 100}
                    compact={false}
                    suffix="%"
                  />
                </div>
              </div>

              {/* Output Tokens */}
              <div className="flex flex-col justify-between p-5">
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  {t("metrics.output")}
                </span>
                <div className="mt-2.5 text-[22px] leading-none font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
                  <AnimatedCounter value={aggregated.totals.output} />
                </div>
              </div>

              {/* Calls */}
              <div className="flex flex-col justify-between p-5">
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  {t("metrics.calls")}
                </span>
                <div className="mt-2.5 text-[22px] leading-none font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">
                  <AnimatedCounter
                    value={aggregated.totals.calls}
                    compact={false}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: 53-Week × 7-Day Daily Token Activity Heatmap (Directly below KPI Strip) */}
            <TokenUsageHeatmap
              heatmap={aggregated.heatmap}
              labels={{
                title: t("heatmap.title"),
                activeSummary: t("heatmap.activeSummary", {
                  count: aggregated.heatmap.activeDays,
                }),
                daily: t("heatmap.daily"),
                weekly: t("heatmap.weekly"),
                cumulative: t("heatmap.cumulative"),
                light: t("heatmap.light"),
                heavy: t("heatmap.heavy"),
                tokensUnit: t("metrics.tokens"),
                callsUnit: t("metrics.callsLower"),
                lifetimeTokens: t("heatmap.lifetimeTokens"),
                peakDailyTokens: t("heatmap.peakDailyTokens"),
                longestStreak: t("heatmap.longestStreak"),
                currentStreak: t("heatmap.currentStreak"),
                daysUnit: t("calendar.daysUnit"),
              }}
            />

            {/* Row 3: Stacked Column Chart (Tokens over time) */}
            <TokenUsageChart
              data={aggregated}
              chartMode={chartMode}
              onChartModeChange={setChartMode}
              ownerGroupLabel={
                ownerGroupKind === "member"
                  ? t("chart.byMember")
                  : t("chart.byProject")
              }
              taskGroupLabel={t("chart.byTask")}
              titleLabel={t("chart.title")}
              unitLabel={unitLabel}
              emptyLabel={t("chart.empty")}
              tokensUnitLabel={t("metrics.tokens")}
              callsUnitLabel={t("metrics.callsLower")}
              taskNames={taskNames}
              focus={focus}
              onSelectFocus={setFocus}
            />

            {/* Row 4: Side-by-Side Breakdown (Projects/Members | Tasks) */}
            <div className="grid grid-cols-1 divide-y divide-gray-200/90 overflow-hidden rounded-2xl border border-gray-200/90 bg-white lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
              {/* Left Column: Projects OR Members */}
              <div className="flex flex-col p-5">
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">
                    {ownerGroupKind === "member"
                      ? t("lists.membersTitle")
                      : t("lists.projectsTitle")}
                  </h3>
                  <span className="text-xs font-normal tabular-nums text-gray-400 dark:text-gray-500">
                    {aggregated.ownersList.length}
                  </span>
                </div>

                {aggregated.ownersList.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-8 text-xs text-gray-400 dark:text-gray-500">
                    {t("lists.empty")}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {aggregated.ownersList.map((item) => {
                      const isFocused =
                        focus?.kind === "owner" && focus.id === item.id;
                      const widthPct =
                        item.tokens > 0
                          ? Math.max(2, Math.round(item.share * 100))
                          : 0;
                      const initial =
                        item.name.trim().charAt(0).toUpperCase() || "P";
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setFocus(
                              isFocused ? null : { kind: "owner", id: item.id },
                            )
                          }
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
                            isFocused
                              ? "bg-gray-100/90 dark:bg-white/[0.08]"
                              : "hover:bg-gray-50 dark:hover:bg-white/[0.04]",
                          )}
                        >
                          {item.kind === "member" ? (
                            <UserAvatar
                              name={item.name}
                              avatarUrl={item.avatarUrl}
                              alt={item.name}
                              className="size-7 shrink-0 text-xs"
                            />
                          ) : (
                            <span
                              style={{
                                backgroundColor: `${item.color}18`,
                                color: item.color,
                              }}
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                            >
                              {initial}
                            </span>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">
                                {item.name}
                              </span>
                            </div>
                            <div className="cu-usage-track mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                              <span
                                style={{
                                  width: `${widthPct}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </div>

                          <div className="shrink-0 text-end tabular-nums">
                            <div className="text-[13px] font-semibold text-gray-900 dark:text-white">
                              {formatCompactTokens(item.tokens)}
                            </div>
                            <div className="text-[11px] text-gray-400 dark:text-gray-500">
                              {formatSharePercent(item.share)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Tasks */}
              <div className="flex flex-col p-5">
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">
                    {t("lists.tasksTitle")}
                  </h3>
                  <span className="text-xs font-normal tabular-nums text-gray-400 dark:text-gray-500">
                    {aggregated.tasksList.length}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  {aggregated.tasksList.map((task) => {
                    const IconComp = TASK_ICON_MAP[task.id];
                    const isFocused =
                      focus?.kind === "task" && focus.id === task.id;
                    const widthPct =
                      task.tokens > 0
                        ? Math.max(2, Math.round(task.share * 100))
                        : 0;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() =>
                          setFocus(
                            isFocused ? null : { kind: "task", id: task.id },
                          )
                        }
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
                          isFocused
                            ? "bg-gray-100/90 dark:bg-white/[0.08]"
                            : "hover:bg-gray-50 dark:hover:bg-white/[0.04]",
                        )}
                      >
                        <span
                          style={{
                            backgroundColor: `${task.color}18`,
                            color: task.color,
                          }}
                          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                        >
                          <IconComp className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">
                              {taskNames[task.id]}
                            </span>
                            {task.calls > 0 && (
                              <span className="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                                {task.calls} {t("metrics.callsLower")}
                              </span>
                            )}
                          </div>
                          <div className="cu-usage-track mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                            <span
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: task.color,
                              }}
                            />
                          </div>
                        </div>

                        <div className="shrink-0 text-end tabular-nums">
                          <div className="text-[13px] font-semibold text-gray-900 dark:text-white">
                            {formatCompactTokens(task.tokens)}
                          </div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500">
                            {formatSharePercent(task.share)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
