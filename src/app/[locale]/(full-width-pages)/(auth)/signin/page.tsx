import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Continuum AI",
  description:
    "Sign in to your Continuum AI workspace to capture, verify, and carry project knowledge forward.",
};

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ google?: string | string[]; returnTo?: string | string[]; email?: string | string[] }>;
}) {
  const query = await searchParams;
  const value = Array.isArray(query.google) ? query.google[0] : query.google;
  const returnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const email = Array.isArray(query.email) ? query.email[0] : query.email;
  const googleStatus =
    value === "organization-required" ||
    value === "failed" ||
    value === "cancelled"
      ? value
      : undefined;

  return <SignInForm googleStatus={googleStatus} returnTo={returnTo} initialEmail={email} />;
}
