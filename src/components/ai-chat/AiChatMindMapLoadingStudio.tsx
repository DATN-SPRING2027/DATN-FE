"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircleIcon, MindMapIcon, ShootingStarIcon } from "@/icons";
import { cn } from "@/utils";

export type AiChatMindMapLoadingStudioProps = Readonly<{
  mode: "checking" | "synthesizing";
}>;

export default function AiChatMindMapLoadingStudio({
  mode,
}: AiChatMindMapLoadingStudioProps) {
  const t = useTranslations("AiChat");
  const patternId = useId().replace(/:/g, "");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (mode !== "synthesizing") return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const activeStepIndex =
    elapsedSeconds < 2 ? 0 : elapsedSeconds < 5 ? 1 : 2;

  const steps = [
    t("mindMapLoadingStep1"),
    t("mindMapLoadingStep2"),
    t("mindMapLoadingStep3"),
  ];

  return (
    <div
      role="status"
      data-testid={
        mode === "synthesizing"
          ? "mind-map-loading-state"
          : "mind-map-checking-state"
      }
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-gray-50/95 p-5 select-none dark:bg-gpt-canvas"
    >
      {/* Dot-grid background + soft ambient Studio glow */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern
            id={`mindmap-loading-grid-${patternId}`}
            width={22}
            height={22}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={2}
              cy={2}
              r={1}
              className="fill-gray-300/70 dark:fill-white/10"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#mindmap-loading-grid-${patternId})`}
        />
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 start-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/8 blur-3xl rtl:translate-x-1/2 dark:bg-brand-500/12"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-5">
        {/* Connected SVG Mind-Map Topology Shimmer */}
        <div className="w-full max-w-sm rounded-2xl border border-gray-200/80 bg-white/80 p-3 shadow-theme-sm backdrop-blur-md dark:border-white/10 dark:bg-gpt-popover/75">
          <svg
            aria-hidden="true"
            viewBox="0 0 360 168"
            className="h-36 w-full"
          >
            {/* Bezier Connectors (Root -> 3 semantic branches -> leaf nodes) */}
            <path
              d="M 118 84 C 152 84, 152 34, 188 34"
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 4"
              className="animate-pulse stroke-brand-400 motion-reduce:animate-none dark:stroke-brand-400/80"
            />
            <path
              d="M 118 84 C 152 84, 152 84, 188 84"
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 4"
              className="animate-pulse stroke-blue-light-400 motion-reduce:animate-none dark:stroke-blue-light-400/80"
            />
            <path
              d="M 118 84 C 152 84, 152 134, 188 134"
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 4"
              className="animate-pulse stroke-success-400 motion-reduce:animate-none dark:stroke-success-400/80"
            />
            <path
              d="M 294 34 C 308 34, 308 24, 320 24"
              fill="none"
              strokeWidth={1.5}
              className="stroke-brand-300/70 dark:stroke-brand-400/40"
            />
            <path
              d="M 294 84 C 308 84, 308 84, 320 84"
              fill="none"
              strokeWidth={1.5}
              className="stroke-blue-light-300/70 dark:stroke-blue-light-400/40"
            />
            <path
              d="M 294 134 C 308 134, 308 144, 320 144"
              fill="none"
              strokeWidth={1.5}
              className="stroke-success-300/70 dark:stroke-success-400/40"
            />

            {/* Root Node Card */}
            <rect
              x={14}
              y={58}
              width={104}
              height={52}
              rx={12}
              className="fill-brand-600 stroke-brand-400 dark:fill-brand-600"
              strokeWidth={1.5}
            />
            <rect
              x={26}
              y={73}
              width={68}
              height={8}
              rx={4}
              className="animate-pulse fill-white/90 motion-reduce:animate-none"
            />
            <rect
              x={26}
              y={88}
              width={46}
              height={6}
              rx={3}
              className="fill-brand-200/80"
            />

            {/* Branch 1: Brand Indigo */}
            <rect
              x={188}
              y={16}
              width={106}
              height={36}
              rx={10}
              strokeWidth={1.25}
              className="fill-white stroke-brand-200 dark:fill-gpt-sidebar dark:stroke-brand-500/40"
            />
            <rect
              x={194}
              y={23}
              width={3.5}
              height={22}
              rx={2}
              className="fill-brand-500 dark:fill-brand-400"
            />
            <rect
              x={204}
              y={26}
              width={72}
              height={7}
              rx={3.5}
              className="animate-pulse fill-gray-300 motion-reduce:animate-none dark:fill-white/25"
            />
            <rect
              x={204}
              y={38}
              width={36}
              height={5}
              rx={2.5}
              className="fill-brand-200 dark:fill-brand-400/40"
            />

            {/* Branch 2: Sky Blue */}
            <rect
              x={188}
              y={66}
              width={106}
              height={36}
              rx={10}
              strokeWidth={1.25}
              className="fill-white stroke-blue-light-200 dark:fill-gpt-sidebar dark:stroke-blue-light-500/40"
            />
            <rect
              x={194}
              y={73}
              width={3.5}
              height={22}
              rx={2}
              className="fill-blue-light-500 dark:fill-blue-light-400"
            />
            <rect
              x={204}
              y={76}
              width={78}
              height={7}
              rx={3.5}
              className="animate-pulse fill-gray-300 motion-reduce:animate-none dark:fill-white/25"
            />
            <rect
              x={204}
              y={88}
              width={42}
              height={5}
              rx={2.5}
              className="fill-blue-light-200 dark:fill-blue-light-400/40"
            />

            {/* Branch 3: Emerald */}
            <rect
              x={188}
              y={116}
              width={106}
              height={36}
              rx={10}
              strokeWidth={1.25}
              className="fill-white stroke-success-200 dark:fill-gpt-sidebar dark:stroke-success-500/40"
            />
            <rect
              x={194}
              y={123}
              width={3.5}
              height={22}
              rx={2}
              className="fill-success-500 dark:fill-success-400"
            />
            <rect
              x={204}
              y={126}
              width={66}
              height={7}
              rx={3.5}
              className="animate-pulse fill-gray-300 motion-reduce:animate-none dark:fill-white/25"
            />
            <rect
              x={204}
              y={138}
              width={34}
              height={5}
              rx={2.5}
              className="fill-success-200 dark:fill-success-400/40"
            />

            {/* Mini Leaf Pills */}
            <rect
              x={320}
              y={15}
              width={28}
              height={18}
              rx={9}
              className="fill-brand-50 stroke-brand-300 dark:fill-brand-950 dark:stroke-brand-500/50"
              strokeWidth={1}
            />
            <rect
              x={320}
              y={75}
              width={28}
              height={18}
              rx={9}
              className="fill-blue-light-50 stroke-blue-light-300 dark:fill-blue-light-950 dark:stroke-blue-light-500/50"
              strokeWidth={1}
            />
            <rect
              x={320}
              y={135}
              width={28}
              height={18}
              rx={9}
              className="fill-success-50 stroke-success-300 dark:fill-success-950 dark:stroke-success-500/50"
              strokeWidth={1}
            />
          </svg>
        </div>

        {/* Glass Synthesis Progress Card */}
        {mode === "checking" ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white/90 px-4 py-2 text-xs font-medium text-gray-700 shadow-theme-xs backdrop-blur-md dark:border-white/10 dark:bg-gpt-popover/90 dark:text-gray-200">
            <MindMapIcon
              aria-hidden="true"
              className="size-3.5 animate-pulse text-brand-600 motion-reduce:animate-none dark:text-brand-400"
            />
            <span>{t("mindMapCheckingSaved")}</span>
          </div>
        ) : (
          <div className="w-full max-w-sm rounded-2xl border border-gray-200/90 bg-white/92 p-4 text-start shadow-theme-md backdrop-blur-md dark:border-white/10 dark:bg-gpt-popover/92">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <ShootingStarIcon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                    {t("mindMapLoadingTitle")}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("mindMapLoadingBody")}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 tabular-nums dark:bg-white/10 dark:text-gray-300">
                {elapsedSeconds}s
              </span>
            </div>

            <ol className="mt-3.5 space-y-2 border-t border-gray-100 pt-3 dark:border-white/10">
              {steps.map((stepLabel, idx) => {
                const isDone = idx < activeStepIndex;
                const isCurrent = idx === activeStepIndex;
                return (
                  <li
                    key={stepLabel}
                    className={cn(
                      "flex items-center gap-2.5 text-xs transition-colors",
                      isDone
                        ? "font-medium text-success-700 dark:text-success-300"
                        : isCurrent
                          ? "font-semibold text-gray-900 dark:text-white"
                          : "text-gray-400 dark:text-gray-500",
                    )}
                  >
                    {isDone ? (
                      <CheckCircleIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-success-600 dark:text-success-400"
                      />
                    ) : isCurrent ? (
                      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                        <span className="absolute size-3.5 animate-ping rounded-full bg-brand-400/50 motion-reduce:animate-none" />
                        <span className="relative size-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                      </span>
                    ) : (
                      <span className="inline-flex size-4 shrink-0 items-center justify-center">
                        <span className="size-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
                      </span>
                    )}
                    <span className="min-w-0 truncate">{stepLabel}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

