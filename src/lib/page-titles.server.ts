import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type enMessages from "@/messages/en.json";
import { type Locale, routing } from "@/i18n/routing";
import {
  formatAiChatTitle,
  formatAppTitle,
  formatPlatformTitle,
} from "./page-titles";

export type PageTitleKey = keyof (typeof enMessages)["pageTitles"];

export function resolveMetadataLocale(locale: string | undefined): Locale {
  return routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;
}

export async function buildAppPageMetadata(
  params: Promise<{ locale: string }>,
  titleKey: PageTitleKey,
  options?: {
    descriptionKey?: PageTitleKey;
    extra?: Omit<Metadata, "title" | "description">;
  },
): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveMetadataLocale(locale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: "pageTitles",
  });

  return {
    title: {
      absolute: formatAppTitle(t(titleKey)),
    },
    ...(options?.descriptionKey
      ? { description: t(options.descriptionKey) }
      : {}),
    ...options?.extra,
  };
}

export async function buildAiChatPageMetadata(
  params: Promise<{ locale: string }>,
  titleKey: "aiChat" | "aiChatShared",
): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveMetadataLocale(locale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: "pageTitles",
  });

  return {
    title: {
      absolute: formatAiChatTitle({ fallbackLabel: t(titleKey) }),
    },
  };
}

export async function buildPlatformPageMetadata(
  params: Promise<{ locale: string }>,
  titleKey: PageTitleKey,
  options?: {
    descriptionKey?: PageTitleKey;
  },
): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveMetadataLocale(locale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: "pageTitles",
  });

  return {
    title: {
      absolute: formatPlatformTitle(t(titleKey)),
    },
    ...(options?.descriptionKey
      ? { description: t(options.descriptionKey) }
      : {}),
  };
}
