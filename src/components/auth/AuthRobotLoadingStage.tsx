"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Robot3D, { type RobotStatus } from "@/components/ai-companion/Robot3D";

export type AuthRobotStageVariant =
  | "google-handshake"
  | "session-gate"
  | "organizations-scan";

export interface AuthRobotLoadingStageProps {
  readonly variant: AuthRobotStageVariant;
  readonly userName?: string;
  readonly locale?: string;
  readonly className?: string;
}

interface StageCopy {
  readonly badge: string;
  readonly speeches: readonly [string, string, string];
  readonly steps: readonly [string, string, string];
  readonly tip: string;
  readonly boostToast: string;
}

const STAGE_MOODS: readonly RobotStatus[] = ["happy", "thinking", "speaking"];

function resolveIsVietnamese(explicitLocale?: string): boolean {
  if (explicitLocale) {
    return explicitLocale.toLowerCase().startsWith("vi");
  }
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement.lang?.toLowerCase() ?? "";
    if (htmlLang.startsWith("vi")) return true;
    if (htmlLang.startsWith("en")) return false;
  }
  if (typeof navigator !== "undefined") {
    const navLang = navigator.language?.toLowerCase() ?? "";
    if (navLang.startsWith("vi")) return true;
  }
  return true;
}

function getStageCopy(
  variant: AuthRobotStageVariant,
  isVi: boolean,
  userName?: string,
): StageCopy {
  const cleanName = userName?.trim();
  const greetingVi = cleanName ? ` ${cleanName}` : " bạn";
  const greetingEn = cleanName ? ` ${cleanName}` : "";

  if (variant === "google-handshake") {
    return isVi
      ? {
          badge: "Cổng kết nối Google OAuth",
          speeches: [
            "Đợi mình xíu nha, Robot đang bắt tay với Google…",
            "Đang xác thực danh tính & đồng bộ khóa bảo mật phiên…",
            "Sắp xong rồi! Đang mở cổng Continuum AI cho bạn…",
          ],
          steps: [
            "Mở kênh kết nối bảo mật với Google",
            "Xác thực tài khoản & cấp phát phiên IAM",
            "Chuẩn bị không gian làm việc Continuum AI",
          ],
          tip: "Rê chuột hoặc chạm vào Robot để cổ vũ mình chạy nhanh hơn nhé!",
          boostToast: "Nạp thêm năng lượng tốc độ! ⚡",
        }
      : {
          badge: "Google OAuth Handshake",
          speeches: [
            "Hold on! Our Robot is shaking hands with Google…",
            "Verifying your identity & syncing encrypted session keys…",
            "Almost there! Opening the Continuum AI gateway for you…",
          ],
          steps: [
            "Establishing secure channel with Google",
            "Verifying identity & issuing IAM session",
            "Preparing your Continuum AI workspace",
          ],
          tip: "Move your cursor or tap the Robot to cheer it on while waiting!",
          boostToast: "Turbo boost activated! ⚡",
        };
  }

  if (variant === "organizations-scan") {
    return isVi
      ? {
          badge: "Đồng bộ Tổ chức & Phân quyền",
          speeches: [
            `Xin chào${greetingVi}! Mình đang quét danh sách Tổ chức của bạn…`,
            "Đang kiểm tra quyền truy cập dự án & lời mời đang chờ…",
            "Sẵn sàng rồi! Hãy chọn một Tổ chức để bắt đầu nhé…",
          ],
          steps: [
            "Đã xác minh phiên tài khoản bảo mật",
            "Đang tải danh sách Tổ chức & vai trò thành viên",
            "Khởi tạo bảng chọn không gian làm việc",
          ],
          tip: "Rê chuột qua lại để tương tác với Robot 3D trong lúc đồng bộ!",
          boostToast: "Tăng tốc quét dữ liệu! 🚀",
        }
      : {
          badge: "Organization & Role Discovery",
          speeches: [
            `Hi${greetingEn}! Scanning the Organizations linked to your account…`,
            "Checking project permissions & pending team invitations…",
            "All set! Pick an Organization to jump right in…",
          ],
          steps: [
            "Verified secure account session",
            "Loading your Organizations & membership roles",
            "Preparing workspace selector",
          ],
          tip: "Move your cursor around to interact with the 3D Robot while syncing!",
          boostToast: "Scanning at warp speed! 🚀",
        };
  }

  return isVi
    ? {
        badge: "Trạm kiểm soát Continuum AI",
        speeches: [
          "Chào mừng bạn! Robot đang kiểm tra thẻ vào cổng phiên làm việc…",
          "Đang giải mã thông tin tài khoản & đồng bộ bảo mật…",
          "Đang tải danh sách Tổ chức của bạn, đợi mình một nhịp nhé…",
        ],
        steps: [
          "Nhận tín hiệu đăng nhập thành công",
          "Xác minh phiên bảo mật với máy chủ IAM",
          "Tải danh mục Tổ chức & Dự án",
        ],
        tip: "Rê chuột hoặc chạm vào Robot 3D để tương tác trong lúc chờ!",
        boostToast: "Robot đã nhận tín hiệu! ✨",
      }
    : {
        badge: "Continuum AI Checkpoint",
        speeches: [
          "Welcome! Our Robot is checking your workspace access pass…",
          "Decrypting account profile & verifying session security…",
          "Loading your Organizations directory, just a moment…",
        ],
        steps: [
          "Received authenticated sign-in signal",
          "Verifying secure session with IAM server",
          "Loading Organizations & Projects directory",
        ],
        tip: "Move your cursor or tap the 3D Robot to interact while waiting!",
        boostToast: "Signal boosted! ✨",
      };
}

