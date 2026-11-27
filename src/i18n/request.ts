import { getRequestConfig } from "next-intl/server";

import { type Locale, routing } from "./routing";

type MessageNode =
  | string
  | MessageNode[]
  | { [key: string]: MessageNode };

function mergeMessages(
  base: Record<string, MessageNode>,
  override: Record<string, MessageNode>,
): Record<string, MessageNode> {
  const output: Record<string, MessageNode> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseVal = base[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseVal &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      output[key] = mergeMessages(
        baseVal as Record<string, MessageNode>,
        value as Record<string, MessageNode>,
      );
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

const mergedMessagesCache = new Map<Locale, Record<string, MessageNode>>();

async function loadLocaleMessages(
  locale: Locale,
): Promise<Record<string, MessageNode>> {
  const cached = mergedMessagesCache.get(locale);
  if (cached) {
    return cached;
  }

  const enMessages = (await import("../messages/en.json")).default as Record<
    string,
    MessageNode
  >;
  if (locale === "en") {
    mergedMessagesCache.set("en", enMessages);
    return enMessages;
  }

  const localeMessages = (await import(`../messages/${locale}.json`))
    .default as Record<string, MessageNode>;
  const merged = mergeMessages(enMessages, localeMessages);
  mergedMessagesCache.set(locale, merged);
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadLocaleMessages(locale),
  };
});
