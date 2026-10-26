import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";
import ProjectDirectory from "./ProjectDirectory";

function setup(error?: ApiError) {
  const project = {
    id: "project-1",
    name: "Zeta",
    code: "ZT",
    visibility: "PRIVATE",
    status: "ACTIVE",
    memberCount: 3,
    organization: { id: "org-1", name: "Acme", slug: "acme" },
    createdAt: "2026-10-26T00:00:00Z",
  };
  const model = {
    search: "",
    status: "",
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setPage: vi.fn(),
    setSelectedId: vi.fn(),
    projects: {
      data: {
        data: [project, { ...project, id: "project-2", name: "Alpha" }],
        pagination: { page: 2, pageSize: 10, totalItems: 12, totalPages: 2 },
      },
      isFetching: false,
      isPending: false,
      isError: !!error,
      isRefetchError: !!error,
      error,
      refetch: vi.fn(),
    },
  } as unknown as PlatformOperationsViewModel;
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProjectDirectory model={model} />
    </NextIntlClientProvider>,
  );
  return model;
}

describe("Project directory", () => {
  it("resets pagination when changing server filters and opens the selected project", () => {
    const model = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Public" }),
    );
    expect(model.setStatus).toHaveBeenCalledWith("PUBLIC");
    expect(model.setPage).toHaveBeenCalledWith(1);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "ZT" },
    });
    expect(model.setSearch).toHaveBeenCalledWith("ZT");
    fireEvent.click(
      screen.getByRole("button", { name: "View details for Zeta" }),
    );
    expect(model.setSelectedId).toHaveBeenCalledWith("project-1");
    const rows = screen.getAllByRole("row");
    expect(
      within(rows[1]).getByRole("button", { name: "Alpha" }),
    ).toBeInTheDocument();
    expect(screen.getByText("11–12 of 12")).toBeInTheDocument();
  });

  it("hides cached projects and pagination after access is revoked", () => {
    setup(new ApiError(403, "FORBIDDEN", "Access denied"));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("11–12 of 12")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View details for Zeta" }),
    ).not.toBeInTheDocument();
  });
});