export default function AuthRobotLoadingStage({
  variant,
  userName,
  locale,
  className = "",
}: AuthRobotLoadingStageProps) {
  const shouldReduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [cheerCount, setCheerCount] = useState(0);
  const [isBoosted, setIsBoosted] = useState(false);

  const isVi = resolveIsVietnamese(locale);
  const copy = getStageCopy(variant, isVi, userName);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % 3);
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isBoosted) return;
    const timer = window.setTimeout(() => setIsBoosted(false), 1100);
    return () => window.clearTimeout(timer);
  }, [isBoosted]);

  const activeMood: RobotStatus = isBoosted
    ? "happy"
    : (STAGE_MOODS[stepIndex] ?? "happy");

  const handleCheerRobot = () => {
    setCheerCount((prev) => prev + 1);
    setIsBoosted(true);
  };

  const isCompact = variant === "google-handshake";

  return (
    <div
      data-testid={`auth-robot-stage-${variant}`}
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/45 to-sky-50/60 p-4 shadow-sm dark:border-indigo-500/25 dark:from-gray-900 dark:via-indigo-950/35 dark:to-sky-950/25 ${className}`}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-indigo-400/15 blur-2xl dark:bg-indigo-500/20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-sky-400/15 blur-2xl dark:bg-sky-500/20"
      />

      {/* Top header pill */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-indigo-700 shadow-2xs dark:border-indigo-500/30 dark:bg-gray-800/90 dark:text-indigo-300">
          <span className="relative flex h-2 w-2">
            <span className=" absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
          </span>
          {copy.badge}
        </span>

        {cheerCount > 0 && (
          <span
            data-testid="auth-robot-cheer-badge"
            className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[11px] font-semibold text-amber-800 tabular-nums dark:bg-amber-500/20 dark:text-amber-300"
          >
            ⚡ x{cheerCount}
          </span>
        )}
      </div>

      {/* Main 3D Robot Stage + Speech Bubble */}
      <div
        className={`relative z-10 mt-3 flex flex-col items-center gap-3 ${
          isCompact ? "sm:flex-row sm:items-center" : ""
        }`}
      >
        {/* Interactive 3D Robot Avatar Pod */}
        <button
          type="button"
          onClick={handleCheerRobot}
          data-testid="auth-robot-interactive-pod"
          aria-label={copy.tip}
          className={`group relative flex shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-indigo-200/70 bg-gradient-to-b from-white/95 to-indigo-50/80 shadow-inner transition-transform duration-200 hover:scale-[1.03] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-indigo-500/30 dark:from-gray-800/95 dark:to-gray-900/90 ${
            isCompact ? "h-28 w-28" : "h-32 w-32"
          }`}
        >
          {/* Rotating orbital neural ring */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-1.5 rounded-full border border-dashed border-indigo-300/70 motion-safe:animate-[spin_10s_linear_infinite] dark:border-indigo-400/35"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-full border border-sky-300/50 motion-safe:animate-[spin_7s_linear_infinite_reverse] dark:border-sky-400/25"
          />

          {/* 4 Google / Continuum Orbiting Energy Dots */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-1 motion-safe:animate-[spin_5s_linear_infinite]"
          >
            <span className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#4285F4] shadow-[0_0_8px_#4285F4]" />
            <span className="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rounded-full bg-[#EA4335] shadow-[0_0_8px_#EA4335]" />
            <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#FBBC05] shadow-[0_0_8px_#FBBC05]" />
            <span className="absolute top-1/2 left-0 h-2 w-2 -translate-y-1/2 rounded-full bg-[#34A853] shadow-[0_0_8px_#34A853]" />
          </span>

          {/* 3D Robot Canvas */}
          <div className="relative z-10 h-24 w-24">
            <Robot3D status={activeMood} interactiveMouse />
          </div>

          {/* Boost toast floating chip */}
          <AnimatePresence>
            {isBoosted && (
              <motion.span
                initial={{ opacity: 0, y: 8, scale: 0.85 }}
                animate={{ opacity: 1, y: -6, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-none absolute -top-2.5 z-20 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white shadow-sm"
              >
                {copy.boostToast}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Speech Bubble + Step Checklist */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-start">
          {/* Dynamic Speech Bubble */}
          <div className="relative rounded-xl border border-indigo-100 bg-white/95 px-3.5 py-2.5 shadow-2xs dark:border-gray-700/80 dark:bg-gray-800/90">
            <AnimatePresence mode="wait">
              <motion.p
                key={stepIndex}
                data-testid="auth-robot-speech-text"
                initial={
                  shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
                }
                transition={{ duration: 0.2 }}
                className="text-xs leading-relaxed font-semibold text-gray-800 dark:text-gray-100"
              >
                {copy.speeches[stepIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* 3-Step Live Progress Checklist */}
          <ul
            aria-label="Login progress steps"
            className="space-y-1.5 text-[11px]"
          >
            {copy.steps.map((stepLabel, idx) => {
              const isDone = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <li
                  key={stepLabel}
                  className={`flex items-center gap-2 transition-colors duration-200 ${
                    isCurrent
                      ? "font-semibold text-indigo-700 dark:text-indigo-300"
                      : isDone
                        ? "font-medium text-emerald-700 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : isCurrent
                          ? "bg-indigo-100 text-indigo-700 motion-safe:animate-pulse dark:bg-indigo-500/25 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                    }`}
                  >
                    {isDone ? "✓" : isCurrent ? "⟳" : "•"}
                  </span>
                  <span className="truncate">{stepLabel}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Shimmer Progress Bar + Interactive Tip */}
      <div className="relative z-10 mt-3 space-y-1.5">
        <div
          aria-hidden="true"
          className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100/80 dark:bg-gray-800"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / 3) * 100}%` }}
          />
        </div>
        <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
          {copy.tip}
        </p>
      </div>
    </div>
  );
}
