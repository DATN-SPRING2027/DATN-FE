import type { Metadata } from "next";
import OrganizationInvitationAcceptance from "@/components/organization-members/OrganizationInvitationAcceptance";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "invitation", {
    extra: {
      referrer: "no-referrer",
      robots: { index: false, follow: false },
    },
  });
}

export default function OrganizationInvitationsPage() {
  return <OrganizationInvitationAcceptance />;
}
