import { notFound } from "next/navigation";
import { teamDevelopmentEnabled } from "@/lib/teams-development";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export default function TeamDevelopmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!teamDevelopmentEnabled()) notFound();
  return children;
}
