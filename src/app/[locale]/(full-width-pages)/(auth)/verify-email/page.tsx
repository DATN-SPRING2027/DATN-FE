import EmailRegistrationForm from "@/components/auth/EmailRegistrationForm";
import type { Metadata } from "next";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "verifyEmail", {
    descriptionKey: "verifyEmailDescription",
    extra: {
      referrer: "no-referrer",
      robots: { index: false, follow: false },
    },
  });
}

export default function VerifyEmailPage() {
  return <EmailRegistrationForm />;
}
