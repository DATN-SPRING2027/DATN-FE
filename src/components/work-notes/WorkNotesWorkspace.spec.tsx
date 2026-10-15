import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import WorkNotesWorkspace from "./WorkNotesWorkspace";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));
vi.mock("@/icons", () => ({
  BookOpenIcon: () => null,
  CalenderIcon: () => null,
  CheckCircleIcon: () => null,
  CloseLineIcon: () => null,
  DocsIcon: () => null,
  EyeIcon: () => null,
  FileIcon: () => null,
  PlusIcon: () => null,
  SearchIcon: () => null,
  SettingsIcon: () => null,
  TaskIcon: () => null,
  TimeIcon: () => null,
  TrashBinIcon: () => null,
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
}));
vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectQuery: vi.fn(),
}));

const project = {
  id: "project-1",
  organizationId: "organization-1",
  name: "Project Atlas",
  code: "ATL",
  visibility: "PRIVATE" as const,
  status: "ACTIVE" as const,
  createdBy: "user-1",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

function renderWorkspace(roles: readonly string[]) {
  vi.mocked(useCurrentUserQuery).mockReturnValue({
    data: {
      id: "user-1",
      email: "member@datn-dev.example.test",
      name: "Member User",
      context: "ORGANIZATION",
      organizationId: "organization-1",
      roles,
    },
    isPending: false,
    isError: false,
  } as never);
  vi.mocked(useProjectQuery).mockReturnValue({
    data: project,
    isPending: false,
    isError: false,
  } as never);

  return render(<WorkNotesWorkspace projectId={project.id} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("shows only the signed-in Member experience", () => {
  renderWorkspace(["MEMBER"]);

  expect(screen.getByText("workNotes.roles.MEMBER")).toBeVisible();
  expect(screen.getByRole("button", { name: "workNotes.createNote" })).toBeVisible();
  expect(screen.queryByRole("group", { name: "workNotes.rolePreviewLabel" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "workNotes.leaderSummaryLabel" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "workNotes.tabs.CONFIG" })).not.toBeInTheDocument();
});

it("shows only the signed-in Leader experience", () => {
  renderWorkspace(["TEAM_LEADER"]);

  expect(screen.getByText("workNotes.roles.LEADER")).toBeVisible();
  expect(screen.getByRole("region", { name: "workNotes.leaderSummaryLabel" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "workNotes.createNote" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "workNotes.tabs.CONFIG" })).not.toBeInTheDocument();
});

it("shows only the signed-in Organization Admin experience", () => {
  renderWorkspace(["ADMIN"]);

  expect(screen.getByText("workNotes.roles.ADMIN")).toBeVisible();
  expect(screen.getByRole("tab", { name: "workNotes.tabs.CONFIG" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "workNotes.createNote" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "workNotes.leaderSummaryLabel" })).not.toBeInTheDocument();
});

it("does not assume Member when /auth/me has no supported role", () => {
  renderWorkspace(["UNRECOGNIZED"]);

  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryByRole("button", { name: "workNotes.createNote" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "workNotes.tabs.CONFIG" })).not.toBeInTheDocument();
});
