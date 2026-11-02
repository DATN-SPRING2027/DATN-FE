import type { Metadata } from "next";
import AccountOnboarding from "@/components/auth/AccountOnboarding";
import { setRequestLocale } from "next-intl/server";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "onboarding");
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountOnboarding />;
}
