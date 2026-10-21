"use client";

import { useTranslations } from "next-intl";

export default function UserAddressCard() {
  const t = useTranslations("profile");

  return (
    <section className="rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">{t("address")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("addressUnavailable")}</p>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">{t("socialLinks")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("socialLinksUnavailable")}</p>
        </div>
      </div>
    </section>
  );
}
