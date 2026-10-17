"use client";

import { useEffect, useState, type RefObject } from "react";

/** One playback policy for decorative video and the knowledge illustration. */
export default function useAmbientMotion(
  target: RefObject<HTMLElement | null>,
) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      setPlaying(visible && !document.hidden && !reducedMotion.matches);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    reducedMotion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [target]);

  return { playing };
}
