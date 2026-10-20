import { getTranslations } from "next-intl/server";
import ReferenceImage from "./ReferenceImage";
import OldWayCopy from "./OldWayCopy";
import OldWayDecorations from "./OldWayDecorations";
import NewWayVisual from "./NewWayVisual";
import styles from "./scotch.module.css";

export default async function ApproachSection() {
  const t = await getTranslations("landingScotch");
  return (
    <section
      id="approach"
      className={styles.approach}
      aria-labelledby="old-title"
    >
      <div className={styles.oldWay}>
        <OldWayDecorations variant="desktop" />
        <OldWayCopy
          label={t("oldLabel")}
          lead={t("oldLead")}
          rest={t("oldRest")}
          conclusion={t("oldConclusion")}
        />
      </div>
      <OldWayDecorations variant="mobile" />
      <div className={`${styles.container} ${styles.newWay}`}>
        <div className={styles.newCopy}>
          <p className={styles.dotLabel}>{t("newLabel")}</p>
          <h2>{t("newTitle")}</h2>
          <div className={styles.newBenefits}>
            {["notes-icon.svg", "source-icon.svg", "review-icon.svg"].map(
              (file, i) => (
                <article key={file}>
                  <h3>
                    <ReferenceImage file={file} width={23} height={23} />
                    {t(`new${i + 1}Title`)}
                  </h3>
                  <p>{t(`new${i + 1}Body`)}</p>
                </article>
              ),
            )}
          </div>
        </div>
        <NewWayVisual alt={t("heroAlt")} />
      </div>
    </section>
  );
}
