"use client";

import { useTranslations } from "next-intl";

export default function SimulationBadge() {
  const t = useTranslations("platformConsole");

  return (
    <span className="sr-only" title={t("referenceCharts.notice")}>
      {t("referenceCharts.simulated")}
    </span>
  );
}
