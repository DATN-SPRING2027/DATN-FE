import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformPagination from "./PlatformPagination";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `pagination.${key}`,
}));

describe("PlatformPagination", () => {
  it("moves between available pages and disables boundary controls", () => {
    const onPageChange = vi.fn();
    render(
      <PlatformPagination
        ariaLabel="pagination.label"
        page={1}
        totalPages={3}
        totalItems={205}
        onPageChange={onPageChange}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "pagination.label" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "pagination.previous" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("does not render controls for a single page", () => {
    render(
      <PlatformPagination
        ariaLabel="pagination.label"
        page={1}
        totalPages={1}
        totalItems={5}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
  it("shows disabled controls for a dashboard with one page", () => {
    render(
      <PlatformPagination
        alwaysShow
        ariaLabel="Organizations"
        page={1}
        totalPages={1}
        totalItems={5}
        onPageChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Organizations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "pagination.next" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "pagination.previous" }),
    ).toBeDisabled();
  });
  it("changes dashboard page size and displays the current page out of total pages", () => {
    const onPageSizeChange = vi.fn();
    const onPageChange = vi.fn();
    render(<PlatformPagination alwaysShow pageSize={10} onPageSizeChange={onPageSizeChange} ariaLabel="Organizations" page={2} totalPages={4} totalItems={35} onPageChange={onPageChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "20" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
    expect(screen.getByText("/ 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

});
