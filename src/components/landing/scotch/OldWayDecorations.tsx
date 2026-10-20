"use client";

import { useEffect, useRef, useState } from "react";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

// Scotch motion choreography
const DESKTOP_CONFIGS = [
  { file: "scattered-note.svg", width: 496, height: 552, x: [0, -250], y: [0, -150], rotate: [4, 50], scale: [1, 0.85] },
  { file: "scattered-message.svg", width: 397, height: 250, x: [0, -190], y: [0, -100], rotate: [0, -10], scale: [1, 1.15] },
  { file: "scattered-checklist.svg", width: 499, height: 545, x: [0, -255], y: [0, -150], rotate: [1.85, -40], scale: [1, 0.9] },
  { file: "scattered-right.svg", width: 855, height: 1744, x: [0, 350], y: [0, -40], rotate: [0, 20], scale: [1, 0.75] },
] as const;

const MOBILE_CONFIGS = [
  { file: "scattered-left.svg", width: 375, height: 911, x: [0, -60], y: [0, -35], rotate: [0, -6] },
  { file: "scattered-right.svg", width: 462, height: 1122, x: [0, 60], y: [0, -25], rotate: [0, 6] },
] as const;

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export default function OldWayDecorations({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
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

      // Start when top enters middle of viewport; end when bottom leaves top
      const start = viewportHeight * 0.75;
      const totalDistance = rect.height + start;
      const distance = start - rect.top;
      const rawProgress = distance / totalDistance;

      targetProgress = Math.max(0, Math.min(1, rawProgress));
    };

    const animateLoop = () => {
      // Smooth spring-like lerping
      const delta = targetProgress - currentProgress;
      if (Math.abs(delta) > 0.0005) {
        currentProgress += delta * 0.12;
        setScrollProgress(currentProgress);
      } else if (currentProgress !== targetProgress) {
        currentProgress = targetProgress;
        setScrollProgress(currentProgress);
      }
      rafId = requestAnimationFrame(animateLoop);
    };

    const onScroll = () => {
      updateScrollTarget();
    };

    const onResize = () => {
      updateScrollTarget();
    };

    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const mx = (e.clientX - cx) / cx;
      const my = (e.clientY - cy) / cy;
      setMouseOffset({ x: mx, y: my });
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

  if (variant === "mobile") {
    return (
      <div
        ref={containerRef}
        className={styles.mobileOldArt}
        aria-hidden="true"
      >
        {MOBILE_CONFIGS.map((item, index) => {
          const x = isReducedMotion ? 0 : lerp(item.x[0], item.x[1], scrollProgress);
          const y = isReducedMotion ? 0 : lerp(item.y[0], item.y[1], scrollProgress);
          const rot = isReducedMotion ? 0 : lerp(item.rotate[0], item.rotate[1], scrollProgress);

          const transformStyle: React.CSSProperties = isReducedMotion
            ? {}
            : {
                transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`,
                willChange: "transform",
                transition: "transform 0.05s linear",
              };

          return (
            <div
              key={item.file}
              className={`${styles.mobileArtCard} ${styles[`mobileArtCard${index}`]}`}
              style={transformStyle}
            >
              <div className={styles[`floatingInner${index}`]}>
                <ReferenceImage
                  file={item.file}
                  width={item.width}
                  height={item.height}
                  className={styles.mobileArtImg}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.oldDecorations}
      aria-hidden="true"
    >
      {DESKTOP_CONFIGS.map((item, index) => {
        const mouseMultiplier = (index % 2 === 0 ? 1 : -1) * (10 + index * 4);
        const mouseX = isReducedMotion ? 0 : mouseOffset.x * mouseMultiplier;
        const mouseY = isReducedMotion ? 0 : mouseOffset.y * mouseMultiplier;

        const x = isReducedMotion ? 0 : lerp(item.x[0], item.x[1], scrollProgress) + mouseX;
        const y = isReducedMotion ? 0 : lerp(item.y[0], item.y[1], scrollProgress) + mouseY;
        const rot = isReducedMotion
          ? item.rotate[0]
          : lerp(item.rotate[0], item.rotate[1], scrollProgress);
        const scale = isReducedMotion
          ? 1
          : lerp(item.scale[0], item.scale[1], scrollProgress);

        const transformStyle: React.CSSProperties = isReducedMotion
          ? {}
          : {
              transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
              willChange: "transform",
              transition: "transform 0.05s linear",
            };

        return (
          <div
            key={item.file}
            className={`${styles.decorationCard} ${styles[`decorationCard${index}`]}`}
            style={transformStyle}
          >
            <div className={styles[`floatingInner${index}`]}>
              <ReferenceImage
                file={item.file}
                width={item.width}
                height={item.height}
                className={styles.decorationImg}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
