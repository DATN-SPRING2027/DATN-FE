import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText("referenceCharts.simulated")).toBeVisible();
    expect(screen.getByText("Aug 15, 2026")).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Aug 14, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Aug 15, 2026")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("liveDashboard.simulated").length,
    ).toBeGreaterThan(0);
  });
  it("shows ten table records per page and the final one-record page", () => {
    render(<ReferenceTrend title="Memberships" />);
    fireEvent.click(screen.getByText("liveDashboard.chartData"));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByText("Jul 20, 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByText("Jul 30, 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Aug 19, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "next" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "20" } });
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    expect(within(table).getByText("Jul 20, 2026")).toBeInTheDocument();
  });
  it("maps pointer positions correctly when the SVG is horizontally letterboxed", () => {
    render(<ReferenceTrend title="Memberships" />);
    const chart = screen.getByRole("img", {
      name: "Memberships · liveDashboard.simulated",
    });
    const bounds = {
      x: 100,
      y: 20,
      left: 100,
      top: 20,
      width: 1000,
      height: 300,
      right: 1100,
      bottom: 320,
      toJSON: () => ({}),
    };
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue(bounds);
    vi.spyOn(chart.parentElement!, "getBoundingClientRect").mockReturnValue(
      bounds,
    );
    fireEvent(
      chart,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 595,
        clientY: 150,
      }),
    );
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(within(tooltip).getByText("Aug 4, 2026")).toBeInTheDocument();
    fireEvent(
      chart,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 952,
        clientY: 150,
      }),
    );
    expect(within(tooltip).getByText("Aug 19, 2026")).toBeInTheDocument();
  });
});
