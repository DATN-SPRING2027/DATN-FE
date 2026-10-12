"use client";

import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type SessionRecoveryPanelProps =
  | { state: "checking" | "redirecting" }
  | { state: "error"; isRetrying: boolean; onRetry: () => void };

export default function SessionRecoveryPanel(props: SessionRecoveryPanelProps) {
  const t = useTranslations("auth");
  const isError = props.state === "error";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm sm:p-8 dark:border-gray-800 dark:bg-gray-dark" aria-labelledby="session-title">
        <p className="mb-8 text-sm font-semibold tracking-wide text-brand-500 dark:text-brand-400">Continuum AI</p>
        {isError ? (
          <>
            <h1 id="session-title" className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">{t("sessionUnavailable")}</h1>
            <p className="mb-6 text-sm leading-6 text-gray-600 dark:text-gray-400">{t("recoveryHelp")}</p>
            <div role="alert" className="mb-6">
              <Alert variant="warning" title={t("recoveryNotice")} message={t("sessionUnavailableMessage")} />
            </div>
            {props.state === "error" && (
              <div className="flex flex-col gap-3">
                <Button disabled={props.isRetrying} onClick={props.onRetry} className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                  {props.isRetrying && <span aria-hidden="true" className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" />}
                  <span aria-live="polite">{props.isRetrying ? t("retryingSession") : t("tryAgain")}</span>
                </Button>
                <Link href="/signin" className="rounded-lg px-4 py-3 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5">{t("backToSignIn")}</Link>
              </div>
            )}
          </>
        ) : (
          <div role="status" aria-live="polite" aria-busy="true" className="pb-4">
            <div aria-hidden="true" className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
              <span className="size-7 rounded-full border-2 border-brand-200 border-t-brand-500 motion-safe:animate-spin dark:border-brand-500/30 dark:border-t-brand-400" />
            </div>
            <h1 id="session-title" className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">{props.state === "redirecting" ? t("redirectingToSignIn") : t("checkingSession")}</h1>
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{props.state === "redirecting" ? t("sessionEndedMessage") : t("checkingSessionMessage")}</p>
          </div>
        )}
      </section>
    </main>
  );
}
