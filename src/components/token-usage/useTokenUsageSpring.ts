"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * Smooth cubic-out number counter tween (650ms) modeled after DeepSeek Harness `useTween`.
 */
export function useTween(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState<number>(target);
  const currentRef = useRef<number>(target);

  useEffect(() => {
    const from = currentRef.current;
    const delta = target - from;
    let rafId = 0;

    if (Math.abs(delta) < 0.5) {
      rafId = requestAnimationFrame(() => {
        currentRef.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(rafId);
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const nextVal = from + delta * eased;
      currentRef.current = nextVal;
      setDisplay(nextVal);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setDisplay(target);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return display;
}

/**
 * Asymmetric spring pill glider modeled after DeepSeek Harness `useGlide`.
 * Leading edge snaps fast (stiffness 784, damping 48.2), trailing edge follows smoothly (stiffness 289, damping 29.2).
 */
export function useGlide<T extends HTMLElement = HTMLDivElement>(
  activeKey: string,
) {
  const containerElRef = useRef<T | null>(null);
  const thumbElRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useCallback((node: T | null) => {
    containerElRef.current = node;
  }, []);
  const thumbRef = useCallback((node: HTMLSpanElement | null) => {
    thumbElRef.current = node;
  }, []);
  const stateRef = useRef<{
    left: number;
    right: number;
    vLeft: number;
    vRight: number;
    targetLeft: number;
    targetRight: number;
    initialized: boolean;
    rafId: number;
  }>({
    left: 0,
    right: 0,
    vLeft: 0,
    vRight: 0,
    targetLeft: 0,
    targetRight: 0,
    initialized: false,
    rafId: 0,
  });

  useLayoutEffect(() => {
    const container = containerElRef.current;
    const thumb = thumbElRef.current;
    if (!container || !thumb) return;

    const measure = (immediate: boolean) => {
      const targetEl = container.querySelector<HTMLElement>(
        `[data-pill="${CSS.escape(activeKey)}"]`,
      );
      if (!targetEl) {
        thumb.style.opacity = "0";
        return;
      }
      const nextLeft = targetEl.offsetLeft;
      const nextRight = nextLeft + targetEl.offsetWidth;
      const st = stateRef.current;

      st.targetLeft = nextLeft;
      st.targetRight = nextRight;

      if (!st.initialized || immediate) {
        st.left = nextLeft;
        st.right = nextRight;
        st.vLeft = 0;
        st.vRight = 0;
        st.initialized = true;
        thumb.style.opacity = "1";
        thumb.style.transform = `translate3d(${nextLeft.toFixed(2)}px, 0, 0)`;
        thumb.style.width = `${Math.max(0, nextRight - nextLeft).toFixed(2)}px`;
        return;
      }

      thumb.style.opacity = "1";
      if (st.rafId) cancelAnimationFrame(st.rafId);

      let prevTime = performance.now();
      const goingRight = nextLeft >= st.left;
      const kLead = 784;
      const dLead = 48.2;
      const kTrail = 289;
      const dTrail = 29.2;

      const tick = (now: number) => {
        const dt = Math.min(0.032, Math.max(0.001, (now - prevTime) / 1000));
        prevTime = now;
        const steps = 4;
        const subDt = dt / steps;

        const kL = goingRight ? kTrail : kLead;
        const dL = goingRight ? dTrail : dLead;
        const kR = goingRight ? kLead : kTrail;
        const dR = goingRight ? dLead : dTrail;

        for (let i = 0; i < steps; i += 1) {
          const aL = -kL * (st.left - st.targetLeft) - dL * st.vLeft;
          st.vLeft += aL * subDt;
          st.left += st.vLeft * subDt;

          const aR = -kR * (st.right - st.targetRight) - dR * st.vRight;
          st.vRight += aR * subDt;
          st.right += st.vRight * subDt;
        }

        const width = Math.max(0, st.right - st.left);
        thumb.style.transform = `translate3d(${st.left.toFixed(2)}px, 0, 0)`;
        thumb.style.width = `${width.toFixed(2)}px`;

        const settled =
          Math.abs(st.left - st.targetLeft) < 0.25 &&
          Math.abs(st.right - st.targetRight) < 0.25 &&
          Math.abs(st.vLeft) < 2 &&
          Math.abs(st.vRight) < 2;

        if (settled) {
          st.left = st.targetLeft;
          st.right = st.targetRight;
          st.vLeft = 0;
          st.vRight = 0;
          thumb.style.transform = `translate3d(${st.left.toFixed(2)}px, 0, 0)`;
          thumb.style.width = `${Math.max(0, st.right - st.left).toFixed(2)}px`;
          st.rafId = 0;
        } else {
          st.rafId = requestAnimationFrame(tick);
        }
      };

      st.rafId = requestAnimationFrame(tick);
    };

    measure(false);

    const observer = new ResizeObserver(() => measure(true));
    observer.observe(container);
    const st = stateRef.current;

    return () => {
      observer.disconnect();
      if (st.rafId) {
        cancelAnimationFrame(st.rafId);
        st.rafId = 0;
      }
    };
  }, [activeKey]);

  return { containerRef, thumbRef };
}
