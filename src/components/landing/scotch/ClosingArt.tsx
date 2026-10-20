"use client";

import { useEffect, useRef, useState } from "react";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export default function ClosingArt() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const preference =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    const onPreferenceChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    preference?.addEventListener?.("change", onPreferenceChange);

    if (preference?.matches) {
      return () => preference.removeEventListener("change", onPreferenceChange);
    }

    let rafId = 0;
    let targetProgress = 0;
    let currentProgress = 0;

    const updateScrollTarget = () => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const start = viewportHeight * 0.85;
      const totalDistance = rect.height + start;
      const distance = start - rect.top;
      const rawProgress = distance / totalDistance;

      targetProgress = Math.max(0, Math.min(1, rawProgress));
    };

    const animateLoop = () => {
      const delta = targetProgress - currentProgress;
      if (Math.abs(delta) > 0.0005) {
        currentProgress += delta * 0.1;
        setScrollProgress(currentProgress);
      } else if (currentProgress !== targetProgress) {
        currentProgress = targetProgress;
        setScrollProgress(currentProgress);
      }
      rafId = requestAnimationFrame(animateLoop);
    };

    const onScroll = () => updateScrollTarget();
    const onResize = () => updateScrollTarget();

    updateScrollTarget();
    rafId = requestAnimationFrame(animateLoop);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      preference?.removeEventListener?.("change", onPreferenceChange);
    };
  }, []);

  const translateY = isReducedMotion ? 0 : lerp(25, -25, scrollProgress);
  const scale = isReducedMotion ? 1 : lerp(0.96, 1.02, scrollProgress);

  const style: React.CSSProperties = isReducedMotion
    ? {}
    : {
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
        willChange: "transform",
        transition: "transform 0.05s linear",
      };

  return (
    <div ref={containerRef} className={styles.closingArt} style={style}>
      <div className={styles.closingArtFloating}>
        <ReferenceImage
          file="handover-art.svg"
          width={1854}
          height={1729}
          sizes="(max-width: 767px) 94vw, 50vw"
        />
      </div>
    </div>
  );
}
