/**
 * Timezone-aware date formatting helpers.
 * Calendar-only dates (YYYY-MM-DD) stay in UTC so date boundaries do not shift
 * across browser timezones, while ISO timestamps render in the user's local timezone.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyValue(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value.trim());
}

export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function resolveDateFormatTimeZone(
  value: string,
): string {
  return isDateOnlyValue(value) ? "UTC" : getLocalTimeZone();
}
