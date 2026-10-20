"use client";

import { useEffect, useRef, useState } from "react";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export default function HeroDecorations() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

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
      const container =
        containerRef.current?.closest("section") ||
        containerRef.current?.parentElement ||
        containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Start at top of page, scroll down through hero
      const totalDistance = rect.height + viewportHeight * 0.5;
      const distance = -rect.top;
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
    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setMouseOffset({
        x: (e.clientX - cx) / cx,
        y: (e.clientY - cy) / cy,
      });
    };

    updateScrollTarget();
    rafId = requestAnimationFrame(animateLoop);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      preference?.removeEventListener?.("change", onPreferenceChange);
    };
  }, []);

  const leftX = isReducedMotion ? 0 : lerp(0, -60, scrollProgress) + mouseOffset.x * -12;
  const leftY = isReducedMotion ? 0 : lerp(0, -140, scrollProgress) + mouseOffset.y * -10;
  const leftRotate = isReducedMotion ? 0 : lerp(0, -6, scrollProgress);

  const rightX = isReducedMotion ? 0 : lerp(0, 70, scrollProgress) + mouseOffset.x * 15;
  const rightY = isReducedMotion ? 0 : lerp(0, -110, scrollProgress) + mouseOffset.y * 12;
  const rightRotate = isReducedMotion ? 0 : lerp(0, 5, scrollProgress);

  const leftStyle: React.CSSProperties = isReducedMotion
    ? {}
    : {
        transform: `translate3d(${leftX.toFixed(2)}px, ${leftY.toFixed(2)}px, 0) rotate(${leftRotate.toFixed(2)}deg)`,
        willChange: "transform",
        transition: "transform 0.05s linear",
      };

  const rightStyle: React.CSSProperties = isReducedMotion
    ? {}
    : {
        transform: `translate3d(${rightX.toFixed(2)}px, ${rightY.toFixed(2)}px, 0) rotate(${rightRotate.toFixed(2)}deg)`,
        willChange: "transform",
        transition: "transform 0.05s linear",
      };

  return (
    <div ref={containerRef} className={styles.heroDecorations} aria-hidden="true">
      <div className={styles.heroDecLeft} style={leftStyle}>
        <div className={styles.heroFloatingLeft}>
          <ReferenceImage
            file="knowledge-left.svg"
            width={1306}
            height={1595}
            priority
            className={styles.heroDecImg}
          />
        </div>
      </div>
      <div className={styles.heroDecRight} style={rightStyle}>
        <div className={styles.heroFloatingRight}>
          <ReferenceImage
            file="knowledge-right.svg"
            width={1494}
            height={1844}
            priority
            className={styles.heroDecImg}
          />
        </div>
      </div>
    </div>
  );
}
