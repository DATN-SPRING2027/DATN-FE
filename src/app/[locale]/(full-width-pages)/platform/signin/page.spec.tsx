import { expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import LegacyPlatformSignInPage from "./page";
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
it.each(["en", "ar", "es", "de"])(
  "redirects the old admin sign-in to the shared form in %s",
  async (locale) => {
    await LegacyPlatformSignInPage({ params: Promise.resolve({ locale }) });
    expect(redirect).toHaveBeenLastCalledWith({ href: "/signin", locale });
  },
);
