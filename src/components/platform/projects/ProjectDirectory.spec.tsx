import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    createdBy: null,
    memberCount: 3,
    leaders: [],
    leadersTruncated: false,
    teamCount: 2,
    teams: [],
    teamsTruncated: false,
    organization: { id: "org-1", name: "Acme", slug: "acme" },
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-27T00:00:00Z",
  };
  const changeProjectMutateAsync = vi.fn().mockResolvedValue(project);
  const model = {
    search: "",
    status: "",
    projectOrganizationId: "",
    projectVisibility: "",
    canFilterUserOrganizations: true,
    canManageProjects: true,
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setProjectOrganizationId: vi.fn(),
    setProjectVisibility: vi.fn(),
    setPage: vi.fn(),
    setSelectedId: vi.fn(),
    changeProject: {
      mutateAsync: changeProjectMutateAsync,
      isPending: false,
    },
    runOperation: vi.fn(async (action: () => Promise<unknown>) => {
      await action();
      return true;
    }),
    filterOrganizations: {
      data: {
        data: [
          {
            id: "org-1",
            name: "Acme",
            slug: "acme",
            plan: "FREE",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
          {
            id: "org-2",
            name: "Beta Corp",
            slug: "beta",
            plan: "ENTERPRISE",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
        pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
      },
    },
    projects: {
      data: {
        data: [project, { ...project, id: "project-2", name: "Alpha", status: "ARCHIVED" }],
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
  return { model, changeProjectMutateAsync };
}

describe("Project directory", () => {
  it("supports status tabs, workspace organization dropdown, visibility select, search, and project locking", async () => {
    const { model, changeProjectMutateAsync } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Locked" }));
    expect(model.setStatus).toHaveBeenCalledWith("ARCHIVED");
    expect(model.setPage).toHaveBeenCalledWith(1);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by organization" }),
      { target: { value: "org-2" } },
    );
    expect(model.setProjectOrganizationId).toHaveBeenCalledWith("org-2");

    fireEvent.change(
      screen.getByRole("combobox", { name: "Project visibility" }),
      { target: { value: "PUBLIC" } },
    );
    expect(model.setProjectVisibility).toHaveBeenCalledWith("PUBLIC");

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

    fireEvent.click(screen.getByRole("button", { name: "Lock project Zeta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm lock" }));
    await waitFor(() =>
      expect(changeProjectMutateAsync).toHaveBeenCalledWith({
        projectId: "project-1",
        status: "ARCHIVED",
        expectedUpdatedAt: "2026-10-27T00:00:00Z",
        reasonCode: "ACCESS_REVIEW",
      }),
    );
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
