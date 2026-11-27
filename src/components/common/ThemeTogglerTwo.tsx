"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/context/ThemeContext";
import { MoonIcon, SunIcon } from "@/icons";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ButtonRippleLayer,
  useHydratedReducedMotion,
  type ButtonRippleHandle,
} from "@/components/ui/button/buttonMotion";

export default function ThemeTogglerTwo() {
  const { toggleTheme } = useTheme();
  const t = useTranslations("authExperience");
  const shouldReduceMotion = useHydratedReducedMotion();
  const rippleRef = useRef<ButtonRippleHandle>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (shouldReduceMotion) return;
      rippleRef.current?.spawn(event);
    },
    [shouldReduceMotion],
  );

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
      transition={ANIMATE_UI_BUTTON_SPRING}
      {...motionStateProps}
      onPointerDown={handlePointerDown}
      onClick={toggleTheme}
      aria-label={t("toggleTheme")}
      className="relative inline-flex size-14 select-none items-center justify-center overflow-hidden rounded-full bg-brand-500 text-white transition-[background-color,box-shadow] duration-150 ease-out hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <ButtonRippleLayer ref={rippleRef} rippleClassName="bg-white/35" />
      <SunIcon aria-hidden="true" className="relative z-1 hidden size-5 dark:block" />
      <MoonIcon aria-hidden="true" className="relative z-1 size-5 dark:hidden" />
    </motion.button>
  );
}
