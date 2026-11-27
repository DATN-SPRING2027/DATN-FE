import { afterEach, expect, it, vi } from "vitest";
import TeamDevelopmentLayout from "@/app/[locale]/(admin)/projects/[projectId]/teams/layout";
import {
  teamDevelopmentEnabled,
  teamFixturePreviewEnabled,
} from "./teams-development";
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  redirect: ({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`REDIRECT:${locale}:${href}`);
  },
}));
afterEach(() => vi.unstubAllEnvs());
it.each(["production", "development", "test"])(
  "blocks page rendering and redirects to Project Members with flag off in %s",
  async (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "false");
    await expect(
      TeamDevelopmentLayout({
        children: "private",
        params: Promise.resolve({ locale: "vi", projectId: "proj-1" }),
      }),
    ).rejects.toThrow("REDIRECT:vi:/projects/proj-1/members");
  },
);
it("cannot render production pages with the development flag on", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  expect(teamDevelopmentEnabled()).toBe(false);
  await expect(
    TeamDevelopmentLayout({
      children: "private",
      params: Promise.resolve({ locale: "en", projectId: "proj-2" }),
    }),
  ).rejects.toThrow("REDIRECT:en:/projects/proj-2/members");
});
it("allows page development only with explicit opt-in", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  await expect(
    TeamDevelopmentLayout({
      children: "development",
      params: Promise.resolve({ locale: "vi", projectId: "proj-1" }),
    }),
  ).resolves.toBe("development");
});
it("keeps the fixture Team tab hidden in development while Teams UI is deferred", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "false");
  expect(teamFixturePreviewEnabled()).toBe(false);
  expect(teamFixturePreviewEnabled("fixture")).toBe(false);
});
it("uses the API workspace only after the development integration opt-in", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  expect(teamFixturePreviewEnabled()).toBe(false);
});
it("never exposes fixture mode in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "false");
  expect(teamFixturePreviewEnabled()).toBe(false);
});
