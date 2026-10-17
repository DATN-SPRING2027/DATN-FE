"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import useAmbientMotion from "./useAmbientMotion";
import styles from "./landing.module.css";

interface BackgroundVideoProps {
  scene: "hero" | "handover";
}

const media = {
  hero: "team-collaboration",
  handover: "workspace-timelapse",
} as const;

export default function BackgroundVideo({ scene }: BackgroundVideoProps) {
  const t = useTranslations("landingRylo");
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const { playing } = useAmbientMotion(container);
  const [unavailable, setUnavailable] = useState(false);
  const file = media[scene];
  const poster = `/videos/landing/${file}-poster.jpg`;

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (playing && !unavailable) {
      // If autoplay is refused, retain the poster without adding video controls.
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
    return () => element.pause();
  }, [playing, unavailable]);

  function retry() {
    video.current?.load();
    setUnavailable(false);
  }

  return (
    <div
      ref={container}
      className={`${styles.backgroundMedia} ${scene === "handover" ? styles.ctaMedia : ""}`}
    >
      <Image
        src={poster}
        alt=""
        aria-hidden="true"
        fill
        priority={scene === "hero"}
        sizes="(max-width: 767px) 100vw, 92vw"
        className={styles.mediaPoster}
      />
      <video
        ref={video}
        className={styles.backgroundVideo}
        hidden={unavailable}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onError={() => setUnavailable(true)}
      >
        <source
          src={`/videos/landing/${file}.mp4`}
          type="video/mp4"
          onError={() => setUnavailable(true)}
        />
      </video>
      <div className={styles.videoScrim} aria-hidden="true" />
      {unavailable && (
        <button type="button" className={styles.videoRetry} onClick={retry}>
          {t("retryVideo")}
        </button>
      )}
      {unavailable && (
        <span className={styles.videoStatus} role="status">
          {t("videoFallback")}
        </span>
      )}
    </div>
  );
}
