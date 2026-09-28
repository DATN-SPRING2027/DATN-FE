import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import UserDirectory from "@/components/users/UserDirectory";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Users | Continuum AI",
  description: "Organization user directory",
};

export default async function UsersPage() {
  const t = await getTranslations("users");
  return (
    <div>
      <PageBreadcrumb pageTitle={t("title")} />
      <UserDirectory />
    </div>
  );
}
