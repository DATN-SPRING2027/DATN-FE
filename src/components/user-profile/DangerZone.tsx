"use client";

import { useTranslations } from "next-intl";
import { AlertIcon, LogOutIcon, TrashBinIcon } from "@/icons";
import { useRouter } from "@/i18n/navigation";
import { useLogoutMutation } from "@/lib/queries/auth/useAuth";
import Button from "../ui/button/Button";

export default function DangerZone() {
  const t = useTranslations("profile");
  const router = useRouter();
  const logout = useLogoutMutation();

  const signOut = async () => {
    try {
      await logout.mutateAsync();
      router.replace("/signin");
    } catch {
      // Keep the action available and display the mutation error below.
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6" aria-labelledby="danger-zone-heading">
      <div className="flex items-center gap-2 text-error-600 dark:text-error-400">
        <AlertIcon className="size-5" aria-hidden="true" />
        <h2 id="danger-zone-heading" className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("dangerZone")}</h2>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t("dangerDescription")}</p>

      <div className="mt-5 divide-y divide-gray-200 dark:divide-gray-800">
        <div className="flex flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><LogOutIcon className="size-5 rtl:-scale-x-100" aria-hidden="true" /></span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("signOutCurrentTitle")}</h3>
              <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{t("signOutCurrentDescription")}</p>
              {logout.isError ? <p className="mt-2 text-sm text-error-600 dark:text-error-400" role="alert">{t("signOutError")}</p> : null}
            </div>
          </div>
          <Button size="sm" type="button" variant="outline" className="w-full shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto" disabled={logout.isPending} onClick={() => void signOut()}>
            {logout.isPending ? t("signingOut") : t("signOutCurrentAction")}
          </Button>
        </div>

        <div className="flex items-start gap-3 pt-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"><TrashBinIcon className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("deleteAccountTitle")}</h3>
              <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{t("deleteAccountUnavailable")}</p>
            </div>
            <span className="mt-2 inline-flex shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:mt-0">{t("unavailable")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
