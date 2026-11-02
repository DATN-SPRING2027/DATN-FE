import PasswordResetForm from "@/components/auth/PasswordResetForm";
import type { Metadata } from "next";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "resetPassword", {
    descriptionKey: "resetPasswordDescription",
    extra: {
      referrer: "no-referrer",
      robots: { index: false, follow: false },
    },
  });
}

export default function ResetPasswordPage() {
  return <PasswordResetForm />;
}
