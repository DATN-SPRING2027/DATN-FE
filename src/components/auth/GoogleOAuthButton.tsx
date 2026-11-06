"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { GoogleIcon } from "@/icons";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ButtonRippleLayer,
  type ButtonRippleHandle,
} from "@/components/ui/button/buttonMotion";
import AuthRobotLoadingStage from "./AuthRobotLoadingStage";

export default function GoogleOAuthButton({ label }: { label: string }) {
  const shouldReduceMotion = useReducedMotion();
  const rippleRef = useRef<ButtonRippleHandle>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const handlePageShow = () => {
      setIsConnecting(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (shouldReduceMotion || isConnecting) return;
      rippleRef.current?.spawn(event);
    },
    [isConnecting, shouldReduceMotion],
  );

  const motionStateProps =
    shouldReduceMotion || isConnecting
      ? undefined
      : {
          whileHover: { scale: 1.01, y: -1 },
          whileTap: { scale: 0.98, y: 0 },
        };

  return (
    <div className="w-full">
      <form
        action="/api/auth/google"
        method="get"
        onSubmit={() => {
          setIsConnecting(true);
        }}
      >
        <motion.button
          type="submit"
          data-slot="button"
          aria-busy={isConnecting}
          transition={ANIMATE_UI_BUTTON_SPRING}
          {...motionStateProps}
          onPointerDown={handlePointerDown}
          className={`relative inline-flex w-full select-none items-center justify-center gap-3 overflow-hidden rounded-lg border px-5 py-3 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
            isConnecting
              ? "border-indigo-300 bg-indigo-50/70 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-200"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
          }`}
        >
          <ButtonRippleLayer
            ref={rippleRef}
            rippleClassName="bg-brand-500/12 dark:bg-white/20"
          />
          <span className="relative z-1 inline-flex shrink-0 items-center justify-center">
            <GoogleIcon aria-hidden="true" />
          </span>
          <span className="relative z-1">{label}</span>
          {isConnecting && (
            <span
              aria-hidden="true"
              className="relative z-1 ms-1 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-300 dark:border-t-transparent"
            />
          )}
        </motion.button>
      </form>

      {isConnecting && (
        <AuthRobotLoadingStage variant="google-handshake" className="mt-3" />
      )}
    </div>
  );
}
