"use client";

import { useTranslations } from "next-intl";
import styles from "./operator.module.css";

export default function SimulationBadge() {
  const t = useTranslations("platformConsole");

  return (
    <span className={styles.demoBadge} title={t("referenceCharts.notice")}>
      {t("referenceCharts.simulated")}
    </span>
  );
}
