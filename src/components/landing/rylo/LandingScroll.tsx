"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import styles from "./landing.module.css";

interface LandingScrollProps {
  children: ReactNode;
}

export default function LandingScroll({ children }: LandingScrollProps) {
  const frame = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  useEffect(() => {
    const interrupt = (event: KeyboardEvent) => {
      if (
        [
          "Escape",
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        cancel();
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("keydown", interrupt);
    return () => {
      cancel();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", interrupt);
    };
  }, [cancel]);

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
        : null;
    if (
      !anchor ||
      anchor.target === "_blank" ||
      anchor.hasAttribute("download")
    )
      return;
    const target = document.getElementById(anchor.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    cancel();
    const start = window.scrollY;
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const end = Math.max(
      0,
      Math.min(
        start + target.getBoundingClientRect().top - margin,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
    const finish = () => {
      frame.current = null;
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener(
          "blur",
          () => target.removeAttribute("tabindex"),
          { once: true },
        );
      }
      target.focus({ preventScroll: true });
    };
    if (window.location.hash !== anchor.hash)
      window.history.pushState(null, "", anchor.hash);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, end);
      finish();
      return;
    }
    const duration = Math.min(
      1600,
      Math.max(1000, Math.abs(end - start) * 0.4),
    );
    let began: number | null = null;
    const step = (time: number) => {
      began ??= time;
      const progress = Math.min((time - began) / duration, 1);
      const eased =
        progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      window.scrollTo(0, start + (end - start) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else finish();
    };
    frame.current = requestAnimationFrame(step);
  }

  return (
    <div className={styles.landing} onClick={navigate}>
      {children}
    </div>
  );
}
