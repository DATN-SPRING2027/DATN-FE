"use client";

import { useContext } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import * as Icons from "@/icons";
import { tr } from "@/i18n/tr";
import { cn } from "@/utils";

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

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={switchAriaLabel}
      title={switchAriaLabel}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-full text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        variant === "inverse"
          ? "h-9 border border-white/20 bg-white/10 px-3 text-white hover:bg-white/20"
          : variant === "inline"
            ? "h-8 border border-gray-200 bg-gray-50 px-2.5 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            : "h-11 border border-gray-200/90 bg-white/95 px-3.5 text-gray-800 shadow-theme-md backdrop-blur hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100 dark:hover:bg-gray-800",
        className,
      )}
    >
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
      <span className="whitespace-nowrap">{currentShort}</span>
    </button>
  );
}
