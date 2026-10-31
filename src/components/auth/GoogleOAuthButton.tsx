"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GoogleIcon } from "@/icons";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ButtonRippleLayer,
  type ButtonRippleHandle,
} from "@/components/ui/button/buttonMotion";

export default function GoogleOAuthButton({ label }: { label: string }) {
  const shouldReduceMotion = useReducedMotion();
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
        whileHover: { scale: 1.01, y: -1 },
        whileTap: { scale: 0.98, y: 0 },
      };

  return (
    <form action="/api/auth/google" method="get">
      <motion.button
        type="submit"
        data-slot="button"
        transition={ANIMATE_UI_BUTTON_SPRING}
        {...motionStateProps}
        onPointerDown={handlePointerDown}
        className="relative inline-flex w-full select-none items-center justify-center gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
      >
        <ButtonRippleLayer
          ref={rippleRef}
          rippleClassName="bg-brand-500/12 dark:bg-white/20"
        />
        <span className="relative z-1 inline-flex shrink-0 items-center justify-center">
          <GoogleIcon aria-hidden="true" />
        </span>
        <span className="relative z-1">{label}</span>
      </motion.button>
    </form>
  );
}
