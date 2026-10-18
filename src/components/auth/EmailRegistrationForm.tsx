"use client";

import { useLayoutEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useVerifyEmailRegistrationMutation } from "@/lib/queries/auth/useAuth";
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  EyeCloseIcon,
  EyeIcon,
  LockIcon,
} from "@/icons";
import styles from "./auth-experience.module.css";

export default function EmailRegistrationForm() {
  const t = useTranslations("auth");
  const ui = useTranslations("authExperience");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSubmitAttempted, setPasswordSubmitAttempted] = useState(false);
  const [passwordPolicyError, setPasswordPolicyError] = useState(false);
  const [verified, setVerified] = useState(false);
  const verifyRegistration = useVerifyEmailRegistrationMutation();

  useLayoutEffect(() => {
    if (!window.location.hash && !window.location.search) return;
    const verificationToken = new URLSearchParams(
      window.location.hash.slice(1),
    ).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    // Capture this client-only credential before removing it from browser history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(
      verificationToken && /^[A-Za-z0-9_-]{43}$/.test(verificationToken)
        ? verificationToken
        : "",
    );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSubmitAttempted(true);
    const passwordLength = Array.from(password).length;
    const passwordIsValid =
      passwordLength >= 12 &&
      passwordLength <= 72 &&
      new TextEncoder().encode(password).length <= 72;
    setPasswordPolicyError(!passwordIsValid);
    if (!passwordIsValid || password !== confirmPassword || !token) return;

    try {
      await verifyRegistration.mutateAsync({ token, password });
      setVerified(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      // Invalid, expired and consumed links share one message.
    }
  }

  const verifyError =
    verifyRegistration.error instanceof ApiError
      ? verifyRegistration.error
      : undefined;
  const tokenUnavailable =
    !token ||
    verifyError?.status === 400 ||
    verifyError?.code === "EMAIL_REGISTRATION_TOKEN_INVALID";
  const passwordMismatch =
    passwordSubmitAttempted && password !== confirmPassword;

  return (
    <main className={styles.resetForm}>
      {!verified ? (
        <div className="mx-auto mb-6 w-full max-w-md">
          <Link
            href="/signin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" />
            <span>{t("backToSignIn")}</span>
          </Link>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-6">
        {verified ? (
          <section
            aria-live="polite"
            aria-labelledby="email-registration-success-title"
            className={styles.authConfirmation}
            role="status"
          >
            <div
              className={`${styles.authConfirmationIcon} ${styles.authConfirmationIconSuccess}`}
            >
              <CheckCircleIcon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 id="email-registration-success-title">
              {t("emailRegistrationSuccessTitle")}
            </h1>
            <p className={styles.authConfirmationMessage}>
              {t("emailRegistrationSuccessMessage")}
            </p>
            <Link
              href="/signin"
              className={styles.authConfirmationAction}
            >
              {t("backToSignIn")}
            </Link>
          </section>
        ) : tokenUnavailable ? (
          <section aria-live="polite" className="space-y-5">
            <Alert
              variant="error"
              title={t("emailRegistrationInvalidTitle")}
              message={t("emailRegistrationInvalidMessage")}
            />
            <Link
              href="/signup"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
            >
              {t("emailRegistrationStartAgain")}
            </Link>
          </section>
        ) : (
          <section className="space-y-6">
            <header>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
                <LockIcon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="text-title-sm font-bold tracking-tight text-gray-900 sm:text-title-md dark:text-white/95">
                {t("emailRegistrationChoosePasswordTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {t("emailRegistrationChoosePasswordDescription")}
              </p>
            </header>

            {verifyRegistration.error ? (
              <Alert
                variant="error"
                title={t("emailRegistrationVerifyErrorTitle")}
                message={
                  verifyError?.status === 429
                    ? t("emailRegistrationRateLimited")
                    : verifyError?.status === 422 || passwordPolicyError
                      ? t("passwordLengthError")
                      : t("emailRegistrationVerifyErrorMessage")
                }
              />
            ) : null}

            {passwordMismatch ? (
              <p role="alert" className="text-sm font-medium text-error-500">
                {t("passwordMismatch")}
              </p>
            ) : null}
            {passwordPolicyError ? (
              <p role="alert" className="text-sm font-medium text-error-500">
                {t("passwordLengthError")}
              </p>
            ) : null}

            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="registration-password">
                  {t("newPassword")}
                </Label>
                <div className="relative">
                  <Input
                    id="registration-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                    className="pe-12"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setPasswordPolicyError(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.passwordToggle}
                    aria-label={
                      ui(showPassword ? "hidePassword" : "showPassword")
                    }
                    aria-pressed={showPassword}
                    aria-controls="registration-password"
                  >
                    {showPassword ? (
                      <EyeIcon aria-hidden="true" />
                    ) : (
                      <EyeCloseIcon aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="registration-password-confirm">
                  {t("confirmPassword")}
                </Label>
                <div className="relative">
                  <Input
                    id="registration-password-confirm"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                    className="pe-12"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={styles.passwordToggle}
                    aria-label={
                      ui(
                        showConfirmPassword
                          ? "hideConfirmPassword"
                          : "showConfirmPassword",
                      )
                    }
                    aria-pressed={showConfirmPassword}
                    aria-controls="registration-password-confirm"
                  >
                    {showConfirmPassword ? (
                      <EyeIcon aria-hidden="true" />
                    ) : (
                      <EyeCloseIcon aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyRegistration.isPending}
              >
                {verifyRegistration.isPending
                  ? t("emailRegistrationSavingPassword")
                  : t("emailRegistrationSetPasswordAction")}
              </Button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
