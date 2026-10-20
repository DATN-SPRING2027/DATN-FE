"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import useAmbientMotion from "../rylo/useAmbientMotion";
import styles from "./scotch.module.css";

export default function ProductVideo() {
  const t = useTranslations("landingScotch");
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const { playing } = useAmbientMotion(container);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (playing && !failed) {
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
    return () => element.pause();
  }, [playing, failed]);

  return (
    <div ref={container} className={styles.videoFrame}>
      <video
        ref={video}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/videos/landing/developer-coding-poster.jpg"
        aria-label={t("videoAlt")}
        onError={() => setFailed(true)}
      >
        <source
          src="/videos/landing/developer-coding.mp4"
          type="video/mp4"
          onError={() => setFailed(true)}
        />
      </video>
      <span className={styles.footageCaption}>{t("footageLabel")}</span>
      {failed && (
        <div className={styles.videoError} role="status">
          <p>{t("videoError")}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              video.current?.load();
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}
    </div>
  );
}
