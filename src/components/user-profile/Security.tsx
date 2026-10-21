"use client";

import { useTranslations } from "next-intl";
import { LockIcon, AlertIcon } from "@/icons";
import { useCurrentUserQuery, useRequestPasswordResetMutation } from "@/lib/queries/auth/useAuth";
import Button from "../ui/button/Button";

export default function Security() {
  const t = useTranslations("profile");
  const currentUser = useCurrentUserQuery();
  const passwordReset = useRequestPasswordResetMutation();
  const rateLimited = passwordReset.error && "status" in passwordReset.error && passwordReset.error.status === 429;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6" aria-labelledby="account-security-heading">
      <h2 id="account-security-heading" className="text-lg font-semibold text-gray-900 dark:text-white/90">{t("security")}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t("securityDescription")}</p>

      <div className="mt-5 divide-y divide-gray-200 dark:divide-gray-800">
        <div className="flex flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"><LockIcon className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("passwordResetTitle")}</h3>
              <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{t("passwordResetDescription")}</p>
              {currentUser.isError ? <p className="mt-2 text-sm text-error-600 dark:text-error-400" role="alert">{t("identityLoadError")}</p> : null}
              {passwordReset.isSuccess ? <p className="mt-2 text-sm text-success-700 dark:text-success-400" role="status">{t("passwordResetAccepted")}</p> : null}
              {passwordReset.isError ? <p className="mt-2 text-sm text-error-600 dark:text-error-400" role="alert">{rateLimited ? t("passwordResetRateLimited") : t("passwordResetError")}</p> : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            className="w-full shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
            disabled={!currentUser.data?.email || currentUser.isPending || passwordReset.isPending}
            onClick={() => {
              const email = currentUser.data?.email;
              if (email) passwordReset.mutate({ email });
            }}
          >
            {passwordReset.isPending ? t("passwordResetSending") : t("passwordResetButton")}
          </Button>
        </div>

        <div className="flex items-start gap-3 pt-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><AlertIcon className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("twoFactor")}</h3>
              <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{t("twoFactorDescription")}</p>
            </div>
            <span className="mt-2 inline-flex shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:mt-0">{t("unavailable")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
