"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/common/BrandLogo";
import { CheckCircleIcon, DocsIcon, LockIcon } from "@/icons";
import useAmbientMotion from "./useAmbientMotion";
import styles from "./landing.module.css";

const nodes = [
  { Icon: DocsIcon, track: "trackCapture" },
  { Icon: CheckCircleIcon, track: "trackVerify" },
  { Icon: LockIcon, track: "trackAccess" },
] as const;

export default function KnowledgeOrbit() {
  const t = useTranslations("landingRylo");
  const container = useRef<HTMLDivElement>(null);
  const { playing } = useAmbientMotion(container);
  return (
    <div ref={container} className={styles.humanArt} data-playing={playing}>
      <div className={styles.orbitArtwork} aria-hidden="true">
        <div className={styles.motionGrid} />
        <div className={styles.energyHalo} />
        <div className={styles.orbit} />
        <div className={styles.orbitInner} />
        {nodes.map(({ Icon, track }) => (
          <div
            key={track}
            className={`${styles.orbitalTrack} ${styles[track]}`}
          >
            <span className={styles.orbitNode}>
              <Icon />
            </span>
          </div>
        ))}
        <div className={styles.packetTrack}>
          <span />
        </div>
        <div className={`${styles.packetTrack} ${styles.packetReverse}`}>
          <span />
        </div>
        <div className={styles.humanCenter}>
          <BrandLogo variant="mark" className="h-20 w-20" />
        </div>
      </div>
      <p>{t("principleBadge")}</p>
    </div>
  );
}
