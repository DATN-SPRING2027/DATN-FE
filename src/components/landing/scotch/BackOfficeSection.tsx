"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "@/icons";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

const slides = [
  { key: "knowledge", file: "feature-knowledge.svg", icon: "notes-icon.svg" },
  { key: "review", file: "feature-review.svg", icon: "review-icon.svg" },
  { key: "handover", file: "feature-handover.svg", icon: "handover-icon.svg" },
] as const;
export default function BackOfficeSection() {
  const t = useTranslations("landingScotch");
  const [active, setActive] = useState(0);
  return (
    <section
      id="giai-phap"
      className={`${styles.container} ${styles.backOffice}`}
      aria-labelledby="back-title"
    >
      <p className={styles.label}>
        <ReferenceImage file="knowledge-icon.svg" width={24} height={24} />
        {t("backOffice")}
      </p>
      <div className={styles.backHeading}>
        <div>
          <h2 id="back-title">{t("backTitle")}</h2>
          <a href="#workflow" className={styles.textLink}>
            {t("findOut")}
            <ArrowRightIcon aria-hidden="true" />
          </a>
        </div>
        <div className={styles.benefits}>
          {["notes-icon.svg", "source-icon.svg", "knowledge-icon.svg"].map(
            (file, i) => (
              <div key={file}>
                <ReferenceImage file={file} width={25} height={25} />
                <p>{t(`benefit${i + 1}`)}</p>
              </div>
            ),
          )}
        </div>
      </div>
      <div className={styles.backVisuals}>
        <div
          className={styles.backScreen}
          id="back-office-preview"
          role="region"
          aria-label={`${t("visualLabel")}: ${t(slides[active].key)}`}
        >
          <ReferenceImage
            file={slides[active].file}
            width={2409}
            height={1554}
            sizes="(max-width: 767px) 94vw, 65vw"
            alt={t("heroAlt")}
          />
        </div>
        <div className={styles.statCard}>
          <ReferenceImage
            file="software-discussion.jpg"
            width={1200}
            height={1600}
          />
          <div>
            <strong>{t("statNumber")}</strong>
            <p>{t("statBody")}</p>
          </div>
        </div>
      </div>
      <div className={styles.backTabs}>
        {slides.map((slide, i) => (
          <button
            type="button"
            key={slide.key}
            aria-pressed={i === active}
            aria-controls="back-office-preview"
            onClick={() => setActive(i)}
          >
            <span className={styles.progress} />
            <span className={styles.backTabLabel}>
              <ReferenceImage file={slide.icon} width={24} height={24} />
              {t(slide.key)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
