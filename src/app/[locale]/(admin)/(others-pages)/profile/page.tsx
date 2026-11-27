import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import DangerZone from "@/components/user-profile/DangerZone";
import Security from "@/components/user-profile/Security";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "profile", {
    descriptionKey: "profileDescription",
  });
}

export default async function Profile({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  return (
    <div className="mx-auto max-w-5xl">
      <PageBreadcrumb pageTitle={t("pageTitle")} showTitle={false} />
      <div className="space-y-6">
        <UserMetaCard />
        <Security />
        <DangerZone />
      </div>
    </div>
  );
}
