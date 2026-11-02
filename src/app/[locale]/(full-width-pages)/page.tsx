import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ScotchLanding from "@/components/landing/scotch/ScotchLanding";
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
      absolute: t("landingTitle"),
    },
    description: t("landingDescription"),
    keywords: [
      "Continuum AI",
      "project knowledge",
      "software team handover",
      "work notes",
      "knowledge management",
    ],
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ScotchLanding />;
}
