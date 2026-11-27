import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import LegalCenterView from "@/components/legal/LegalCenterView";
import { LEGAL_NAMESPACES, pickMessages } from "@/i18n/messages-scope";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalCenter" });
  return {
    title: {
      absolute: t("termsMetaTitle"),
    },
    description: t("termsMetaDescription"),
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(
        messages as Record<string, unknown>,
        LEGAL_NAMESPACES,
      )}
    >
      <LegalCenterView initialTab="terms" />
    </NextIntlClientProvider>
  );
}
