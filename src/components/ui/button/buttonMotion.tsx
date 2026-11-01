"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, type Transition } from "motion/react";
import { cn } from "@/utils";

/**
 * Animate UI preset spring physics for responsive, tactile B2B buttons.
 */
export const ANIMATE_UI_BUTTON_SPRING: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 30,
  mass: 0.7,
};

/**
 * Animate UI preset spring physics for icon swaps and inline spinners.
 */
export const ANIMATE_UI_ICON_SPRING: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 26,
  mass: 0.6,
};

interface RippleInstance {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface ButtonRippleHandle {
  spawn: (event: ReactPointerEvent<HTMLElement>) => void;
}

interface ButtonRippleLayerProps {
  rippleClassName?: string;
}

/**
 * Isolated ripple overlay inspired by Animate UI's RippleButton primitive.
 * Keeps ripple state isolated so the parent button and its children do not
 * re-render on pointerdown, preserving native click and form submission 100%.
 */
export const ButtonRippleLayer = memo(
  forwardRef<ButtonRippleHandle, ButtonRippleLayerProps>(
    function ButtonRippleLayer({ rippleClassName }, ref) {
      const [ripples, setRipples] = useState<RippleInstance[]>([]);
      const nextIdRef = useRef(0);

      const removeRipple = useCallback((id: number) => {
        setRipples((prev) => prev.filter((item) => item.id !== id));
      }, []);

      useImperativeHandle(
        ref,
        () => ({
          spawn(event: ReactPointerEvent<HTMLElement>) {
            if (event.button !== 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            const size = Math.max(rect.width, rect.height) * 2.1;
            const x = event.clientX - rect.left - size / 2;
            const y = event.clientY - rect.top - size / 2;
            nextIdRef.current += 1;
            const id = nextIdRef.current;

            setRipples((prev) => [...prev.slice(-3), { id, x, y, size }]);
          },
        }),
        [],
      );

      if (ripples.length === 0) return null;

      return (
        <span
          aria-hidden="true"
          data-slot="button-ripples"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{ scale: 0, opacity: 0.34 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => removeRipple(ripple.id)}
              style={{
                width: ripple.size,
                height: ripple.size,
                left: ripple.x,
                top: ripple.y,
              }}
              className={cn(
                "pointer-events-none absolute rounded-full bg-current",
                rippleClassName,
              )}
            />
          ))}
        </span>
      );
    },
  ),
);
