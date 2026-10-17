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
  searchParams: Promise<{ google?: string | string[] }>;
}) {
  const query = await searchParams;
  const value = Array.isArray(query.google) ? query.google[0] : query.google;
  const googleStatus =
    value === "organization-required" ||
    value === "failed" ||
    value === "cancelled"
      ? value
      : undefined;

  return <SignInForm googleStatus={googleStatus} />;
}
