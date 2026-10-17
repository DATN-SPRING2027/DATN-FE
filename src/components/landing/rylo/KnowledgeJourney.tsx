"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircleIcon, DocsIcon, HandShakeIcon } from "@/icons";
import styles from "./landing.module.css";

const stages = [1, 2, 3] as const;
type Stage = (typeof stages)[number];
const icons = [DocsIcon, CheckCircleIcon, HandShakeIcon];

export default function KnowledgeJourney() {
  const t = useTranslations("landingRylo");
  const [active, setActive] = useState<Stage>(1);
  const Icon = icons[active - 1];
  return (
    <section
      id="cach-hoat-dong"
      className={`${styles.section} ${styles.journey}`}
      aria-labelledby="journey-title"
    >
      <div className={styles.journeyCopy}>
        <p className={styles.eyebrow}>{t("journeyEyebrow")}</p>
        <h2 id="journey-title">{t("journeyTitle")}</h2>
        <p className={styles.body}>{t("journeyBody")}</p>
        <div className={styles.stageChoices}>
          {stages.map((stage) => (
            <button
              key={stage}
              type="button"
              className={active === stage ? styles.activeStage : ""}
              aria-pressed={active === stage}
              aria-controls="knowledge-preview"
              onClick={() => setActive(stage)}
            >
              <span className={styles.stageNumber}>0{stage}</span>
              <span>
                <strong>{t(`step${stage}Title`)}</strong>
                <span>{t(`step${stage}Body`)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.previewScene}>
        <p className={styles.previewLabel}>{t("sample")}</p>
        <div
          className={styles.previewCard}
          id="knowledge-preview"
          role="region"
          aria-label={t("demoLabel")}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.previewTop}>
            <span className={styles.previewLogo}>
              continuum<span> ai</span>
            </span>
            <span className={styles.previewDots} aria-hidden="true">
              ···
            </span>
          </div>
          <div className={styles.previewStages} aria-hidden="true">
            {stages.map((stage) => (
              <span
                key={stage}
                className={active === stage ? styles.currentStage : ""}
              >
                {t(`stage${stage}`)}
              </span>
            ))}
          </div>
          <span className={styles.previewIcon}>
            <Icon aria-hidden="true" />
          </span>
          <p className={styles.previewStatus}>{t(`panel${active}Status`)}</p>
          <h3>{t(`panel${active}Title`)}</h3>
          <p className={styles.previewBody}>{t(`panel${active}Body`)}</p>
          <div className={styles.sourceRow}>
            <DocsIcon aria-hidden="true" />
            <span>{t(`panel${active}Detail`)}</span>
          </div>
        </div>
        <div className={styles.connectedNote}>
          <span className={styles.connectionDot} />
          <div>
            <strong>{t("traceTitle")}</strong>
            <p>
              {t("trace1")} <span aria-hidden="true">→</span> {t("trace3")}
            </p>
          </div>
          <CheckCircleIcon aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
