import PlatformSignIn from "@/components/platform/PlatformSignIn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Operator Sign In | Continuum AI",
  description: "Sign in to the permission-scoped platform console.",
};

export default function PlatformSignInPage() {
  return <PlatformSignIn />;
}
