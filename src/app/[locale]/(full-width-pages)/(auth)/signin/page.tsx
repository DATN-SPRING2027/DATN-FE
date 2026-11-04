import SignInForm from "@/components/auth/SignInForm";
import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "signIn", {
    descriptionKey: "signInDescription",
  });
}

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string | string[];
    returnTo?: string | string[];
    email?: string | string[];
    switch?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const value = Array.isArray(query.google) ? query.google[0] : query.google;
  const returnTo = Array.isArray(query.returnTo)
    ? query.returnTo[0]
    : query.returnTo;
  const email = Array.isArray(query.email) ? query.email[0] : query.email;
  const switchRaw = Array.isArray(query.switch)
    ? query.switch[0]
    : query.switch;
  const switchAccount = switchRaw === "1" || switchRaw === "true";
  const googleStatus =
    value === "organization-required" ||
    value === "failed" ||
    value === "cancelled"
      ? value
      : undefined;

  return (
    <SignInForm
      googleStatus={googleStatus}
      returnTo={returnTo}
      initialEmail={email}
      switchAccount={switchAccount}
    />
  );
}
