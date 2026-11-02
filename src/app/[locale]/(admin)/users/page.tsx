import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import UserDirectory from "@/components/users/UserDirectory";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "users");
}

export default async function UsersPage() {
  const t = await getTranslations("users");
  return (
    <div>
      <PageBreadcrumb pageTitle={t("title")} />
      <UserDirectory />
    </div>
  );
}
