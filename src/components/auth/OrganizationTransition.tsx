"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import "./OrganizationTransition.css";

export interface OrganizationTransitionProps {
  organizationName: string;
  /** True only AFTER organization switching/auth + data needed for navigation are ready. */
  ready: boolean;
  /** Navigate to the workspace here. Use a router, not window.location, for SPA transitions. */
  onComplete: () => void;
  /** Default matches public/continuum-ai-logo.png */
  logoSrc?: string;
}

const EXIT_TRANSITION_MS = 160;

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => undefined;
  }
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener?.("change", onStoreChange);
  return () => media.removeEventListener?.("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export default function OrganizationTransition({
  organizationName,
  ready,
  onComplete,
  logoSrc = "/continuum-ai-logo.png",
}: OrganizationTransitionProps) {
  const t = useTranslations("auth");
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!ready || completedRef.current) return;

    if (reducedMotion) {
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }

    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    }, EXIT_TRANSITION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ready, reducedMotion]);

  const overlay = (
    <div
      data-testid="organization-neural-transition"
      className={
        ready && !reducedMotion
          ? "cnt-transition cnt-transition--exiting"
          : "cnt-transition"
      }
      role="status"
      aria-live="polite"
      aria-busy={!ready}
      aria-label={t("transitionAriaLabel", { organizationName })}
    >
      <div className="cnt-grid" aria-hidden="true" />
      <div className="cnt-ambient" aria-hidden="true" />
      <div className="cnt-aura" aria-hidden="true" />
      <div className="cnt-orbit cnt-orbit--outer" aria-hidden="true" />
      <div className="cnt-orbit cnt-orbit--inner" aria-hidden="true" />

      <span className="cnt-dot cnt-dot--one" aria-hidden="true" />
      <span className="cnt-dot cnt-dot--two" aria-hidden="true" />
      <span className="cnt-dot cnt-dot--three" aria-hidden="true" />

      <div className="cnt-stage">
        <div className="cnt-logo-wrap">
          <div className="cnt-logo-halo" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cnt-logo" src={logoSrc} alt="" draggable="false" />
        </div>
        <p className="cnt-eyebrow">{t("transitionEyebrow")}</p>
        <h1 className="cnt-wordmark" aria-label="Continuum AI">
          <span className="cnt-wordmark-first" aria-hidden="true">
            Continuum
          </span>
          <span className="cnt-wordmark-ai" aria-hidden="true">
            AI
          </span>
        </h1>
        <div className="cnt-subtitle">
          <span className="cnt-mini-pulse" aria-hidden="true" />
          <span>
            {ready ? t("transitionReady") : t("transitionConnecting")}
          </span>
          <span className="cnt-subtitle-separator">/</span>
          <span className="cnt-org-name">{organizationName}</span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }
  return createPortal(overlay, document.body);
}
