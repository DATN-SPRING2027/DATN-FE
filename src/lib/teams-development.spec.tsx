import { afterEach, expect, it, vi } from "vitest";
import TeamDevelopmentLayout from "@/app/[locale]/(admin)/projects/[projectId]/teams/layout";
import {
  teamDevelopmentEnabled,
  teamFixturePreviewEnabled,
} from "./teams-development";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
afterEach(() => vi.unstubAllEnvs());
it.each(["production", "development", "test"])(
  "blocks page rendering with flag off in %s",
  (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "false");
    expect(() => TeamDevelopmentLayout({ children: "private" })).toThrow(
      "NOT_FOUND",
    );
  },
);
it("cannot render production pages with the development flag on", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  expect(teamDevelopmentEnabled()).toBe(false);
  expect(() => TeamDevelopmentLayout({ children: "private" })).toThrow(
    "NOT_FOUND",
  );
});
it("allows page development only with explicit opt-in", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "true");
  expect(TeamDevelopmentLayout({ children: "development" })).toBe(
    "development",
  );
});
it("shows a fixture-only Team tab in development when API integration is off", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEAM_FOUNDATION_DEV_INTEGRATION", "false");
  expect(teamFixturePreviewEnabled()).toBe(true);
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
