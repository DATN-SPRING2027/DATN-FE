"use client";

import {
  forwardRef,
  useCallback,
  useRef,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/utils";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ANIMATE_UI_ICON_SPRING,
  ButtonRippleLayer,
  type ButtonRippleHandle,
} from "./buttonMotion";

export interface ButtonProps {
  children: ReactNode; // Button text or content
  size?: "sm" | "md"; // Button size
  variant?: "primary" | "outline" | "danger" | "ghost"; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: MouseEventHandler<HTMLButtonElement>; // Click handler
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaPressed?: boolean;
  title?: string;
  id?: string;
  name?: string;
  value?: string;
  form?: string;
  autoFocus?: boolean;
  disabled?: boolean; // Disabled state
  isLoading?: boolean; // Inline loading spinner state
  className?: string;
  type?: "button" | "submit" | "reset";
  hoverScale?: number; // Animate UI hover spring scale
  tapScale?: number; // Animate UI tap spring scale
  enableRipple?: boolean; // Animate UI pointer ripple feedback
}

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-4 py-3 text-sm",
  md: "px-5 py-3.5 text-sm",
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 hover:shadow-theme-sm disabled:bg-brand-300 dark:bg-brand-500 dark:hover:bg-brand-400",
  outline:
    "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3 dark:hover:text-gray-300",
  danger:
    "bg-error-600 text-white shadow-theme-xs hover:bg-error-700 hover:shadow-theme-sm disabled:bg-error-300 dark:bg-error-600 dark:hover:bg-error-500",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100",
};

const rippleVariantClasses: Record<NonNullable<ButtonProps["variant"]>, string> =
  {
    primary: "bg-white/35",
    outline: "bg-brand-500/15 dark:bg-white/20",
    danger: "bg-white/35",
    ghost: "bg-gray-400/25 dark:bg-white/20",
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    size = "md",
    variant = "primary",
    startIcon,
    endIcon,
    onClick,
    ariaLabel,
    ariaExpanded,
    ariaControls,
    ariaPressed,
    title,
    id,
    name,
    value,
    form,
    autoFocus = false,
    className = "",
    disabled = false,
    isLoading = false,
    type,
    hoverScale = 1.015,
    tapScale = 0.97,
    enableRipple = true,
  },
  ref,
) {
  const shouldReduceMotion = useReducedMotion();
  const rippleRef = useRef<ButtonRippleHandle>(null);
  const isDisabled = disabled || isLoading;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (isDisabled || !enableRipple || shouldReduceMotion) return;
      rippleRef.current?.spawn(event);
    },
    [enableRipple, isDisabled, shouldReduceMotion],
  );

  const motionStateProps =
    isDisabled || shouldReduceMotion
      ? {
          animate: { scale: 1, y: 0 },
        }
      : {
          whileHover: { scale: hoverScale, y: -1 },
          whileTap: { scale: tapScale, y: 0 },
        };

  return (
    <motion.button
      ref={ref}
      type={type}
      id={id}
      name={name}
      value={value}
      form={form}
      data-slot="button"
      transition={ANIMATE_UI_BUTTON_SPRING}
      {...motionStateProps}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-pressed={ariaPressed}
      aria-busy={isLoading || undefined}
      title={title}
      autoFocus={autoFocus}
      disabled={isDisabled}
      className={cn(
        "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        sizeClasses[size],
        variantClasses[variant],
        isDisabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {enableRipple && (
        <ButtonRippleLayer
          ref={rippleRef}
          rippleClassName={rippleVariantClasses[variant]}
        />
      )}
      {isLoading ? (
        <motion.span
          key="spinner"
          aria-hidden="true"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ANIMATE_UI_ICON_SPRING}
          className="relative z-1 inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
      ) : (
        startIcon && (
          <span className="relative z-1 inline-flex shrink-0 items-center justify-center transition-transform duration-200 ease-out">
            {startIcon}
          </span>
        )
      )}
      <span className="relative z-1 inline-flex items-center gap-2">
        {children}
      </span>
      {endIcon && (
        <span className="relative z-1 inline-flex shrink-0 items-center justify-center transition-transform duration-200 ease-out group-hover/btn:enabled:translate-x-0.5 rtl:group-hover/btn:enabled:-translate-x-0.5">
          {endIcon}
        </span>
      )}
    </motion.button>
  );
});

export default Button;
