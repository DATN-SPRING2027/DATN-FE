"use client";

import { cn } from "@/utils";
import styles from "./statusBadge.module.css";

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

const successful = new Set([
  "ACTIVE",
  "HEALTHY",
  "CONNECTED",
  "OK",
  "SUCCESS",
  "READY",
  "AVAILABLE",
  "COMPLETED",
  "RESOLVED",
]);
const warning = new Set([
  "PENDING",
  "PENDING_INVITE",
  "DEGRADED",
  "WARNING",
  "WAITING",
  "WAITING_CHILDREN",
  "DELAYED",
  "PAUSED",
  "OPEN",
  "ACKNOWLEDGED",
  "MEDIUM",
  "HIGH",
]);
const danger = new Set([
  "SUSPENDED",
  "ERROR",
  "FAILED",
  "DISCONNECTED",
  "CRITICAL",
  "REVOKED",
  "EXPIRED",
]);

export default function StatusBadge({
  status,
  label,
  className,
}: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const tone = successful.has(normalized)
    ? styles.success
    : danger.has(normalized)
      ? styles.danger
      : warning.has(normalized)
        ? styles.warning
        : styles.neutral;
  // Preserve translated labels; technical codes get the same sentence case as Memberships.
  const displayLabel =
    label && label !== status
      ? label
      : normalized.charAt(0) +
        normalized.slice(1).toLowerCase().replaceAll("_", " ");
  return (
    <span className={cn(styles.status, tone, className)}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
