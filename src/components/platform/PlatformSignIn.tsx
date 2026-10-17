"use client";

import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Link, useRouter } from "@/i18n/navigation";
import { getPlatformErrorKind, platformErrorMessageKey } from "@/lib/queries/platform/platform-api";
import { usePlatformLoginMutation, usePlatformSessionQuery } from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";

export default function PlatformSignIn() {
  const t = useTranslations("platformConsole");
  const router = useRouter();
  const session = usePlatformSessionQuery();
  const login = usePlatformLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  useEffect(() => {
    if (session.isSuccess && session.data.context === "PLATFORM") router.replace("/platform");
  }, [router, session.data, session.isSuccess]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSessionUnavailable(false);
    try {
      await login.mutateAsync({ email: email.trim(), password });
      const current = await session.refetch();
      if (current.data?.context === "PLATFORM") router.replace("/platform");
      else setSessionUnavailable(true);
    } catch {
      setSessionUnavailable(true);
    }
  }

  const loginErrorKind = getPlatformErrorKind(login.error);
  const message = login.error
    ? loginErrorKind === "unauthenticated"
      ? t("signIn.invalidCredentials")
      : loginErrorKind === "forbidden"
        ? t("signIn.notAuthorized")
        : t(platformErrorMessageKey(login.error, "signIn.unavailable"))
    : sessionUnavailable
      ? t(platformErrorMessageKey(session.error, "signIn.unavailable"))
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-md sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-8">
          <Link href="/signin" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">{t("signIn.backToAccount")}</Link>
          <p className="mt-8 text-xs font-semibold tracking-[0.18em] text-brand-600 uppercase dark:text-brand-400">{t("eyebrow")}</p>
          <h1 className="mt-2 text-title-md font-semibold text-gray-900 dark:text-white">{t("signIn.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{t("signIn.description")}</p>
        </div>
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          {message && <Alert variant="error" title={t("signIn.errorTitle")} message={message} />}
          <div>
            <Label htmlFor="platform-email">{t("signIn.email")}</Label>
            <Input id="platform-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="platform-password">{t("signIn.password")}</Label>
            <Input id="platform-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <Button className="w-full" disabled={login.isPending || session.isFetching}>
            {login.isPending ? t("signIn.submitting") : t("signIn.submit")}
          </Button>
        </form>
        <p className="mt-6 border-t border-gray-100 pt-5 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">{t("signIn.accessNote")}</p>
      </section>
    </main>
  );
}
