import { GoogleIcon } from "@/icons";

export default function GoogleOAuthButton({ label }: { label: string }) {
  return (
    <form action="/api/auth/google" method="get">
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
      >
        <GoogleIcon aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
