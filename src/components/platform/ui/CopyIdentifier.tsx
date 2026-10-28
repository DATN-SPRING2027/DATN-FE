"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CopyIcon } from "@/icons";
import styles from "./modalDetails.module.css";
export default function CopyIdentifier({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const t = useTranslations("platformConsole.modal");
  const [message, setMessage] = useState("");
  return (
    <span className={styles.identifier}>
      <code title={value}>{value}</code>
      <button
        type="button"
        aria-label={t("copy", { label })}
        title={t("copy", { label })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage(t("copied"));
          } catch {
            setMessage(t("copyFailed"));
          }
        }}
      >
        <CopyIcon aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </span>
  );
}
