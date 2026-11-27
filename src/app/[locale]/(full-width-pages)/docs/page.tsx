import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import DeveloperDocsView from "@/components/docs/DeveloperDocsView";
import { DOCS_NAMESPACES, pickMessages } from "@/i18n/messages-scope";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildAppPageMetadata(params, "developerDocs", {
    descriptionKey: "developerDocsDescription",
  });
}

export default async function DeveloperDocsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(
        messages as Record<string, unknown>,
        DOCS_NAMESPACES,
      )}
    >
      <DeveloperDocsView />
    </NextIntlClientProvider>
  );
}
