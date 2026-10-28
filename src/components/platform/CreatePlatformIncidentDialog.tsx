"use client";

import { useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import PlatformRecordModal from "./ui/PlatformRecordModal";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";
import styles from "./CreatePlatformIncidentDialog.module.css";

export default function CreatePlatformIncidentDialog({
  model,
  triggerRef,
  onClose,
}: {
  model: PlatformOperationsViewModel;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const t = useTranslations("platformConsole.incidentForm");
  const titleRef = useRef<HTMLInputElement>(null);
  const pending = model.createIncident.isPending;
  return (
    <PlatformRecordModal
      title={t("heading")}
      closeLabel={t("cancel")}
      triggerRef={triggerRef}
      initialFocusRef={titleRef}
      pending={pending}
      onClose={onClose}
      className={styles.dialog}
    >
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!model.canManageIncidents || pending) return;
          const values = new FormData(event.currentTarget);
          const success = await model.handleSubmit(event, () =>
            model.createIncident.mutateAsync({
              title: String(values.get("title") ?? "").trim(),
              severity: String(values.get("severity") ?? "HIGH") as
                "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
              affectedServiceId: String(values.get("service") ?? "iam"),
            }),
          );
          if (success) {
            model.setFormMessage(t("created"));
            onClose();
          }
        }}
      >
        <fieldset disabled={pending} className={styles.fields}>
          <label>
            {t("title")}
            <input
              ref={titleRef}
              name="title"
              required
              maxLength={160}
              pattern={".*\\S.*"}
            />
          </label>
          <div className={styles.row}>
            <label>
              {t("severity")}
              <select name="severity" defaultValue="HIGH">
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              {t("service")}
              <select name="service" defaultValue="iam">
                {[
                  "iam",
                  "capture",
                  "jira",
                  "lifecycle",
                  "chat",
                  "handover",
                  "ingestion",
                  "notification",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        {model.formMessage && (
          <p
            role="alert"
            className="text-xs text-error-700 dark:text-error-400"
          >
            {model.formMessage}
          </p>
        )}
        <footer className={styles.footer}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" size="sm" isLoading={pending}>
            {pending ? t("creating") : t("submit")}
          </Button>
        </footer>
      </form>
    </PlatformRecordModal>
  );
}
