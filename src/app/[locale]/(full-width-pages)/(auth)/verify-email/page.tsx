import EmailRegistrationForm from "@/components/auth/EmailRegistrationForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify your email | Continuum AI",
  description: "Verify your email and choose a password for your account.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <EmailRegistrationForm />;
}
