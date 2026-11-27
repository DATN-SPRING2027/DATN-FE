import PlatformConsole from "@/components/platform/PlatformConsole";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { pickMessages, PLATFORM_NAMESPACES } from "@/i18n/messages-scope";
import { platformFont } from "@/components/platform/ui/platformFont";
import PlatformCopyProvider from "@/components/platform/ui/PlatformCopyProvider";
import { BRAND_PLATFORM, formatPlatformTitle } from "@/lib/page-titles";
import { resolveMetadataLocale } from "@/lib/page-titles.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveMetadataLocale(locale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: "pageTitles",
  });
  return {
    title: {
      default: formatPlatformTitle(t("platformOverview")),
      template: `%s · ${BRAND_PLATFORM}`,
    },
    description: t("platformDescription"),
  };
}

export default async function PlatformConsoleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(
        messages as Record<string, unknown>,
        PLATFORM_NAMESPACES,
      )}
    >
      <div className={platformFont.variable}>
        <PlatformCopyProvider>
          <PlatformConsole />
          {children}
        </PlatformCopyProvider>
      </div>
    </NextIntlClientProvider>
  );
}
