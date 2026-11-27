import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ContinuumAiCompanion from "./ContinuumAiCompanion";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/dashboard",
}));

vi.mock("./WorkReportReminderNotice", () => ({
  default: () => null,
}));

vi.mock("./CompanionProjectPicker", () => ({
  default: () => null,
}));

vi.mock("./Robot3D", () => ({
  default: () => <canvas data-testid="mock-robot-3d-canvas" />,
}));

describe("ContinuumAiCompanion (FE-PERF-002)", () => {
  it("renders zero WebGL canvas elements while closed/idle on the dashboard", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ContinuumAiCompanion />
      </NextIntlClientProvider>,
    );

    expect(container.querySelectorAll("canvas")).toHaveLength(0);
    expect(screen.queryByTestId("mock-robot-3d-canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("robot-3d-stage")).toBeInTheDocument();
  });
});
