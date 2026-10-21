import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import DangerZone from "@/components/user-profile/DangerZone";
import Security from "@/components/user-profile/Security";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "My Profile | Continuum AI",
  description: "Manage your personal information and account security in Continuum AI.",
};

export default async function Profile() {
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
