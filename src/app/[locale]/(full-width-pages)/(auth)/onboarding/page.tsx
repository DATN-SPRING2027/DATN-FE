import type { Metadata } from "next";
import AccountOnboarding from "@/components/auth/AccountOnboarding";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = { title: "Workspace setup | Continuum AI" };

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountOnboarding />;
}
