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
import {
  CheckCircleIcon,
  CheckLineIcon,
  ChevronLeftIcon,
  EnvelopeIcon,
  EyeCloseIcon,
  EyeIcon,
  LockIcon,
} from "@/icons";
import { useTranslations } from "next-intl";

export default function PasswordResetForm() {
  const t = useTranslations("auth");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [passwordSubmitAttempted, setPasswordSubmitAttempted] = useState(false);
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
    setPasswordSubmitAttempted(true);
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

  // Password criteria calculations
  const passwordLength = Array.from(password).length;
  const passwordBytes = new TextEncoder().encode(password).length;
  const isLengthValid = passwordLength >= 12 && passwordBytes <= 72;
  const isMatchValid = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = passwordSubmitAttempted && password !== confirmPassword;

  // Password strength score (0 to 3)
  const strengthScore = (() => {
    if (!password) return 0;
    if (passwordLength < 12) return 1;
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const hasUpperAndLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
    if (passwordLength >= 14 && (hasNumber || hasSpecial) && hasUpperAndLower) return 3;
    return 2;
  })();

  const strengthLabels = ["", t("passwordStrengthWeak"), t("passwordStrengthFair"), t("passwordStrengthStrong")];
  const strengthColors = [
    "",
    "bg-error-500",
    "bg-warning-500",
    "bg-success-500",
  ];

  return (
    <div className="flex w-full flex-1 flex-col justify-between overflow-y-auto px-6 py-8 sm:px-10 lg:w-1/2 lg:py-12">
      {/* Top Navigation */}
      <div className="mx-auto mb-6 w-full max-w-md">
        <Link
          href="/signin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" />
          <span>{t("backToSignIn")}</span>
        </Link>
      </div>

      {/* Main Centered Form Container */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {passwordUpdated ? (
          /* ========================================================
             STATE 3: Password Updated Successfully
             ======================================================== */
          <section aria-labelledby="reset-success-title" className="space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600 ring-1 ring-success-500/20 dark:bg-success-500/10 dark:text-success-400">
              <CheckCircleIcon className="h-7 w-7" />
            </div>

            <div>
              <h1
                id="reset-success-title"
                className="text-title-sm font-bold tracking-tight text-gray-900 sm:text-title-md dark:text-white/95"
              >
                {t("resetPasswordSuccessTitle")}
              </h1>
            </div>

            <Alert
              variant="success"
              title={t("resetPasswordSuccessTitle")}
              message={t("resetPasswordSuccessMessage")}
            />

            <Link
              href="/signin"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {t("backToSignIn")}
            </Link>
          </section>
        ) : token ? (
          /* ========================================================
             STATE 2: Set New Password (Token present)
             ======================================================== */
          <div className="space-y-6">
            <header>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
                <LockIcon className="h-6 w-6" />
              </div>
              <h1 className="text-title-sm font-bold tracking-tight text-gray-900 sm:text-title-md dark:text-white/95">
                {t("setNewPasswordTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
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

            {passwordPolicyError && (
              <p role="alert" className="text-sm font-medium text-error-500">
                {t("passwordLengthError")}
              </p>
            )}

            <form onSubmit={submitNewPassword} className="space-y-5">
              <div>
                <Label htmlFor="new-password">{t("newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setPasswordPolicyError(false);
                    }}
                    placeholder="••••••••••••"
                    className="pe-11 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeIcon className="h-5 w-5" />
                    ) : (
                      <EyeCloseIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Password strength & validation checklist */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 w-32">
                        {[1, 2, 3].map((bar) => (
                          <div
                            key={bar}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              strengthScore >= bar
                                ? strengthColors[strengthScore]
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {strengthLabels[strengthScore]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                          isLengthValid
                            ? "bg-success-500 text-white"
                            : "bg-gray-200 text-gray-400 dark:bg-gray-700"
                        }`}
                      >
                        <CheckLineIcon className="h-2.5 w-2.5" />
                      </span>
                      <span
                        className={
                          isLengthValid
                            ? "text-success-600 dark:text-success-400 font-medium"
                            : "text-gray-500 dark:text-gray-400"
                        }
                      >
                        {t("passwordHintLength")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••••••"
                    className="pe-11 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeIcon className="h-5 w-5" />
                    ) : (
                      <EyeCloseIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full ${
                        isMatchValid
                          ? "bg-success-500 text-white"
                          : "bg-gray-200 text-gray-400 dark:bg-gray-700"
                      }`}
                    >
                      <CheckLineIcon className="h-2.5 w-2.5" />
                    </span>
                    <span
                      className={
                        isMatchValid
                          ? "text-success-600 dark:text-success-400 font-medium"
                          : "text-gray-500 dark:text-gray-400"
                      }
                    >
                      {t("passwordHintMatch")}
                    </span>
                  </div>
                )}

                {passwordMismatch && (
                  <p role="alert" className="mt-2 text-sm font-medium text-error-500">
                    {t("passwordMismatch")}
                  </p>
                )}
              </div>

              <Button
                className="w-full h-11 cursor-pointer"
                size="md"
                disabled={completeReset.isPending}
              >
                {completeReset.isPending ? (
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin"
                    />
                    <span>{t("savingPassword")}</span>
                  </span>
                ) : (
                  t("resetPasswordAction")
                )}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-3 pt-2 text-center text-sm">
              <Link
                href="/reset-password"
                className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                {t("requestAnotherReset")}
              </Link>
              <SignInLink label={t("backToSignIn")} />
            </div>
          </div>
        ) : requestAccepted ? (
          /* ========================================================
             STATE 1b: Request Accepted (Check Email Confirmation)
             ======================================================== */
          <div className="space-y-6">
            <header>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-success-50 text-success-600 ring-1 ring-success-500/20 dark:bg-success-500/10 dark:text-success-400">
                <EnvelopeIcon className="h-6 w-6" />
              </div>
              <h1 className="text-title-sm font-bold tracking-tight text-gray-900 sm:text-title-md dark:text-white/95">
                {t("resetRequestAcceptedTitle")}
              </h1>
            </header>

            <Alert
              variant="success"
              title={t("resetRequestAcceptedTitle")}
              message={t("resetRequestAcceptedMessage")}
            />

            {email && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Target address:
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white">
                  {email}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <p>{t("checkSpamHelp")}</p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRequestAccepted(false)}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5 cursor-pointer"
              >
                {t("requestAnotherReset")}
              </button>

              <div className="text-center">
                <SignInLink label={t("backToSignIn")} />
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             STATE 1: Request Password Reset Form
             ======================================================== */
          <div className="space-y-6">
            <header>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">
                <LockIcon className="h-6 w-6" />
              </div>
              <h1 className="text-title-sm font-bold tracking-tight text-gray-900 sm:text-title-md dark:text-white/95">
                {t("forgotPasswordTitle")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {t("forgotPasswordDescription")}
              </p>
            </header>

            {requestReset.error && (
              <Alert
                variant="error"
                title={t("resetRequestErrorTitle")}
                message={
                  requestError?.status === 429
                    ? t("resetRateLimited")
                    : t("resetRequestErrorMessage")
                }
              />
            )}

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
                  placeholder={t("emailPlaceholder")}
                  hint={t("emailHelp")}
                />
              </div>

              <Button
                className="w-full h-11 cursor-pointer"
                size="md"
                disabled={requestReset.isPending}
              >
                {requestReset.isPending ? (
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin"
                    />
                    <span>{t("sendingResetLink")}</span>
                  </span>
                ) : (
                  t("sendResetLink")
                )}
              </Button>
            </form>

            <div className="pt-2 text-center">
              <SignInLink label={t("backToSignIn")} />
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Footnote */}
      <div className="mx-auto mt-8 w-full max-w-md text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {t("securityFootnote")}
        </p>
      </div>
    </div>
  );
}

function SignInLink({ label }: { label: string }) {
  return (
    <Link
      href="/signin"
      className="inline-flex items-center text-sm font-medium text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400"
    >
      {label}
    </Link>
  );
}
