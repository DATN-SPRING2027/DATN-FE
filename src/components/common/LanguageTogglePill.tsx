"use client";

import { useCallback, useContext, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import * as Icons from "@/icons";
import { tr } from "@/i18n/tr";
import { cn } from "@/utils";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ButtonRippleLayer,
  type ButtonRippleHandle,
} from "@/components/ui/button/buttonMotion";

function InlineVnFlag() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#da251d] text-[9px] leading-none text-[#ffff00]"
    >
      ★
    </span>
  );
}

function InlineUsFlag() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#192f5d] text-[8px] leading-none font-bold text-white"
    >
      US
    </span>
  );
}

export default function LanguageTogglePill({
  variant = "surface",
  className,
}: {
  variant?: "surface" | "inverse" | "inline";
  className?: string;
}) {
  const t = useTranslations("common");
  const router = useContext(AppRouterContext);
  const shouldReduceMotion = useReducedMotion();
  const rippleRef = useRef<ButtonRippleHandle>(null);

  const resolvedCode = tr(t, "localeCode", "en");
  const locale: Locale = resolvedCode === "vi" ? "vi" : "en";
  const nextLocale: Locale = locale === "vi" ? "en" : "vi";

  const currentShort = locale === "vi" ? "Tiếng Việt" : "English";
  const switchAriaLabel =
    locale === "vi"
      ? "Chuyển ngôn ngữ sang Tiếng Anh"
      : "Switch language to Tiếng Việt";

  const VnIcon = "VnFlagIcon" in Icons ? Icons.VnFlagIcon : null;
  const UsIcon = "UsFlagIcon" in Icons ? Icons.UsFlagIcon : null;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (shouldReduceMotion) return;
      rippleRef.current?.spawn(event);
    },
    [shouldReduceMotion],
  );

  const handleToggle = () => {
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
    if (router && typeof router.refresh === "function") {
      router.refresh();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const motionStateProps = shouldReduceMotion
    ? undefined
    : {
        whileHover: { scale: 1.03, y: -1 },
        whileTap: { scale: 0.96, y: 0 },
      };

  return (
    <motion.button
      type="button"
      data-slot="button"
      transition={ANIMATE_UI_BUTTON_SPRING}
      {...motionStateProps}
      onPointerDown={handlePointerDown}
      onClick={handleToggle}
      aria-label={switchAriaLabel}
      title={switchAriaLabel}
      className={cn(
        "relative inline-flex cursor-pointer select-none items-center gap-2 overflow-hidden rounded-full text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        variant === "inverse"
          ? "h-9 border border-white/20 bg-white/10 px-3 text-white hover:bg-white/20"
          : variant === "inline"
            ? "h-8 border border-gray-200 bg-gray-50 px-2.5 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            : "h-11 border border-gray-200/90 bg-white/95 px-3.5 text-gray-800 shadow-theme-md backdrop-blur hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100 dark:hover:bg-gray-800",
        className,
      )}
    >
      <ButtonRippleLayer
        ref={rippleRef}
        rippleClassName={
          variant === "inverse"
            ? "bg-white/30"
            : "bg-brand-500/15 dark:bg-white/20"
        }
      />
      <span className="relative z-1 inline-flex shrink-0 items-center justify-center">
        {locale === "vi" ? (
          VnIcon ? (
            <VnIcon
              className="size-4 shrink-0 overflow-hidden rounded-full"
              aria-hidden="true"
            />
          ) : (
            <InlineVnFlag />
          )
        ) : UsIcon ? (
          <UsIcon
            className="size-4 shrink-0 overflow-hidden rounded-full"
            aria-hidden="true"
          />
        ) : (
          <InlineUsFlag />
        )}
      </span>
      <span className="relative z-1 whitespace-nowrap">{currentShort}</span>
    </motion.button>
  );
}
