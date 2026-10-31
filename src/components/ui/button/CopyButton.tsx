"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { CheckLineIcon, CopyIcon } from "@/icons";
import { cn } from "@/utils";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ANIMATE_UI_ICON_SPRING,
  ButtonRippleLayer,
  type ButtonRippleHandle,
} from "./buttonMotion";

export interface CopyButtonProps {
  content: string;
  children?: ReactNode;
  copiedLabel?: ReactNode;
  ariaLabel?: string;
  copiedAriaLabel?: string;
  size?: "sm" | "md";
  variant?: "outline" | "ghost" | "subtle";
  copiedDuration?: number;
  disabled?: boolean;
  className?: string;
  onCopy?: (content: string) => void;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const sizeClasses: Record<NonNullable<CopyButtonProps["size"]>, string> = {
  sm: "h-8 min-w-8 px-2.5 text-xs",
  md: "h-9 min-w-9 px-3 text-sm",
};

const variantClasses: Record<NonNullable<CopyButtonProps["variant"]>, string> =
  {
    outline:
      "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-100",
    ghost:
      "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100",
    subtle:
      "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15 hover:bg-brand-100/80 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25",
  };

/**
 * Animate UI-inspired CopyButton with spring press feedback and smooth
 * CopyIcon <-> CheckLineIcon state morph.
 */
const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  function CopyButton(
    {
      content,
      children,
      copiedLabel,
      ariaLabel,
      copiedAriaLabel,
      size = "sm",
      variant = "outline",
      copiedDuration = 2000,
      disabled = false,
      className,
      onCopy,
      onClick,
    },
    ref,
  ) {
    const t = useTranslations("common");
    const shouldReduceMotion = useReducedMotion();
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rippleRef = useRef<ButtonRippleHandle>(null);

    useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (disabled || shouldReduceMotion) return;
        rippleRef.current?.spawn(event);
      },
      [disabled, shouldReduceMotion],
    );

    const handleClick: MouseEventHandler<HTMLButtonElement> = useCallback(
      async (event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;

        try {
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(content);
          }
          setCopied(true);
          onCopy?.(content);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setCopied(false);
          }, copiedDuration);
        } catch {
          // Ignore clipboard permission rejections cleanly without crashing UI.
        }
      },
      [content, copiedDuration, disabled, onClick, onCopy],
    );

    const motionStateProps =
      disabled || shouldReduceMotion
        ? { animate: { scale: 1 } }
        : {
            whileHover: { scale: 1.03, y: -0.5 },
            whileTap: { scale: 0.94, y: 0 },
          };

    const resolvedAriaLabel = copied
      ? (copiedAriaLabel ?? t("copied"))
      : (ariaLabel ?? t("copy"));

    return (
      <motion.button
        ref={ref}
        type="button"
        data-slot="button"
        data-copied={copied ? "true" : "false"}
        transition={ANIMATE_UI_BUTTON_SPRING}
        {...motionStateProps}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        aria-label={resolvedAriaLabel}
        title={resolvedAriaLabel}
        disabled={disabled}
        className={cn(
          "relative inline-flex select-none items-center justify-center gap-1.5 overflow-hidden rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          sizeClasses[size],
          variantClasses[variant],
          copied &&
            "bg-success-50/70 text-success-700 ring-success-500/35 hover:bg-success-50 hover:text-success-700 dark:bg-success-500/10 dark:text-success-400 dark:ring-success-500/40 dark:hover:bg-success-500/15 dark:hover:text-success-300",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <ButtonRippleLayer
          ref={rippleRef}
          rippleClassName="bg-brand-500/15 dark:bg-white/20"
        />
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={
            shouldReduceMotion ? false : { scale: 0.55, opacity: 0, rotate: -10 }
          }
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={ANIMATE_UI_ICON_SPRING}
          className="relative z-1 inline-flex size-4 shrink-0 items-center justify-center"
        >
          {copied ? (
            <CheckLineIcon aria-hidden="true" className="size-4" />
          ) : (
            <CopyIcon aria-hidden="true" className="size-4" />
          )}
        </motion.span>
        {(children || (copied && copiedLabel)) && (
          <span className="relative z-1 whitespace-nowrap">
            {copied && copiedLabel ? copiedLabel : children}
          </span>
        )}
      </motion.button>
    );
  },
);

export default CopyButton;
