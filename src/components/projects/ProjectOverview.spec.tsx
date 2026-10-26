import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { useProjectMembersQuery } from "@/lib/queries/projects/useProjectMembers";
import type { Project } from "@/lib/queries/projects/useProjects";
import ProjectOverview from "./ProjectOverview";

const management = vi.hoisted(() => ({ canAccessSettings: true }));
const memberAddAccess = vi.hoisted(() => ({ isSuccess: false }));
vi.mock("@/lib/queries/projects/useProjectSettings", () => ({
  useProjectManagementAccess: () => management,
}));

vi.mock("@/lib/queries/projects/useProjectMembers", () => ({
  useProjectMembersQuery: vi.fn(),
  useProjectMemberAddAccess: () => memberAddAccess,
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
  management.canAccessSettings = true;
  memberAddAccess.isSuccess = false;
});

it("hides Add member until the server grants member-add authority", () => {
  membersQuery.mockReturnValue({ data: undefined, isPending: false, isError: true } as ReturnType<typeof useProjectMembersQuery>);
  const view = renderOverview();
  expect(screen.queryByRole("button", { name: "Open Add member form" })).not.toBeInTheDocument();
  memberAddAccess.isSuccess = true;
  view.rerender(<NextIntlClientProvider locale="en" messages={messages}><ProjectOverview project={project} /></NextIntlClientProvider>);
  expect(screen.getByRole("button", { name: "Open Add member form" })).toBeVisible();
  memberAddAccess.isSuccess = false;
  view.rerender(<NextIntlClientProvider locale="en" messages={messages}><ProjectOverview project={project} /></NextIntlClientProvider>);
  expect(screen.queryByRole("button", { name: "Open Add member form" })).not.toBeInTheDocument();
});

it("hides the Settings tab when the current Project grants no management access", () => {
  management.canAccessSettings = false;
  membersQuery.mockReturnValue({ data: undefined, isPending: false, isError: true } as ReturnType<typeof useProjectMembersQuery>);
  renderOverview();
  expect(screen.queryByRole("tab", { name: "Settings" })).not.toBeInTheDocument();
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

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProjectOverview project={{ ...project, activeMemberCount: 7 }} />
    </NextIntlClientProvider>,
  );

  expect(screen.getByText("Active members")).toBeVisible();
  expect(screen.getByText("7")).toBeVisible();
  expect(screen.getByText("7")).toHaveClass("tabular-nums");
  expect(membersQuery).toHaveBeenCalledWith("org-1", "project-1", {
    page: 1,
    pageSize: 1,
    status: "ACTIVE",
  }, { enabled: false, staleTime: 15_000 });
});

it("falls back to the member summary endpoint when the Project summary omits its count", () => {
  membersQuery.mockReturnValue({
    data: {
      data: [],
      pagination: { page: 1, pageSize: 1, totalItems: 3, totalPages: 3 },
    },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useProjectMembersQuery>);

  renderOverview();

  expect(screen.getByText("3")).toBeVisible();
  expect(membersQuery).toHaveBeenCalledWith("org-1", "project-1", {
    page: 1,
    pageSize: 1,
    status: "ACTIVE",
  }, { enabled: true, staleTime: 15_000 });
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
