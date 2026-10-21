import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "@/icons";
import BrandLogo from "@/components/common/BrandLogo";
import WorkspaceLink from "../rylo/WorkspaceLink";
import ScotchNavigation from "./ScotchNavigation";
import ProductPreview from "./ProductPreview";
import BackOfficeSection from "./BackOfficeSection";
import IntegrationSection from "./IntegrationSection";
import ProductVideo from "./ProductVideo";
import ApproachSection from "./ApproachSection";
import TeamStories from "./TeamStories";
import ReferenceImage from "./ReferenceImage";
import ScotchFooter from "./ScotchFooter";
import HeroDecorations from "./HeroDecorations";
import ClosingArt from "./ClosingArt";
import SmoothScrollHandler from "./SmoothScrollHandler";
import styles from "./scotch.module.css";

export default async function ScotchLanding() {
  const t = await getTranslations("landingScotch");
  const common = await getTranslations("landingRylo");
  return (
    <div className={styles.landing}>
      <SmoothScrollHandler />
      <a href="#noi-dung" className={styles.skip}>
        {common("skip")}
      </a>
      <ScotchNavigation />
      <main id="noi-dung">
        <section className={styles.hero} aria-labelledby="landing-title">
          <HeroDecorations />
          <div className={styles.container}>
            <div className={styles.heroCopy}>
              <span className={styles.pill}>{t("introducing")}</span>
              <h1 id="landing-title">{t("heroTitle")}</h1>
              <p>{t("heroBody")}</p>
              <div className={styles.actions}>
                <span className={styles.primaryAction}>
                  <WorkspaceLink guestLabel={t("getStarted")} hideIcon />
                </span>
                <a className={styles.secondaryAction} href="#cach-hoat-dong">
                  {t("seeAction")}
                </a>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>
        <div className={`${styles.container} ${styles.trust}`}>
          <p>{t("logoCaption")}</p>
          <div aria-label={t("logosLabel")}>
            {[
              "notes-icon.svg",
              "source-icon.svg",
              "review-icon.svg",
              "knowledge-icon.svg",
              "handover-icon.svg",
              "team-icon.svg",
            ].map((file, i) => (
              <span key={file} className={styles.trustPillar}>
                <ReferenceImage file={file} width={24} height={24} />
                <span>{t(`pillar${i + 1}`)}</span>
              </span>
            ))}
          </div>
        </div>
        <BackOfficeSection />
        <IntegrationSection />
        <section
          id="cach-hoat-dong"
          className={styles.payments}
          aria-labelledby="payments-title"
        >
          <div className={`${styles.container} ${styles.centerHeading}`}>
            <p className={styles.label}>
              <ReferenceImage file="handover-icon.svg" width={24} height={24} />
              {t("paymentLabel")}
            </p>
            <h2 id="payments-title">{t("paymentTitle")}</h2>
            <a href="#approach" className={styles.textLink}>
              {t("findOut")}
              <ArrowRightIcon aria-hidden="true" />
            </a>
          </div>
          <ProductVideo />
          <div className={styles.container}>
            <ul className={styles.paymentBenefits}>
              {["source-icon.svg", "review-icon.svg", "access-icon.svg"].map(
                (file, i) => (
                  <li key={file}>
                    <ReferenceImage file={file} width={26} height={25} />
                    <span>{t(`paymentBenefit${i + 1}`)}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
        <ApproachSection />
        <TeamStories />
        <section
          className={`${styles.container} ${styles.closing}`}
          aria-labelledby="cta-title"
        >
          <div className={styles.closingCard}>
            <ClosingArt />
            <div className={styles.closingCopy}>
              <BrandLogo variant="mark" className="h-9 w-9" />
              <h2 id="cta-title">{t("ctaTitle")}</h2>
              <p>{t("ctaBody")}</p>
              <span className={styles.primaryAction}>
                <WorkspaceLink guestLabel={t("getStarted")} hideIcon />
              </span>
            </div>
          </div>
        </section>
      </main>
      <ScotchFooter />
    </div>
  );
}
