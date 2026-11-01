"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";
import "./OrganizationTransition.css";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

export interface OrganizationTransitionProps {
  organizationName: string;
  /** True only AFTER organization switching/auth + data needed for navigation are ready. */
  ready: boolean;
  /** Navigate to the workspace here. Use a router, not window.location, for SPA transitions. */
  onComplete: () => void;
  /** Default matches public/continuum-ai-logo.png */
  logoSrc?: string;
}

const WORDMARK_LETTERS = Array.from("Continuum");

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

function supportsSvgPathGeometry(root: HTMLElement | null): boolean {
  if (!root) return false;
  const path = root.querySelector<SVGPathElement>("path.cnt-streak");
  return Boolean(
    path &&
      typeof path.getTotalLength === "function" &&
      typeof path.getBBox === "function",
  );
}

export default function OrganizationTransition({
  organizationName,
  ready,
  onComplete,
  logoSrc = "/continuum-ai-logo.png",
}: OrganizationTransitionProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [introDone, setIntroDone] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const isIntroFinished = reducedMotion || introDone;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useGSAP(
    () => {
      const root = scopeRef.current;
      const canDrawSvg = supportsSvgPathGeometry(root);

      if (reducedMotion) {
        if (canDrawSvg) {
          gsap.set(".cnt-streak", { drawSVG: "100%", autoAlpha: 0.25 });
        } else {
          gsap.set(".cnt-streak", { autoAlpha: 0.25 });
        }
        gsap.set(
          ".cnt-logo, .cnt-logo-halo, .cnt-letter, .cnt-ambient, .cnt-grid, .cnt-eyebrow, .cnt-subtitle",
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            yPercent: 0,
            filter: "none",
          },
        );
        return;
      }

      if (canDrawSvg) {
        gsap.set(".cnt-streak", { drawSVG: "0%", autoAlpha: 1 });
      } else {
        gsap.set(".cnt-streak", { autoAlpha: 0 });
      }
      gsap.set(".cnt-logo", {
        autoAlpha: 0,
        scale: 0.82,
        filter: "blur(14px)",
      });
      gsap.set(".cnt-logo-halo", { autoAlpha: 0, scale: 0.65 });
      gsap.set(".cnt-letter", {
        autoAlpha: 0,
        yPercent: 108,
        filter: "blur(6px)",
      });
      gsap.set(".cnt-ambient", { autoAlpha: 0, scale: 0.76 });
      gsap.set(".cnt-orbit", { autoAlpha: 0, scale: 0.88, rotation: -14 });
      gsap.set(".cnt-dot", { autoAlpha: 0, scale: 0 });
      gsap.set(".cnt-eyebrow, .cnt-subtitle", { autoAlpha: 0, y: 10 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Phase 1 — Neural Awakening (0.00–0.80s)
      tl.to(".cnt-ambient", { autoAlpha: 1, scale: 1, duration: 0.8 }, 0)
        .from(".cnt-grid", { autoAlpha: 0, duration: 0.8 }, 0)
        .to(
          ".cnt-orbit",
          {
            autoAlpha: 1,
            scale: 1,
            rotation: 0,
            duration: 0.88,
            stagger: 0.1,
          },
          0.1,
        )
        .to(
          ".cnt-streak",
          canDrawSvg
            ? {
                drawSVG: "100%",
                duration: 1.22,
                stagger: 0.14,
                ease: "power2.inOut",
              }
            : {
                autoAlpha: 0.74,
                duration: 1.22,
                stagger: 0.14,
                ease: "power2.inOut",
              },
          0.16,
        )
        .to(
          ".cnt-dot",
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.48,
            stagger: 0.11,
            ease: "back.out(1.4)",
          },
          0.32,
        )
        // Phase 2 — Brand Formation (0.80–1.65s)
        .to(
          ".cnt-logo-halo",
          { autoAlpha: 1, scale: 1, duration: 0.85, ease: "power2.out" },
          0.78,
        )
        .to(
          ".cnt-logo",
          {
            autoAlpha: 1,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.87,
            ease: "power3.out",
          },
          0.8,
        )
        // Phase 3 — Identity Reveal (1.30–2.20s)
        .to(".cnt-eyebrow", { autoAlpha: 1, y: 0, duration: 0.46 }, 1.04)
        .to(
          ".cnt-letter",
          {
            autoAlpha: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.5,
            stagger: 0.032,
            ease: "power3.out",
          },
          1.3,
        )
        .to(".cnt-subtitle", { autoAlpha: 1, y: 0, duration: 0.44 }, 1.72)
        .to(".cnt-streak", { autoAlpha: 0.15, duration: 0.42 }, 1.82)
        // Sequence reaches full identity reveal at 2.22s; Phase 4 exit runs 2.22–2.70s once `ready` is true.
        .call(() => setIntroDone(true), undefined, 2.22);

      // Subtle ambient breathing while holding for slow backend responses; cleaned up automatically on unmount.
      gsap.to(".cnt-aura", {
        scale: 1.07,
        opacity: 0.84,
        duration: 2.1,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(".cnt-orbit--inner", {
        rotation: 7,
        duration: 7,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(".cnt-dot", {
        y: -6,
        duration: 1.8,
        stagger: 0.27,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: scopeRef, dependencies: [reducedMotion] },
  );

  // Phase 4 — Enter Workspace (2.22–2.70s). Never navigates until `ready` is true.
  useEffect(() => {
    if (!isIntroFinished || !ready || completedRef.current) return;

    if (reducedMotion) {
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }

    const root = scopeRef.current;
    if (!root) return;
    const stage = root.querySelector(".cnt-stage");
    const bloom = root.querySelector(".cnt-exit-bloom");
    const cover = root.querySelector(".cnt-cover");
    if (!stage || !bloom || !cover) return;

    const tl = gsap.timeline({
      onComplete: () => {
        if (completedRef.current) return;
        completedRef.current = true;
        onCompleteRef.current();
      },
    });
    tl.to(
      stage,
      {
        opacity: 0,
        scale: 1.055,
        filter: "blur(10px)",
        duration: 0.38,
        ease: "power2.in",
      },
      0,
    )
      .fromTo(
        bloom,
        { opacity: 0, scale: 0.42 },
        {
          opacity: 0.68,
          scale: 1.32,
          duration: 0.32,
          ease: "power2.out",
        },
        0.04,
      )
      .to(
        cover,
        { opacity: 1, duration: 0.22, ease: "power1.inOut" },
        0.26,
      );

    return () => {
      tl.kill();
    };
  }, [isIntroFinished, ready, reducedMotion]);

  const overlay = (
    <div
      ref={scopeRef}
      data-testid="organization-neural-transition"
      className="cnt-transition"
      role="status"
      aria-live="polite"
      aria-busy={!ready}
      aria-label={`Opening ${organizationName} workspace`}
    >
      <div className="cnt-grid" aria-hidden="true" />
      <div className="cnt-ambient" aria-hidden="true" />
      <div className="cnt-aura" aria-hidden="true" />
      <div className="cnt-orbit cnt-orbit--outer" aria-hidden="true" />
      <div className="cnt-orbit cnt-orbit--inner" aria-hidden="true" />

      <svg
        className="cnt-paths"
        viewBox="0 0 1000 700"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="cnt-neural-a" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#177AFF" stopOpacity="0" />
            <stop offset=".37" stopColor="#75D9FF" stopOpacity=".8" />
            <stop offset=".65" stopColor="#8074FF" stopOpacity=".9" />
            <stop offset="1" stopColor="#2360FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cnt-neural-b" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#2937FF" stopOpacity="0" />
            <stop offset=".46" stopColor="#3CA8FF" stopOpacity=".6" />
            <stop offset=".7" stopColor="#C6A1FF" stopOpacity=".75" />
            <stop offset="1" stopColor="#2460FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="cnt-streak"
          d="M 32 355 C 172 65 320 95 480 360 C 635 617 791 618 968 340"
          fill="none"
          stroke="url(#cnt-neural-a)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          className="cnt-streak"
          d="M 28 415 C 192 630 334 615 500 345 C 666 65 800 90 975 396"
          fill="none"
          stroke="url(#cnt-neural-b)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>

      <span className="cnt-dot cnt-dot--one" aria-hidden="true" />
      <span className="cnt-dot cnt-dot--two" aria-hidden="true" />
      <span className="cnt-dot cnt-dot--three" aria-hidden="true" />

      <div className="cnt-stage">
        <div className="cnt-logo-wrap">
          <div className="cnt-logo-halo" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cnt-logo" src={logoSrc} alt="" draggable="false" />
        </div>
        <p className="cnt-eyebrow">YOUR KNOWLEDGE, CONNECTED</p>
        <h1 className="cnt-wordmark" aria-label="Continuum AI">
          <span className="cnt-wordmark-first" aria-hidden="true">
            {WORDMARK_LETTERS.map((letter, index) => (
              <span className="cnt-char-clip" key={index}>
                <span className="cnt-letter">{letter}</span>
              </span>
            ))}
          </span>
          <span className="cnt-wordmark-ai" aria-hidden="true">
            <span className="cnt-char-clip">
              <span className="cnt-letter">A</span>
            </span>
            <span className="cnt-char-clip">
              <span className="cnt-letter">I</span>
            </span>
          </span>
        </h1>
        <div className="cnt-subtitle">
          <span className="cnt-mini-pulse" aria-hidden="true" />
          <span>{ready ? "Workspace ready" : "Connecting workspace"}</span>
          <span className="cnt-subtitle-separator">/</span>
          <span className="cnt-org-name">{organizationName}</span>
        </div>
      </div>
      <div className="cnt-exit-bloom" aria-hidden="true" />
      <div className="cnt-cover" aria-hidden="true" />
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }
  return createPortal(overlay, document.body);
}
