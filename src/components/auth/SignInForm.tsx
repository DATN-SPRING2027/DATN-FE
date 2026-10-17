"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import Select from "@/components/form/Select";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import {
  useCurrentUserQuery,
  useLoginMutation,
} from "@/lib/queries/auth/useAuth";
import { ArrowRightIcon, EnvelopeIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./auth-experience.module.css";

export default function SignInForm({
  googleStatus,
}: {
  googleStatus?: "organization-required" | "failed" | "cancelled";
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<
    readonly { id: string; name: string }[]
  >([]);
  const [sessionError, setSessionError] = useState(false);
  const t = useTranslations("auth");
  const ui = useTranslations("authExperience");
  const router = useRouter();
  const currentUser = useCurrentUserQuery();
  const login = useLoginMutation();

  useEffect(() => {
    if (currentUser.isSuccess && !currentUser.isFetching && currentUser.data) {
      router.replace("/select-organization");
    }
  }, [currentUser.isSuccess, currentUser.isFetching, currentUser.data, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSessionError(false);
    try {
      await login.mutateAsync({
        email: email.trim(),
        password,
        ...(organizationId ? { organizationId: organizationId.trim() } : {}),
      });
      const session = await currentUser.refetch();
      if (!session.data) setSessionError(true);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "ORGANIZATION_SELECTION_REQUIRED"
      ) {
        setOrganizations(error.organizations ?? []);
      }
    }
  }

  const error = login.error instanceof ApiError ? login.error : undefined;
  const errorMessage = sessionError
    ? t("sessionError")
    : error?.status === 401
      ? t("invalidCredentials")
      : error?.status === 409
        ? t("organizationRequired")
        : error?.status === 422
          ? t("invalidInput")
          : error?.status === 429
            ? t("rateLimited")
            : login.error
              ? t("unexpectedError")
              : null;
  const googleMessage =
    googleStatus === "organization-required"
      ? t("googleOrganizationRequired")
      : googleStatus === "cancelled"
        ? t("googleCancelled")
        : googleStatus === "failed"
          ? t("googleFailed")
          : null;

  return (
    <main className={styles.signin}>
      <header className={styles.formHeading}>
        <p className={styles.eyebrow}>{ui("eyebrow")}</p>
        <h1>
          {ui("signinTitle")}
          <span aria-hidden="true">.</span>
        </h1>
        <p className={styles.introduction}>
          {ui("signinHint")} <Link href="/signup">{ui("signinJoin")}</Link>
        </p>
      </header>
      {googleMessage && (
        <Alert
          variant="error"
          title={t("googleSignInError")}
          message={googleMessage}
        />
      )}
      <form onSubmit={handleSubmit} className={styles.signinForm}>
        {errorMessage && (
          <Alert
            variant="error"
            title={t("signInError")}
            message={errorMessage}
          />
        )}
        <div className={styles.field}>
          <Label htmlFor="signin-email">{ui("email")}</Label>
          <Input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setOrganizationId("");
              setOrganizations([]);
            }}
            placeholder={ui("emailPlaceholder")}
          />
          <EnvelopeIcon aria-hidden="true" className={styles.fieldIcon} />
        </div>
        <div className={styles.field}>
          <Label htmlFor="signin-password">{ui("password")}</Label>
          <Input
            id="signin-password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setOrganizationId("");
              setOrganizations([]);
            }}
            type={showPassword ? "text" : "password"}
            placeholder={ui("passwordPlaceholder")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={styles.passwordToggle}
            aria-label={ui(showPassword ? "hidePassword" : "showPassword")}
            aria-pressed={showPassword}
            aria-controls="signin-password"
          >
            {showPassword ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeCloseIcon aria-hidden="true" />
            )}
          </button>
        </div>
        {organizations.length > 0 && (
          <div className={styles.organizationSelect}>
            <Label htmlFor="signin-organization">{t("organizationId")}</Label>
            <Select
              id="signin-organization"
              placeholder={t("selectOrganization")}
              options={organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              }))}
              onChange={setOrganizationId}
            />
          </div>
        )}
        <div className={styles.formOptions}>
          <Checkbox
            label={ui("remember")}
            checked={isChecked}
            onChange={setIsChecked}
          />
          <Link href="/reset-password">{t("forgotPasswordLink")}</Link>
        </div>
        <Button
          type="submit"
          className={styles.primaryButton}
          disabled={
            login.isPending ||
            currentUser.isFetching ||
            (organizations.length > 0 && !organizationId)
          }
          endIcon={
            <ArrowRightIcon
              aria-hidden="true"
              className="h-4 w-4 rtl:rotate-180"
            />
          }
        >
          {ui(login.isPending ? "signingIn" : "signIn")}
        </Button>
      </form>
      <div className={styles.separator}>
        <span>{ui("alternative")}</span>
      </div>
      <div className={styles.googleButton}>
        <GoogleOAuthButton label={t("continueWithGoogle")} />
      </div>
    </main>
  );
}
