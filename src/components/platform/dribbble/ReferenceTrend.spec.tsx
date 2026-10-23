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
    expect(
      screen.queryByText("referenceCharts.simulated"),
    ).not.toBeInTheDocument();
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(within(tooltip).getByText("Apr 7, 2025")).toBeInTheDocument();
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(within(tooltip).getByText("Apr 6, 2025")).toBeInTheDocument();
    expect(within(tooltip).queryByText("Apr 7, 2025")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("liveDashboard.simulated").length,
    ).toBeGreaterThan(0);
  });
  it("shows ten table records per page and the final five-record page", () => {
    render(<ReferenceTrend title="Memberships" />);
    fireEvent.click(screen.getByText("liveDashboard.chartData"));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByText("Apr 1, 2025")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getByText("Apr 15, 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "next" })).toBeDisabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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
      height: 330,
      right: 1100,
      bottom: 350,
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
        clientX: 600,
        clientY: 150,
      }),
    );
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(within(tooltip).getByText("Apr 8, 2025")).toBeInTheDocument();
    fireEvent(
      chart,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 1099,
        clientY: 150,
      }),
    );
    expect(within(tooltip).getByText("Apr 15, 2025")).toBeInTheDocument();
  });
});
