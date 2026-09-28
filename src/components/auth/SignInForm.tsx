"use client";

import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Select from "@/components/form/Select";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery, useLoginMutation } from "@/lib/queries/auth/useAuth";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<readonly { id: string; name: string }[]>([]);
  const [sessionError, setSessionError] = useState(false);
  const t = useTranslations("auth");
  const router = useRouter();
  const currentUser = useCurrentUserQuery();
  const login = useLoginMutation();

  useEffect(() => {
    if (currentUser.isSuccess && !currentUser.isFetching && currentUser.data) router.replace("/");
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
      if (error instanceof ApiError && error.status === 409 && error.code === "ORGANIZATION_SELECTION_REQUIRED") {
        setOrganizations(error.organizations ?? []);
      }
    }
  }

  const error = login.error instanceof ApiError ? login.error : undefined;
  const errorMessage = sessionError ? t("sessionError") : error?.status === 401
    ? t("invalidCredentials") : error?.status === 409
      ? t("organizationRequired") : error?.status === 422
        ? t("invalidInput") : error?.status === 429
          ? t("rateLimited") : login.error ? t("unexpectedError") : null;

  return (
    <div className="flex w-full flex-1 flex-col lg:w-1/2">
      <div className="mx-auto mb-5 w-full max-w-md sm:pt-10">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="rtl:rotate-180" />
          Back to dashboard
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign in!
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {errorMessage && <Alert variant="error" title={t("signInError")} message={errorMessage} />}
                <div>
                  <Label htmlFor="signin-email">
                    Email <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input id="signin-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => { setEmail(event.target.value); setOrganizationId(""); setOrganizations([]); }} placeholder="info@gmail.com" />
                </div>
                <div>
                  <Label htmlFor="signin-password">
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      name="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); setOrganizationId(""); setOrganizations([]); }}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="inset-e-4 absolute top-1/2 z-30 -translate-y-1/2 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                </div>
                {organizations.length > 0 && (
                  <div>
                    <Label htmlFor="signin-organization">{t("organizationId")}</Label>
                    <Select id="signin-organization" placeholder={t("selectOrganization")} options={organizations.map((organization) => ({ value: organization.id, label: organization.name }))} onChange={setOrganizationId} />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block text-theme-sm font-normal text-gray-700 dark:text-gray-400">
                      Keep me logged in
                    </span>
                  </div>
                  <Link
                    href="/reset-password"
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div>
                  <Button className="w-full" size="sm" disabled={login.isPending || currentUser.isFetching || (organizations.length > 0 && !organizationId)}>
                    Sign in
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-center text-sm font-normal text-gray-700 sm:text-start dark:text-gray-400">
                Don&apos;t have an account? {""}
                <Link
                  href="/signup"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
