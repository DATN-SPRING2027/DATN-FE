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

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  const enMessages = (await import("../messages/en.json")).default as Record<
    string,
    MessageNode
  >;
  if (locale === "en") {
    return {
      locale,
      messages: enMessages,
    };
  }

  const localeMessages = (await import(`../messages/${locale}.json`))
    .default as Record<string, MessageNode>;

  return {
    locale,
    messages: mergeMessages(enMessages, localeMessages),
  };
});
