"use client";
import { useTranslations } from "next-intl";
import styles from "./operator.module.css";
export default function PlatformSubheader() {
  const t = useTranslations("platformConsole");
  return (
    <div className={styles.subheader}>
      <span className="text-xs text-gray-500">
        {t("operatorDesign.home")} / {t("navigation.dashboard")}
      </span>
    </div>
  );
}
