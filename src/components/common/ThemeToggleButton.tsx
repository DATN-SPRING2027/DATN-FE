"use client";

import React from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/context/ThemeContext";
import { MoonIcon, SunIcon } from "@/icons";
import { cn } from "@/utils";
import {
  ANIMATE_UI_BUTTON_SPRING,
  useHydratedReducedMotion,
} from "@/components/ui/button/buttonMotion";

function useSafeThemeToggle() {
  try {
    return useTheme();
  } catch {
    return {
      theme: "light" as const,
      themeMode: "light" as const,
      setThemeMode: () => {},
      toggleTheme: () => {},
    };
  }
}

export const ThemeToggleButton: React.FC<{
  ariaLabel?: string;
  title?: string;
  className?: string;
}> = ({ ariaLabel, title, className }) => {
  const t = useTranslations("common");
  const label = ariaLabel ?? t("toggleTheme");
  const { toggleTheme } = useSafeThemeToggle();
  const shouldReduceMotion = useHydratedReducedMotion();

  const motionStateProps = shouldReduceMotion
    ? undefined
    : {
        whileHover: { scale: 1.06, y: -1 },
        whileTap: { scale: 0.91, rotate: 12 },
      };

  return (
    <motion.button
      type="button"
      data-slot="button"
      aria-label={label}
      title={title ?? label}
      onClick={toggleTheme}
      transition={ANIMATE_UI_BUTTON_SPRING}
      {...motionStateProps}
      className={cn(
        "hover:text-dark-900 relative flex h-11 w-11 select-none items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
        className,
      )}
    >
      <SunIcon aria-hidden="true" className="hidden size-5 dark:block" />
      <MoonIcon aria-hidden="true" className="size-5 dark:hidden" />
    </motion.button>
  );
};
