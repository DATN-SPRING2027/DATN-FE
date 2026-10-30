import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/common/BrandLogo";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

export default async function ScotchFooter() {
  const t = await getTranslations("landingScotch");
  const common = await getTranslations("landingRylo");
  return (
    <footer
      id="continuum-footer"
      className={`${styles.container} ${styles.footer}`}
    >
      <div className={styles.footerTop}>
        <Link href="/" aria-label={common("home")}>
          <BrandLogo variant="inverse" className="h-7" />
        </Link>
        <nav aria-label={common("footerProduct")}>
          <div>
            <h2>{t("products")}</h2>
            <a href="#cach-hoat-dong">{t("paymentLabel")}</a>
            <a href="#giai-phap">{t("backOffice")}</a>
          </div>
          <div>
            <h2>{t("footerCompany")}</h2>
            <a href="#workflow">{t("integrations")}</a>
            <a href="#approach">{t("principles")}</a>
            <a href="#team-stories">{t("stories")}</a>
            <Link href="/signin">{common("signin")}</Link>
          </div>
          <div>
            <h2>{t("footerLegal")}</h2>
            <Link href="/terms">{t("termsLink")}</Link>
            <Link href="/privacy">{t("privacyLink")}</Link>
          </div>
        </nav>
      </div>
      <small>{common("copyright")}</small>
      <ReferenceImage
        file="knowledge-network.svg"
        width={620}
        height={620}
        className={styles.footerArt}
      />
    </footer>
  );
}
