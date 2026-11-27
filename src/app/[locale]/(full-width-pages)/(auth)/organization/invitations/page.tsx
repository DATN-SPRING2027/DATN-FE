import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import OrganizationInvitationAcceptance from "@/components/organization-members/OrganizationInvitationAcceptance";
import {
  AUTH_INVITATION_NAMESPACES,
  pickMessages,
} from "@/i18n/messages-scope";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "invitation", {
    extra: {
      referrer: "no-referrer",
      robots: { index: false, follow: false },
    },
  });
}

export default async function OrganizationInvitationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(
        messages as Record<string, unknown>,
        AUTH_INVITATION_NAMESPACES,
      )}
    >
      <OrganizationInvitationAcceptance />
    </NextIntlClientProvider>
  );
}
