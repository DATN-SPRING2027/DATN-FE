import PlatformConsole from "@/components/platform/PlatformConsole";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export default function PlatformConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={platformFont.variable}>
      <PlatformCopyProvider>
        <PlatformConsole />
        {children}
      </PlatformCopyProvider>
    </div>
  );
}
