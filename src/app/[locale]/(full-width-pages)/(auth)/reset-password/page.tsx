import PasswordResetForm from "@/components/auth/PasswordResetForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password | Continuum AI",
  description: "Request a secure password reset link for your account.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  return <PasswordResetForm token={token} />;
}
