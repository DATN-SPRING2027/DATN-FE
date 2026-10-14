import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import LandingProblemSolution from "@/components/landing/LandingProblemSolution";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingDemoSection from "@/components/landing/LandingDemoSection";
import LandingCtaFooter from "@/components/landing/LandingCtaFooter";

export const metadata: Metadata = {
  title: "Continuum AI — Nền tảng duy trì tri thức cho đội ngũ phần mềm",
  description:
    "Continuum AI giúp các nhóm trong dự án phần mềm ghi nhận kinh nghiệm trong lúc làm việc, kiểm chứng bằng chứng và bàn giao rõ ràng cho người kế nhiệm.",
  keywords: [
    "Continuum AI",
    "duy trì tri thức dự án",
    "bàn giao công việc phần mềm",
    "work notes",
    "knowledge management",
    "software engineering handover",
  ],
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#344054] antialiased selection:bg-[#465FFF] selection:text-white dark:bg-gray-950 dark:text-gray-200">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingProblemSolution />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingDemoSection />
        <LandingCtaFooter />
      </main>
    </div>
  );
}
