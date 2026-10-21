import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReferenceTrend from "./ReferenceTrend";
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
describe("labelled reference simulation", () => {
  it("exposes the simulation label and moves the tooltip by keyboard", () => {
    render(<ReferenceTrend title="Memberships" />);
    const chart = screen.getByRole("img", {
      name: "Memberships · liveDashboard.simulated",
    });
    expect(screen.getByText("Aug 15, 2026")).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Aug 14, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Aug 15, 2026")).not.toBeInTheDocument();
    expect(screen.getAllByText("liveDashboard.simulated").length).toBeGreaterThan(0);
  });
});
