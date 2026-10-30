import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import LegalCenterView from "@/components/legal/LegalCenterView";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalCenter" });
  return {
    title: t("termsMetaTitle"),
    description: t("termsMetaDescription"),
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalCenterView initialTab="terms" />;
}
