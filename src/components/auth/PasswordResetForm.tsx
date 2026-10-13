"use client";

import { useLayoutEffect, useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import { ApiError } from "@/lib/api-client";
import {
  useCompletePasswordResetMutation,
  useRequestPasswordResetMutation,
} from "@/lib/queries/auth/useAuth";
import { useTranslations } from "next-intl";

export default function PasswordResetForm() {
  const t = useTranslations("auth");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [passwordPolicyError, setPasswordPolicyError] = useState(false);
  const requestReset = useRequestPasswordResetMutation();
  const completeReset = useCompletePasswordResetMutation();

  useLayoutEffect(() => {
    if (!window.location.hash && !window.location.search) return;

    const resetToken = new URLSearchParams(
      window.location.hash.slice(1),
    ).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    // Capture this client-only credential before removing it from browser history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(resetToken ?? "");
  }, []);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestAccepted(false);
    try {
      await requestReset.mutateAsync({ email: email.trim() });
      setRequestAccepted(true);
    } catch {
      // The API deliberately gives no account-specific response.
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMismatch(password !== confirmPassword);
    const passwordLength = Array.from(password).length;
    const passwordBytes = new TextEncoder().encode(password).length;
    const passwordIsValid = passwordLength >= 12 && passwordBytes <= 72;
    setPasswordPolicyError(!passwordIsValid);
    if (password !== confirmPassword || !passwordIsValid || !token) return;

    try {
      await completeReset.mutateAsync({ token, password });
      setPasswordUpdated(true);
    } catch {
      // The UI maps invalid, expired and consumed tokens to one message.
    }
  }

  const requestError =
    requestReset.error instanceof ApiError ? requestReset.error : undefined;
  const confirmError =
    completeReset.error instanceof ApiError ? completeReset.error : undefined;

  if (passwordUpdated) {
    return (
      <section aria-labelledby="reset-success-title" className="space-y-5">
        <Alert
          variant="success"
          title={t("resetPasswordSuccessTitle")}
          message={t("resetPasswordSuccessMessage")}
        />
        <SignInLink label={t("backToSignIn")} />
      </section>
    );
  }

  if (token) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
            {t("setNewPasswordTitle")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("setNewPasswordDescription")}
          </p>
        </header>
        {confirmError?.status === 400 ||
        confirmError?.code === "VALIDATION_FAILED" ? (
          <Alert
            variant="error"
            title={t("resetPasswordInvalidTitle")}
            message={t("resetPasswordInvalidMessage")}
          />
        ) : completeReset.error ? (
          <Alert
            variant="error"
            title={t("resetPasswordErrorTitle")}
            message={
              confirmError?.status === 429
                ? t("resetRateLimited")
                : confirmError?.code === "PASSWORD_RESET_PASSWORD_INVALID"
                  ? t("passwordLengthError")
                : t("resetPasswordErrorMessage")
            }
          />
        ) : null}
        {passwordPolicyError ? (
          <p role="alert" className="text-sm text-error-500">
            {t("passwordLengthError")}
          </p>
        ) : null}
        <form onSubmit={submitNewPassword} className="space-y-5">
          <div>
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordPolicyError(false);
              }}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {passwordMismatch && (
              <p role="alert" className="mt-2 text-sm text-error-500">
                {t("passwordMismatch")}
              </p>
            )}
          </div>
          <Button
            className="w-full"
            size="sm"
            disabled={completeReset.isPending}
          >
            {completeReset.isPending
              ? t("savingPassword")
              : t("resetPasswordAction")}
          </Button>
        </form>
        <Link
          href="/reset-password"
          className="inline-flex text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          {t("requestAnotherReset")}
        </Link>
        <SignInLink label={t("backToSignIn")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
          {t("forgotPasswordTitle")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("forgotPasswordDescription")}
        </p>
      </header>
      {requestAccepted ? (
        <Alert
          variant="success"
          title={t("resetRequestAcceptedTitle")}
          message={t("resetRequestAcceptedMessage")}
        />
      ) : null}
      {requestReset.error ? (
        <Alert
          variant="error"
          title={t("resetRequestErrorTitle")}
          message={
            requestError?.status === 429
              ? t("resetRateLimited")
              : t("resetRequestErrorMessage")
          }
        />
      ) : null}
      <form onSubmit={submitRequest} className="space-y-5">
        <div>
          <Label htmlFor="reset-email">{t("email")}</Label>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button className="w-full" size="sm" disabled={requestReset.isPending}>
          {requestReset.isPending ? t("sendingResetLink") : t("sendResetLink")}
        </Button>
      </form>
      <SignInLink label={t("backToSignIn")} />
    </div>
  );
}

function SignInLink({ label }: { label: string }) {
  return (
    <Link
      href="/signin"
      className="inline-flex text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
    >
      {label}
    </Link>
  );
}
