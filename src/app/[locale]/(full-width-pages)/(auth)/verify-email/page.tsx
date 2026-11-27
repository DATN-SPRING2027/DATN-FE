import EmailRegistrationForm from "@/components/auth/EmailRegistrationForm";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "verifyEmail", {
    descriptionKey: "verifyEmailDescription",
    extra: {
      referrer: "no-referrer",
      robots: { index: false, follow: false },
    },
  });
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EmailRegistrationForm />;
}
