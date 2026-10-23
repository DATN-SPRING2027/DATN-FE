"use client";

import { useEffect, useState } from "react";

const SMART_STEPS = [
  "Continuum AI is organizing your workspace cards…",
  "Syncing project permissions & active members…",
  "Preparing real-time boards & sprint metrics…",
] as const;

export default function ContinuumMascotScene({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % SMART_STEPS.length);
    }, 1600);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-brand-100/80 bg-gradient-to-br from-brand-50/60 via-white to-indigo-50/40 ${
        compact ? "px-4 py-3.5" : "px-5 py-4 sm:px-6"
      } shadow-theme-xs dark:border-brand-500/20 dark:from-gray-900 dark:via-gray-900 dark:to-brand-950/30`}
    >
      <div className="flex flex-col items-center gap-3.5 sm:flex-row sm:gap-5">
        {/* Animated SVG Scene: Continuum AI Bot + Orbiting Kanban Task Cards */}
        <div
          aria-hidden="true"
          className="relative flex h-20 w-28 shrink-0 items-center justify-center select-none"
        >
          <svg
            viewBox="0 0 140 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient
                id="continuumBotBody"
                x1="45"
                y1="22"
                x2="95"
                y2="76"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient
                id="continuumBotVisor"
                x1="52"
                y1="36"
                x2="88"
                y2="58"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <linearGradient
                id="continuumEyeGlow"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>

            {/* Ground Shadow */}
            <ellipse
              cx="70"
              cy="88"
              rx="22"
              ry="4.5"
              fill="#6366F1"
              className="continuum-bot-shadow"
            />

            {/* Left Orbiting Mini Kanban Card (To Do) */}
            <g className="continuum-card-left">
              <rect
                x="6"
                y="26"
                width="30"
                height="22"
                rx="5"
                fill="white"
                stroke="#C7D2FE"
                strokeWidth="1.5"
              />
              <rect
                x="10"
                y="30"
                width="10"
                height="3.5"
                rx="1.75"
                fill="#6366F1"
              />
              <rect
                x="10"
                y="36"
                width="20"
                height="2.5"
                rx="1.25"
                fill="#CBD5E1"
              />
              <rect
                x="10"
                y="41"
                width="14"
                height="2.5"
                rx="1.25"
                fill="#E2E8F0"
              />
            </g>

            {/* Right Orbiting Mini Kanban Card (Done with Checkmark) */}
            <g className="continuum-card-right">
              <rect
                x="104"
                y="24"
                width="30"
                height="22"
                rx="5"
                fill="white"
                stroke="#A7F3D0"
                strokeWidth="1.5"
              />
              <circle cx="113" cy="33" r="4.5" fill="#10B981" />
              <path
                d="M111 33L112.4 34.4L115.2 31.6"
                stroke="white"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="120"
                y="31"
                width="10"
                height="2.5"
                rx="1.25"
                fill="#94A3B8"
              />
              <rect
                x="109"
                y="40"
                width="19"
                height="2.5"
                rx="1.25"
                fill="#E2E8F0"
              />
            </g>

            {/* Twinkling AI Sparkles */}
            <g className="continuum-sparkle-1">
              <path
                d="M36 14L37.4 17.6L41 19L37.4 20.4L36 24L34.6 20.4L31 19L34.6 17.6L36 14Z"
                fill="#818CF8"
              />
            </g>
            <g className="continuum-sparkle-2">
              <path
                d="M105 12L106.1 14.9L109 16L106.1 17.1L105 20L103.9 17.1L101 16L103.9 14.9L105 12Z"
                fill="#38BDF8"
              />
            </g>

            {/* Floating Continuum AI Mascot Bot */}
            <g className="continuum-bot-float">
              {/* Antenna */}
              <line
                x1="70"
                y1="15"
                x2="70"
                y2="25"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle
                cx="70"
                cy="13"
                r="4"
                fill="#38BDF8"
                className="animate-pulse"
              />
              <circle cx="69" cy="12" r="1.2" fill="white" />

              {/* Side Ear Pods */}
              <rect
                x="41"
                y="40"
                width="5"
                height="14"
                rx="2.5"
                fill="#4F46E5"
              />
              <rect
                x="94"
                y="40"
                width="5"
                height="14"
                rx="2.5"
                fill="#4F46E5"
              />

              {/* Robot Head / Body Shell */}
              <rect
                x="45"
                y="24"
                width="50"
                height="44"
                rx="16"
                fill="url(#continuumBotBody)"
              />
              {/* Subtle Highlight on Top Edge */}
              <path
                d="M55 28H85"
                stroke="white"
                strokeOpacity="0.45"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Dark Glass Visor */}
              <rect
                x="51"
                y="33"
                width="38"
                height="24"
                rx="10"
                fill="url(#continuumBotVisor)"
              />

              {/* Expressive Blinking & Glancing LED Eyes + Cute Happy Smile */}
              <g className="continuum-bot-eyes">
                <rect
                  x="58"
                  y="40"
                  width="6"
                  height="8.5"
                  rx="3"
                  fill="url(#continuumEyeGlow)"
                />
                <circle cx="60" cy="42.5" r="1.1" fill="white" />

                <rect
                  x="76"
                  y="40"
                  width="6"
                  height="8.5"
                  rx="3"
                  fill="url(#continuumEyeGlow)"
                />
                <circle cx="78" cy="42.5" r="1.1" fill="white" />

                {/* Rosy LED Cheeks */}
                <ellipse
                  cx="55.5"
                  cy="49.5"
                  rx="2.2"
                  ry="1.2"
                  fill="#F472B6"
                  fillOpacity="0.65"
                />
                <ellipse
                  cx="84.5"
                  cy="49.5"
                  rx="2.2"
                  ry="1.2"
                  fill="#F472B6"
                  fillOpacity="0.65"
                />

                {/* Cute Happy Arc Mouth */}
                <path
                  d="M66.5 49.5C67.5 51.3 72.5 51.3 73.5 49.5"
                  stroke="#67E8F9"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </g>

              {/* AI Core Chest Badge */}
              <rect
                x="63"
                y="61"
                width="14"
                height="3"
                rx="1.5"
                fill="white"
                fillOpacity="0.55"
              />
            </g>
          </svg>
        </div>

        {/* Status Copy + Rotating Smart AI Sub-status */}
        <div className="min-w-0 flex-1 text-center sm:text-start">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brand-700 uppercase dark:bg-brand-400/15 dark:text-brand-300">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-ping rounded-full bg-brand-500"
            />
            <span>Continuum AI Assistant</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white">
            {label}
          </p>
          <p
            aria-hidden="true"
            key={stepIndex}
            className="continuum-page-enter mt-0.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {SMART_STEPS[stepIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
