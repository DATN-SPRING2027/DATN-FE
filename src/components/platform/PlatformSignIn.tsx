"use client";

import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ArrowRightIcon, EnvelopeIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import {
  usePlatformLoginMutation,
  usePlatformSessionQuery,
} from "@/lib/queries/platform/usePlatformConsole";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import styles from "@/components/auth/auth-experience.module.css";

export default function PlatformSignIn() {
  const t = useTranslations("platformConsole");
  const router = useRouter();
  const session = usePlatformSessionQuery();
  const login = usePlatformLoginMutation();
  const ui = useTranslations("authExperience");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const error = login.error instanceof ApiError ? login.error : undefined;
  const message = error?.status === 401
    ? t("signIn.invalidCredentials")
    : error?.status === 403
      ? t("signIn.notAuthorized")
      : sessionUnavailable || login.isError
        ? t("signIn.unavailable")
        : null;

  return (
    <main className={styles.signin}>
      <header className={styles.formHeading}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1>
          {t("signIn.title")}
          <span aria-hidden="true">.</span>
        </h1>
        <p className={styles.introduction}>{t("signIn.description")}</p>
        <p className={`${styles.introduction} mt-3`}>
          <Link href="/signin">{t("signIn.backToAccount")}</Link>
        </p>
      </header>
      <form
        className={styles.signinForm}
        onSubmit={(event) => void handleSubmit(event)}
      >
        {message && (
          <Alert
            variant="error"
            title={t("signIn.errorTitle")}
            message={message}
          />
        )}
        <div className={styles.field}>
          <Label htmlFor="platform-email">{ui("email")}</Label>
          <Input
            id="platform-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={ui("emailPlaceholder")}
          />
          <EnvelopeIcon aria-hidden="true" className={styles.fieldIcon} />
        </div>
        <div className={styles.field}>
          <Label htmlFor="platform-password">{ui("password")}</Label>
          <Input
            id="platform-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={ui("passwordPlaceholder")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={styles.passwordToggle}
            aria-label={ui(showPassword ? "hidePassword" : "showPassword")}
            aria-pressed={showPassword}
            aria-controls="platform-password"
          >
            {showPassword ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeCloseIcon aria-hidden="true" />
            )}
          </button>
        </div>
        <Button
          type="submit"
          className={styles.primaryButton}
          disabled={login.isPending || session.isFetching}
          endIcon={
            <ArrowRightIcon
              aria-hidden="true"
              className="h-4 w-4 rtl:rotate-180"
            />
          }
        >
          {login.isPending ? t("signIn.submitting") : t("signIn.submit")}
        </Button>
      </form>
      <p className={styles.formNote}>{t("signIn.accessNote")}</p>
    </main>
  );
}
