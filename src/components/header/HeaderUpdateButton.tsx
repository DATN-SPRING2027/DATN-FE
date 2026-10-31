"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import {
  ANIMATE_UI_BUTTON_SPRING,
  ButtonRippleLayer,
  type ButtonRippleHandle,
} from "@/components/ui/button/buttonMotion";
import { cn } from "@/utils";

export default function HeaderUpdateButton() {
  const t = useTranslations("header");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const rippleRef = useRef<ButtonRippleHandle>(null);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedPlan(null);
  };

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (shouldReduceMotion) return;
      rippleRef.current?.spawn(event);
    },
    [shouldReduceMotion],
  );

  const triggerMotionProps = shouldReduceMotion
    ? undefined
    : {
        whileHover: { scale: 1.025, y: -0.5 },
        whileTap: { scale: 0.965, y: 0 },
      };

  return (
    <>
      <motion.button
        type="button"
        data-slot="button"
        transition={ANIMATE_UI_BUTTON_SPRING}
        {...triggerMotionProps}
        onPointerDown={handlePointerDown}
        onClick={() => setIsOpen(true)}
        className="relative inline-flex h-9 select-none items-center gap-1.5 overflow-hidden rounded-lg border border-brand-200 bg-brand-50/60 px-3 text-theme-xs font-semibold text-brand-600 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/20"
      >
        <ButtonRippleLayer
          ref={rippleRef}
          rippleClassName="bg-brand-500/15 dark:bg-brand-400/25"
        />
        <svg
          aria-hidden="true"
          className="relative z-1 shrink-0"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
        </svg>
        <span className="relative z-1">{t("update")}</span>
      </motion.button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        className="mx-4 max-w-4xl p-6 sm:p-8"
      >
        <div className="text-start">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
            </svg>
            {t("upgradeModal.badge")}
          </span>
          <h3 className="mt-3 text-title-sm font-bold text-gray-900 dark:text-white">
            {t("upgradeModal.title")}
          </h3>
          <p className="mt-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
            {t("upgradeModal.subtitle")}
          </p>

          {selectedPlan && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-theme-sm font-medium text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400"
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{t("upgradeModal.demoNotice", { plan: selectedPlan })}</span>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Free / Standard Plan */}
            <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-white/3">
              <div>
                <h4 className="text-theme-xl font-semibold text-gray-900 dark:text-white">
                  {t("upgradeModal.plans.free.name")}
                </h4>
                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("upgradeModal.plans.free.description")}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-title-md font-bold text-gray-900 tabular-nums dark:text-white">
                    {t("upgradeModal.plans.free.price")}
                  </span>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("upgradeModal.perMemberMonth")}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5 text-theme-xs text-gray-600 dark:text-gray-300">
                  {(["f1", "f2", "f3"] as const).map((fKey) => (
                    <li key={fKey} className="flex items-start gap-2">
                      <svg
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-gray-400"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span>{t(`upgradeModal.plans.free.${fKey}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="mt-6 w-full rounded-xl py-2.5 text-theme-xs font-semibold"
              >
                {t("upgradeModal.currentPlan")}
              </Button>
            </div>

            {/* Plus / Pro Plan */}
            <div
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border-2 border-brand-500 bg-white p-5 shadow-theme-md dark:border-brand-500 dark:bg-gray-900",
              )}
            >
              <span className="inset-e-4 absolute -top-3 rounded-full bg-brand-500 px-2.5 py-0.5 text-theme-xs font-semibold text-white">
                {t("upgradeModal.recommended")}
              </span>
              <div>
                <h4 className="text-theme-xl font-semibold text-gray-900 dark:text-white">
                  {t("upgradeModal.plans.pro.name")}
                </h4>
                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("upgradeModal.plans.pro.description")}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-title-md font-bold text-gray-900 tabular-nums dark:text-white">
                    {t("upgradeModal.plans.pro.price")}
                  </span>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("upgradeModal.perMemberMonth")}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5 text-theme-xs text-gray-700 dark:text-gray-200">
                  {(["f1", "f2", "f3", "f4"] as const).map((fKey) => (
                    <li key={fKey} className="flex items-start gap-2">
                      <svg
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-brand-500 dark:text-brand-400"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span>{t(`upgradeModal.plans.pro.${fKey}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setSelectedPlan(t("upgradeModal.plans.pro.name"))}
                className="mt-6 w-full rounded-xl py-2.5 text-theme-xs font-semibold"
              >
                {t("upgradeModal.upgradeNow")}
              </Button>
            </div>

            {/* Enterprise Plan */}
            <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-white/3">
              <div>
                <h4 className="text-theme-xl font-semibold text-gray-900 dark:text-white">
                  {t("upgradeModal.plans.enterprise.name")}
                </h4>
                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("upgradeModal.plans.enterprise.description")}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-title-md font-bold text-gray-900 tabular-nums dark:text-white">
                    {t("upgradeModal.plans.enterprise.price")}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5 text-theme-xs text-gray-600 dark:text-gray-300">
                  {(["f1", "f2", "f3"] as const).map((fKey) => (
                    <li key={fKey} className="flex items-start gap-2">
                      <svg
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-brand-500 dark:text-brand-400"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span>{t(`upgradeModal.plans.enterprise.${fKey}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedPlan(t("upgradeModal.plans.enterprise.name"))
                }
                className="mt-6 w-full rounded-xl py-2.5 text-theme-xs font-semibold"
              >
                {t("upgradeModal.contactSales")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
