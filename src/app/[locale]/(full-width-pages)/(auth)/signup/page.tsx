import SignUpForm from "@/components/auth/SignUpForm";
import type { Metadata } from "next";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "signUp", {
    descriptionKey: "signUpDescription",
  });
}

export default async function SignUp({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const query = await searchParams;
  const email = Array.isArray(query.email) ? query.email[0] : query.email;
  return <SignUpForm initialEmail={email} />;
}
