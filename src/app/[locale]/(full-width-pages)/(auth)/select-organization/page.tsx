import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { parseGoogleOrganizationOptions } from "@/lib/auth/google-organization-options";

export default async function SelectOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ options?: string | string[] }>;
}) {
  const query = await searchParams;
  const organizations = parseGoogleOrganizationOptions(query.options);
  if (!organizations) redirect("/signin?google=failed");

  const t = await getTranslations("auth");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
        {t("googleSelectOrganization")}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {t("googleSelectOrganizationDescription")}
      </p>
      <form action="/api/auth/google" method="get" className="mt-6 space-y-5">
        <label
          htmlFor="google-organization"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t("organizationId")}
        </label>
        <select
          id="google-organization"
          name="organizationId"
          required
          defaultValue=""
          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90"
        >
          <option value="" disabled>
            {t("selectOrganization")}
          </option>
          {organizations.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {t("continueWithGoogle")}
        </button>
      </form>
      <Link href="/signin" className="mt-5 text-center text-sm text-brand-500">
        {t("backToSignIn")}
      </Link>
    </main>
  );
}
