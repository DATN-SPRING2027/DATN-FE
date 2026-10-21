import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account | Continuum AI",
  description: "Create your Continuum AI account to keep team knowledge connected.",
  // other metadata
};

export default async function SignUp({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const query = await searchParams;
  const email = Array.isArray(query.email) ? query.email[0] : query.email;
  return <SignUpForm initialEmail={email} />;
}
