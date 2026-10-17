import { getTranslations } from "next-intl/server";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  DocsIcon,
  HandShakeIcon,
  LockIcon,
  PlusIcon,
} from "@/icons";
import BrandLogo from "@/components/common/BrandLogo";
import { Link } from "@/i18n/navigation";
import LandingNavigation from "./LandingNavigation";
import LandingHero from "./LandingHero";
import LandingScroll from "./LandingScroll";
import KnowledgeJourney from "./KnowledgeJourney";
import KnowledgeOrbit from "./KnowledgeOrbit";
import BackgroundVideo from "./BackgroundVideo";
import WorkspaceLink from "./WorkspaceLink";
import styles from "./landing.module.css";

export default async function ContinuumLanding() {
  const t = await getTranslations("landingRylo");
  const features = [
    { number: 1, Icon: DocsIcon },
    { number: 2, Icon: CheckCircleIcon },
    { number: 3, Icon: HandShakeIcon },
  ] as const;
  return (
    <LandingScroll>
      <a href="#noi-dung" className={styles.skipLink}>
        {t("skip")}
      </a>
      <div className={styles.blueTop}>
        <LandingNavigation />
      </div>
      <main id="noi-dung">
        <LandingHero />
        <div className={styles.creamSurface}>
          <div className={styles.principles}>
            <span>
              <DocsIcon aria-hidden="true" />
              {t("sourceFirst")}
            </span>
            <span>
              <CheckCircleIcon aria-hidden="true" />
              {t("humanVerified")}
            </span>
            <span>
              <LockIcon aria-hidden="true" />
              {t("accessAware")}
            </span>
          </div>
          <section
            id="giai-phap"
            className={`${styles.section} ${styles.intro}`}
            aria-labelledby="intro-title"
          >
            <p className={styles.eyebrow}>{t("introEyebrow")}</p>
            <h2 id="intro-title">{t("introTitle")}</h2>
            <p className={styles.introBody}>{t("introBody")}</p>
            <div className={styles.comparison}>
              <div className={styles.beforeCard}>
                <span className={styles.eyebrow}>{t("beforeLabel")}</span>
                <div className={styles.scattered} aria-hidden="true">
                  <span>?</span>
                  <span>···</span>
                  <span>?</span>
                </div>
                <h3>{t("beforeTitle")}</h3>
                <p>{t("beforeBody")}</p>
              </div>
              <div className={styles.afterCard}>
                <span className={styles.eyebrow}>{t("afterLabel")}</span>
                <div className={styles.connected} aria-hidden="true">
                  <DocsIcon />
                  <span />
                  <CheckCircleIcon />
                  <span />
                  <HandShakeIcon />
                </div>
                <h3>{t("afterTitle")}</h3>
                <p>{t("afterBody")}</p>
              </div>
            </div>
          </section>
          <KnowledgeJourney />
          <section
            className={`${styles.section} ${styles.features}`}
            aria-labelledby="features-title"
          >
            <p className={styles.eyebrow}>{t("featuresEyebrow")}</p>
            <h2 id="features-title">{t("featuresTitle")}</h2>
            <div className={styles.featureGrid}>
              {features.map(({ number, Icon }) => (
                <article key={number} className={styles.featureCard}>
                  <span className={styles.featureIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={styles.featureIndex}>0{number}</span>
                  <h3>{t(`feature${number}Title`)}</h3>
                  <p>{t(`feature${number}Body`)}</p>
                </article>
              ))}
            </div>
          </section>
          <section
            className={`${styles.section} ${styles.humanSection}`}
            aria-labelledby="human-title"
          >
            <KnowledgeOrbit />
            <div>
              <p className={styles.eyebrow}>{t("humanVerified")}</p>
              <h2 id="human-title">{t("principleTitle")}</h2>
              <p className={styles.body}>{t("principleBody")}</p>
              <a href="#cach-hoat-dong" className={styles.textLink}>
                {t("principleLink")}
                <ArrowRightIcon aria-hidden="true" className={styles.arrow} />
              </a>
            </div>
          </section>
        </div>
        <section className={styles.finalCta} aria-labelledby="cta-title">
          <BackgroundVideo scene="handover" />
          <div className={styles.ctaContent}>
            <span className={styles.eyebrow}>CONTINUUM AI</span>
            <h2 id="cta-title">{t("ctaTitle")}</h2>
            <p>{t("ctaBody")}</p>
            <WorkspaceLink />
          </div>
        </section>
        <section
          id="cau-hoi"
          className={`${styles.section} ${styles.faq}`}
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title">{t("faq")}</h2>
          <div>
            {[1, 2, 3, 4].map((n) => (
              <details key={n}>
                <summary>
                  {t(`faq${n}Q`)}
                  <PlusIcon aria-hidden="true" />
                </summary>
                <p>{t(`faq${n}A`)}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div>
            <Link href="/" aria-label={t("home")}>
              <BrandLogo className="h-9" />
            </Link>
            <p>{t("footerTagline")}</p>
          </div>
          <nav aria-label={t("footerProduct")}>
            <h2>{t("footerProduct")}</h2>
            <a href="#giai-phap">{t("solution")}</a>
            <a href="#cach-hoat-dong">{t("journey")}</a>
            <a href="#cau-hoi">{t("faq")}</a>
          </nav>
          <div>
            <h2>{t("footerAccount")}</h2>
            <WorkspaceLink subtle />
          </div>
        </div>
        <div className={styles.footerBottom}>
          <small>{t("copyright")}</small>
          <span>
            {t("sourceFirst")} · {t("humanVerified")}
          </span>
        </div>
      </footer>
    </LandingScroll>
  );
}
