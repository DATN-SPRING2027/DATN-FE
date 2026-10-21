import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OperatorReferenceChart from "./OperatorReferenceChart";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({ series, type }: { series: unknown[]; type: string }) => (
      <div data-testid="chart" data-type={type} data-series={series.length} />
    ),
}));
describe("single-series reference charts", () => {
  it("renders one fixed area chart without alternate chart controls", () => {
    render(<OperatorReferenceChart title="Memberships" />);
    expect(screen.getByRole("img", { name: "referenceCharts.notice" })).toBeInTheDocument();
    expect(screen.getByTestId("chart")).toHaveAttribute("data-type", "area");
    expect(screen.getByTestId("chart")).toHaveAttribute("data-series", "1");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("renders a single bar series for Users", () => {
    render(<OperatorReferenceChart title="Users" bars />);
    expect(screen.getByTestId("chart")).toHaveAttribute("data-type", "bar");
    expect(screen.getByTestId("chart")).toHaveAttribute("data-series", "1");
  });
});
