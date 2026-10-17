import BackgroundVideo from "./BackgroundVideo";
import { getTranslations } from "next-intl/server";
import { ArrowRightIcon, CheckCircleIcon, DocsIcon, LockIcon } from "@/icons";
import styles from "./landing.module.css";

export default async function LandingHero() {
  const t = await getTranslations("landingRylo");
  return (
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.heroIntro}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1 id="landing-title">
            {t("heroTitle")}
            <br />
            <span>{t("heroAccent")}</span>
          </h1>
        </div>
        <div className={styles.heroAside}>
          <div className={styles.trust}>
            <span>
              <CheckCircleIcon aria-hidden="true" />
              {t("humanVerified")}
            </span>
            <span>
              <LockIcon aria-hidden="true" />
              {t("accessAware")}
            </span>
          </div>
          <p>{t("heroBody")}</p>
          <a className={styles.button} href="#cach-hoat-dong">
            {t("explore")}
            <ArrowRightIcon aria-hidden="true" className={styles.arrow} />
          </a>
        </div>
      </div>
      <div className={styles.heroVisual}>
        <BackgroundVideo scene="hero" />
        <div className={styles.quoteCard}>
          <span className={styles.quoteMark} aria-hidden="true">
            “
          </span>
          <p>{t("question")}</p>
          <span>{t("answer")}</span>
        </div>
        <div className={styles.noteCard}>
          <div className={styles.noteHeader}>
            <span className={styles.noteIcon}>
              <DocsIcon aria-hidden="true" />
            </span>
            <span>
              {t("noteId")}
              <small>{t("sample")}</small>
            </span>
          </div>
          <h2>{t("noteTitle")}</h2>
          <p>{t("noteBody")}</p>
          <div className={styles.noteSources}>
            <span aria-hidden="true" />
            {t("sources")}
          </div>
          <div className={styles.noteVerified}>
            <CheckCircleIcon aria-hidden="true" />
            {t("verified")}
          </div>
        </div>
        <p className={styles.photoCaption}>{t("photoCaption")}</p>
      </div>
    </section>
  );
}
