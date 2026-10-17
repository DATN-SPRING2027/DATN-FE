"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { useTranslations } from "next-intl";
import { useState } from "react";
import styles from "./auth-experience.module.css";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const t = useTranslations("auth");
  const ui = useTranslations("authExperience");

  return (
    <main className={styles.signup}>
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
      <form className={styles.signinForm}>
        <div className={styles.nameFields}>
          <div className={styles.field}>
            <Label htmlFor="fname">{ui("firstName")}</Label>
            <Input
              id="fname"
              name="fname"
              type="text"
              autoComplete="given-name"
              placeholder={ui("firstName")}
            />
          </div>
          <div className={styles.field}>
            <Label htmlFor="lname">{ui("lastName")}</Label>
            <Input
              id="lname"
              name="lname"
              type="text"
              autoComplete="family-name"
              placeholder={ui("lastName")}
            />
          </div>
        </div>
        <div className={styles.field}>
          <Label htmlFor="signup-email">{ui("email")}</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={ui("emailPlaceholder")}
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="signup-password">{ui("password")}</Label>
          <Input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={ui("passwordPlaceholder")}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={ui(showPassword ? "hidePassword" : "showPassword")}
            aria-pressed={showPassword}
            aria-controls="signup-password"
          >
            {showPassword ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeCloseIcon aria-hidden="true" />
            )}
          </button>
        </div>
        <div className={styles.agreement}>
          <Checkbox
            checked={isChecked}
            onChange={setIsChecked}
            label={ui("signupAgreement")}
          />
        </div>
        <Button className={styles.primaryButton}>
          {ui("signupAction")}
          <ArrowRightIcon
            aria-hidden="true"
            className="h-5 w-5 rtl:rotate-180"
          />
        </Button>
      </form>
      <div className={styles.separator}>{ui("alternative")}</div>
      <div className={styles.googleButton}>
        <GoogleOAuthButton label={t("signUpWithGoogle")} />
      </div>
    </main>
  );
}
