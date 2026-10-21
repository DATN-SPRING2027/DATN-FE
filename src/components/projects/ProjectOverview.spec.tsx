import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { useProjectMembersQuery } from "@/lib/queries/projects/useProjectMembers";
import type { Project } from "@/lib/queries/projects/useProjects";
import ProjectOverview from "./ProjectOverview";

vi.mock("@/lib/queries/projects/useProjectMembers", () => ({
  useProjectMembersQuery: vi.fn(),
}));
vi.mock("./members/ProjectMembers", () => ({ default: () => null }));
vi.mock("./ProjectSettings", () => ({ default: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const project: Project = {
  id: "project-1",
  organizationId: "org-1",
  name: "Apollo",
  code: "APOLLO",
  visibility: "PRIVATE",
  status: "ACTIVE",
  createdBy: "user-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
};

const membersQuery = vi.mocked(useProjectMembersQuery);

function renderOverview() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProjectOverview project={project} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  membersQuery.mockReset();
});

it("shows the live active Project member total on Overview", () => {
  membersQuery.mockReturnValue({
    data: {
      data: [],
      pagination: { page: 1, pageSize: 1, totalItems: 7, totalPages: 7 },
    },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useProjectMembersQuery>);

  renderOverview();

  expect(screen.getByText("Active members")).toBeVisible();
  expect(screen.getByText("7")).toBeVisible();
  expect(screen.getByText("7")).toHaveClass("tabular-nums");
  expect(membersQuery).toHaveBeenCalledWith("org-1", "project-1", {
    page: 1,
    pageSize: 1,
    status: "ACTIVE",
  });
});

it("does not invent a member total while the request is pending or denied", () => {
  membersQuery.mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
  } as unknown as ReturnType<typeof useProjectMembersQuery>);

  const view = renderOverview();
  expect(screen.getByText("Loading members…")).toBeVisible();
  expect(screen.queryByText("0")).not.toBeInTheDocument();

  membersQuery.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: true,
  } as unknown as ReturnType<typeof useProjectMembersQuery>);
  view.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProjectOverview project={project} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("Member data unavailable")).toBeVisible();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});
