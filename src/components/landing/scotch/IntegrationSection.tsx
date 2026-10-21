import { getTranslations } from "next-intl/server";
import { ArrowRightIcon } from "@/icons";
import BrandLogo from "@/components/common/BrandLogo";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

const logos = [
  "notes-icon.svg",
  "source-icon.svg",
  "review-icon.svg",
  "handover-icon.svg",
];
export default async function IntegrationSection() {
  const t = await getTranslations("landingScotch");
  return (
    <section
      id="workflow"
      className={styles.integration}
      aria-labelledby="workflow-title"
    >
      <div className={styles.integrationCard}>
        <div className={styles.integrationCopy}>
          <p className={styles.dotLabel}>{t("integrationLabel")}</p>
          <h2 id="workflow-title">{t("integrationTitle")}</h2>
          <p>{t("integrationBody")}</p>
          <a className={styles.textLink} href="#cach-hoat-dong">
            {t("findOut")}
            <ArrowRightIcon aria-hidden="true" />
          </a>
        </div>
        <div className={styles.integrationArt} aria-hidden="true">
          <div className={styles.integrationGrid} />
          {[0, 1, 2, 3].map((row) => (
            <div className={styles.logoTrack} key={row}>
              {[...logos, ...logos].map((file, i) => (
                <span key={`${file}-${i}`}>
                  <ReferenceImage file={file} width={28} height={28} />
                  <small>{t(`sourceType${(i % logos.length) + 1}`)}</small>
                </span>
              ))}
            </div>
          ))}
          <span className={styles.integrationCenter}>
            <BrandLogo variant="mark" className="h-14 w-14" />
          </span>
        </div>
      </div>
    </section>
  );
}
