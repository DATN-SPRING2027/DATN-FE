"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./scotch.module.css";

interface OldWayCopyProps {
  label: string;
  lead: string;
  rest: string;
  conclusion: string;
}

export default function OldWayCopy({
  label,
  lead,
  rest,
  conclusion,
}: OldWayCopyProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [visibleWords, setVisibleWords] = useState<number | null>(null);
  const words = `${lead} ${rest}`.split(" ");
  const wordCount = words.length;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (preference.matches) {
        setVisibleWords(null);
        return;
      }
      const rect = heading.current?.getBoundingClientRect();
      if (!rect) return;
      const progress = Math.max(
        0,
        Math.min(
          1,
          (window.innerHeight * 0.85 - rect.top) / (window.innerHeight * 0.65),
        ),
      );
      setVisibleWords(Math.round(progress * wordCount));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    preference.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      preference.removeEventListener("change", schedule);
    };
  }, [wordCount]);
  return (
    <div className={styles.oldCopy}>
      <p className={styles.dotLabel}>{label}</p>
      <h2 ref={heading} id="old-title" className={styles.readingCopy}>
        {words.map((word, index) => (
          <span
            key={index}
            data-revealed={visibleWords === null || index < visibleWords}
          >
            {word}
            {index < wordCount - 1 ? " " : ""}
          </span>
        ))}
        <span className={styles.oldConclusion}>{conclusion}</span>
      </h2>
    </div>
  );
}
