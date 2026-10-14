import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function OrganizationInvitationManager() {
  const t = useTranslations("users");

  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
      <Link
        href="/organization/members"
        className="text-sm font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {t("manageOrganizationMemberships")}
      </Link>
    </div>
  );
}
