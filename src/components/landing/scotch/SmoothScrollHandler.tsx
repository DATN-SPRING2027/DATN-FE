"use client";

import { useEffect } from "react";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function scrollToTarget(targetId: string, duration = 1200) {
  if (typeof window === "undefined") return;

  const targetElement = document.getElementById(targetId);
  if (!targetElement) return;

  const preference =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  if (preference?.matches) {
    targetElement.scrollIntoView({ behavior: "auto" });
    return;
  }

  const startPosition = window.pageYOffset;
  const headerOffset = 70; // Scotch sticky navbar height
  const elementPosition = targetElement.getBoundingClientRect().top;
  const targetPosition = elementPosition + startPosition - headerOffset;
  const distance = targetPosition - startPosition;

  if (Math.abs(distance) < 2) return;

  let startTime: number | null = null;
  let userInterrupted = false;

  const onUserInterrupt = () => {
    userInterrupted = true;
    cleanup();
  };

  const onKeyInterrupt = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Space"].includes(e.code)) {
      onUserInterrupt();
    }
  };

  const cleanup = () => {
    window.removeEventListener("wheel", onUserInterrupt);
    window.removeEventListener("touchmove", onUserInterrupt);
    window.removeEventListener("keydown", onKeyInterrupt);
  };

  window.addEventListener("wheel", onUserInterrupt, { passive: true });
  window.addEventListener("touchmove", onUserInterrupt, { passive: true });
  window.addEventListener("keydown", onKeyInterrupt, { passive: true });

  const animation = (currentTime: number) => {
    if (userInterrupted) return;
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);
    const ease = easeInOutCubic(progress);

    window.scrollTo(0, startPosition + distance * ease);

    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    } else {
      cleanup();
    }
  };

  requestAnimationFrame(animation);
}

export default function SmoothScrollHandler() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || !href.startsWith("#") || href === "#") return;

      const targetId = href.slice(1);
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return;

      e.preventDefault();
      window.history.pushState(null, "", href);
      scrollToTarget(targetId, 1200);
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  return null;
}
