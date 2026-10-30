/**
 * Safe translation helper that returns the localized message when available,
 * and falls back to `fallback` when `t` does not have `key` or returns the raw
 * key path (for example, in unit tests that mock `useTranslations` as `(key) => key`).
 */
export function tr(
  t: ((key: string, values?: Record<string, string | number>) => string) & {
    has?: (key: string) => boolean;
  },
  key: string,
  fallback: string,
  values?: Record<string, string | number>,
): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) {
      return fallback;
    }
    const result = values ? t(key, values) : t(key);
    if (!result || result === key || result.endsWith(`.${key}`)) {
      return fallback;
    }
    return result;
  } catch {
    return fallback;
  }
}
