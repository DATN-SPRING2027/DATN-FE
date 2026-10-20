import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";
import WorkNoteCreateDialog from "./WorkNoteCreateDialog";
import WorkNotesWorkspace from "./WorkNotesWorkspace";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) =>
    key === "reports.memberName" && values?.member
      ? `${values.member} · Member`
      : `${namespace}.${key}`,
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

function renderWorkspace(roles: readonly string[], name = "Member User") {
  vi.mocked(useCurrentUserQuery).mockReturnValue({
    data: {
      id: "user-1",
      email: "member@datn-dev.example.test",
      name,
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

  expect(screen.getByText("roleLabels.member")).toBeVisible();
  expect(screen.getByRole("button", { name: "workNotes.createNote" })).toBeVisible();
  expect(screen.queryByRole("group", { name: "workNotes.rolePreviewLabel" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "workNotes.leaderSummaryLabel" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "workNotes.tabs.CONFIG" })).not.toBeInTheDocument();
  expect(screen.getByText("workNotes.activity.memberNotSubmitted")).toBeVisible();
});

it("attributes a member-created note to the signed-in user and lets them save it as knowledge", async () => {
  renderWorkspace(["MEMBER"], "Taylor Example");

  fireEvent.click(screen.getByRole("button", { name: "workNotes.createNote" }));
  fireEvent.change(await screen.findByPlaceholderText("workNotes.form.titlePlaceholder"), {
    target: { value: "User-authored update" },
  });
  fireEvent.change(screen.getByPlaceholderText("workNotes.form.updateHint"), {
    target: { value: "This update belongs to the signed-in user." },
  });
  fireEvent.click(screen.getByRole("button", { name: "workNotes.form.savePreview" }));

  const article = (await screen.findByRole("heading", { name: "User-authored update" })).closest("article");
  expect(article).not.toBeNull();
  expect(within(article as HTMLElement).getByText("Taylor Example")).toBeVisible();
  expect(within(article as HTMLElement).getByText("TE")).toBeVisible();
  expect(within(article as HTMLElement).getByRole("button", { name: "workNotes.activity.saveAsKnowledge" })).toBeVisible();
});

it("starts the signed-in member's own weekly report as missing and submits it under that member", async () => {
  renderWorkspace(["MEMBER"], "Taylor Example");

  fireEvent.click(screen.getByRole("tab", { name: "workNotes.tabs.REPORTS" }));

  expect(screen.getByText("Taylor Example · Member")).toBeVisible();
  expect(screen.getByText("workNotes.reports.notSubmitted")).toBeVisible();

  fireEvent.change(screen.getByPlaceholderText("workNotes.reports.completedPlaceholder"), {
    target: { value: "Completed the signed-in user's report." },
  });
  fireEvent.change(screen.getByPlaceholderText("workNotes.reports.blockersPlaceholder"), {
    target: { value: "No blockers" },
  });
  fireEvent.change(screen.getByPlaceholderText("workNotes.reports.nextWeekPlaceholder"), {
    target: { value: "Continue next week" },
  });
  fireEvent.click(screen.getByRole("button", { name: "workNotes.reports.submitPreview" }));

  expect(screen.getByText("workNotes.reports.submitted")).toBeVisible();
});

it("uses the requested note type when a mounted create dialog opens", () => {
  const props = {
    currentUser: { id: "user-1", name: "Taylor Example", initials: "TE" },
    onClose: vi.fn(),
    onCreate: vi.fn(),
  };
  const { rerender } = render(
    <WorkNoteCreateDialog {...props} isOpen={false} initialKind="WORK_UPDATE" />,
  );

  rerender(<WorkNoteCreateDialog {...props} isOpen initialKind="KNOWLEDGE" />);

  expect(screen.getByLabelText("workNotes.form.noteType")).toHaveValue("KNOWLEDGE");

  rerender(<WorkNoteCreateDialog {...props} isOpen={false} initialKind="WEEKLY_SUMMARY" />);
  rerender(<WorkNoteCreateDialog {...props} isOpen initialKind="WEEKLY_SUMMARY" />);

  expect(screen.getByLabelText("workNotes.form.noteType")).toHaveValue("WEEKLY_SUMMARY");
  expect(screen.getByText("workNotes.form.unfinishedLabel")).toBeVisible();
});

it("shows only the signed-in Leader experience", () => {
  renderWorkspace(["TEAM_LEADER"]);

  expect(screen.getByText("roleLabels.teamLeader")).toBeVisible();
  expect(screen.getByRole("region", { name: "workNotes.leaderSummaryLabel" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "workNotes.createNote" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "workNotes.tabs.CONFIG" })).not.toBeInTheDocument();
});

it("shows only the signed-in Organization Admin experience", () => {
  renderWorkspace(["ADMIN"]);

  expect(screen.getByText("roleLabels.organizationAdmin")).toBeVisible();
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
