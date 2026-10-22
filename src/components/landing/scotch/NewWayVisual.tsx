"use client";

import { useEffect, useRef, useState } from "react";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

interface NewWayVisualProps {
  alt: string;
}

export default function NewWayVisual({ alt }: NewWayVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

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
      queueMicrotask(() => setIsReducedMotion(true));
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

      // Scotch offset: ["start center", "end end"]
      const start = viewportHeight * 0.75;
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

  // Scotch transform: slide in from right and scale smoothly
  // At progress 0 (before entering): translated right 120px, scale 0.94, opacity 0.85
  // At progress >= 0.5 (in view): translated to 0px, scale 1.0, opacity 1.0
  const normalizedP = Math.min(1, scrollProgress * 2);
  const translateX = isReducedMotion ? 0 : lerp(120, 0, normalizedP);
  const scale = isReducedMotion ? 1 : lerp(0.94, 1.0, normalizedP);
  const opacity = isReducedMotion ? 1 : lerp(0.85, 1.0, normalizedP);

  const style: React.CSSProperties = isReducedMotion
    ? {}
    : {
        transform: `translate3d(${translateX.toFixed(2)}px, 0, 0) scale(${scale.toFixed(3)})`,
        opacity: opacity.toFixed(2),
        willChange: "transform, opacity",
        transition: "transform 0.05s linear",
      };

  return (
    <div ref={containerRef} className={styles.newArtWrapper} style={style}>
      <div className={styles.newArtFloating}>
        <ReferenceImage
          file="connected-workspace.svg"
          width={2661}
          height={1699}
          className={styles.newArt}
          sizes="(max-width: 1000px) 100vw, 900px"
          alt={alt}
        />
      </div>
    </div>
  );
}
