import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account | Continuum AI",
  description: "Create your Continuum AI account to keep team knowledge connected.",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
