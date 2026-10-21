"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useRequestEmailRegistrationMutation } from "@/lib/queries/auth/useAuth";
import { ArrowRightIcon, ChevronLeftIcon, EnvelopeIcon } from "@/icons";
import styles from "./auth-experience.module.css";

export default function SignUpForm({ initialEmail }: { initialEmail?: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [isChecked, setIsChecked] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
  const t = useTranslations("auth");
  const ui = useTranslations("authExperience");
  const registration = useRequestEmailRegistrationMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestAccepted(false);
    try {
      await registration.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
      });
      setRequestAccepted(true);
    } catch {
      // The API uses one generic response for every syntactically valid email.
    }
  }

  const requestError =
    registration.error instanceof ApiError ? registration.error : undefined;

  return (
    <main className={styles.signup}>
      {!requestAccepted ? (
        <header className={styles.formHeading}>
          <p className={styles.eyebrow}>{ui("signupEyebrow")}</p>
          <h1>
            {ui("signupTitle")}
            <span>.</span>
          </h1>
          <p className={styles.introduction}>
            {ui("signupHint")} <Link href="/signin">{ui("signIn")}</Link>
          </p>
        </header>
      ) : null}

      {requestAccepted ? (
        <section
          aria-live="polite"
          aria-labelledby="signup-confirmation-title"
          className={styles.authConfirmation}
          role="status"
        >
          <div className={styles.authConfirmationIcon}>
            <EnvelopeIcon aria-hidden="true" />
          </div>
          <h1 id="signup-confirmation-title">
            {t("emailRegistrationRequestAcceptedTitle")}
          </h1>
          <p className={styles.authConfirmationMessage}>
            {t("emailRegistrationRequestAcceptedMessage")}
          </p>
          <div className={styles.authConfirmationRecipient}>
            <span>{ui("email")}</span>
            <strong>{email.trim()}</strong>
          </div>
          <Link href="/signin" className={styles.authConfirmationLink}>
            <ChevronLeftIcon aria-hidden="true" />
            <span>{t("backToSignIn")}</span>
          </Link>
        </section>
      ) : (
        <form className={styles.signinForm} onSubmit={submit}>
          {registration.error ? (
            <Alert
              variant="error"
              title={t("emailRegistrationRequestErrorTitle")}
              message={
                requestError?.status === 429
                  ? t("emailRegistrationRateLimited")
                  : t("emailRegistrationRequestErrorMessage")
              }
            />
          ) : null}
          <div className={styles.field}>
            <Label htmlFor="signup-full-name">{ui("fullName")}</Label>
            <Input
              id="signup-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              maxLength={160}
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder={ui("fullName")}
            />
          </div>
          <div className={styles.field}>
            <Label htmlFor="signup-email">{ui("email")}</Label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={ui("emailPlaceholder")}
            />
          </div>
          <div className={styles.agreement}>
            <Checkbox
              checked={isChecked}
              onChange={setIsChecked}
              label={ui("signupAgreement")}
            />
          </div>
          <Button
            type="submit"
            className={styles.primaryButton}
            disabled={registration.isPending}
          >
            {registration.isPending
              ? t("emailRegistrationSending")
              : ui("signupAction")}
            <ArrowRightIcon
              aria-hidden="true"
              className="h-5 w-5 rtl:rotate-180"
            />
          </Button>
        </form>
      )}

      {!requestAccepted ? (
        <>
          <div className={styles.separator}>{ui("alternative")}</div>
          <div className={styles.googleButton}>
            <GoogleOAuthButton label={t("signUpWithGoogle")} />
          </div>
        </>
      ) : null}
    </main>
  );
}
