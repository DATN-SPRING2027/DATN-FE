"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

const screens = [
  { key: "capture", image: "work-notes.svg", icon: "notes-icon" },
  { key: "knowledge", image: "knowledge.svg", icon: "knowledge-icon" },
  { key: "review", image: "review.svg", icon: "review-icon" },
  { key: "handover", image: "handover.svg", icon: "handover-icon" },
] as const;

export default function ProductPreview() {
  const t = useTranslations("landingScotch");
  const [active, setActive] = useState(1);
  const current = screens[active];
  return (
    <div className={styles.product}>
      <div className={styles.mobileTabs}>
        {screens.map((screen, index) => (
          <button
            key={screen.key}
            type="button"
            aria-pressed={active === index}
            aria-controls="hero-product-preview"
            onClick={() => setActive(index)}
          >
            {t(screen.key)}
          </button>
        ))}
      </div>
      <div
        className={styles.device}
        id="hero-product-preview"
        role="region"
        aria-label={`${t("visualLabel")}: ${t(current.key)}`}
      >
        <ReferenceImage
          file={current.image}
          width={2484}
          height={1560}
          priority
          sizes="(max-width: 900px) 94vw, 850px"
          alt={t("heroAlt")}
        />
      </div>
      <div className={styles.dock} aria-label={t("products")}>
        {screens.map((screen, index) => (
          <button
            key={screen.key}
            type="button"
            aria-label={t(screen.key)}
            aria-pressed={active === index}
            aria-controls="hero-product-preview"
            onClick={() => setActive(index)}
          >
            <span className={styles.dockLabel}>{t(screen.key)}</span>
            <ReferenceImage
              file={`${screen.icon}${active === index ? "-active" : ""}.svg`}
              width={234}
              height={234}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
