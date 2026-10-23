import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformPagination from "./PlatformPagination";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) =>
    key === "range" && values
      ? `${values.from}–${values.to} of ${values.total}`
      : `pagination.${key}`,
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
  it("hides the page size selector and preserves page navigation", () => {
    const onPageSizeChange = vi.fn();
    const onPageChange = vi.fn();
    render(
      <PlatformPagination
        alwaysShow
        pageSize={10}
        onPageSizeChange={onPageSizeChange}
        ariaLabel="Organizations"
        page={2}
        totalPages={4}
        totalItems={35}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(onPageSizeChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("reports returned rows rather than claiming a full page when fewer records are received", () => {
    render(
      <PlatformPagination
        alwaysShow
        page={1}
        pageSize={25}
        returnedItems={3}
        totalItems={186}
        totalPages={8}
        ariaLabel="users"
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("1–3 of 186")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8" })).toBeInTheDocument();
  });
});
