import type { ReactNode } from "react";
import AuthLayoutFrame from "@/components/auth/AuthLayoutFrame";

export default function PlatformSignInLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthLayoutFrame>{children}</AuthLayoutFrame>;
}
