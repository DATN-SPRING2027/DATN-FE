"use client";

import { useTranslations } from "next-intl";
import { useCurrentUserQuery, useRequestPasswordResetMutation } from "@/lib/queries/auth/useAuth";
import Button from "../ui/button/Button";

export default function Security() {
  const t = useTranslations("profile");
  const currentUser = useCurrentUserQuery();
  const passwordReset = useRequestPasswordResetMutation();

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
      <h2 className="mb-4 text-lg font-semibold text-gray-800 lg:mb-6 dark:text-white/90">{t("security")}</h2>
      <div>
        <div className="flex flex-col justify-between gap-4 border-b border-gray-200 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-end dark:border-gray-800">
          <div>
            <h3 className="mb-1 text-base font-medium text-gray-800 dark:text-white/90">{t("passwordResetTitle")}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("passwordResetDescription")}</p>
            {currentUser.data?.email ? (
              <p className="mt-2 break-words text-sm text-gray-500 dark:text-gray-400">{currentUser.data.email}</p>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={!currentUser.data?.email || currentUser.isPending || passwordReset.isPending}
            onClick={() => {
              const email = currentUser.data?.email;
              if (email) passwordReset.mutate({ email });
            }}
          >
            {passwordReset.isPending ? t("passwordResetSending") : t("passwordResetButton")}
          </Button>
        </div>

        {currentUser.isError ? <p className="mt-3 text-sm text-error-500" role="alert">{t("identityLoadError")}</p> : null}
        {passwordReset.isSuccess ? <p className="mt-3 text-sm text-success-600 dark:text-success-400" role="status">{t("passwordResetAccepted")}</p> : null}
        {passwordReset.isError ? <p className="mt-3 text-sm text-error-500" role="alert">{t("passwordResetError")}</p> : null}

        <div className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-end">
          <div>
            <h3 className="mb-1 text-base font-medium text-gray-800 dark:text-white/90">{t("twoFactor")}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("twoFactorUnavailable")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
