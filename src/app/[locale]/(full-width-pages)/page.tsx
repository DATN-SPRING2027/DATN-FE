import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import ScotchLanding from "@/components/landing/scotch/ScotchLanding";

export const metadata: Metadata = {
  title: "Continuum AI — Knowledge stays. Teams move forward.",
  description:
    "Capture software-team experience, verify the evidence, and hand over project knowledge with the full context.",
  keywords: [
    "Continuum AI",
    "project knowledge",
    "software team handover",
    "work notes",
    "knowledge management",
  ],
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ScotchLanding />;
}
