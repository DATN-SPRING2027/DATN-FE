import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import { projectKeys } from "@/lib/queries/projects/useProjects";
import { ApiError, apiClient } from "@/lib/api-client";
import MemberWorkspace from "./MemberWorkspace";
import WorkWorkspace, {
  formatCommentDateTime,
  formatWorklogMinutes,
  parseWorklogMinutes,
} from "./WorkWorkspace";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const routerReplaceMock = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/workspace",
  useRouter: () => ({ replace: routerReplaceMock }),
}));
vi.mock("@/icons", () => {
  const Icon = () => null;
  return {
    BookOpenIcon: Icon,
    CalenderIcon: Icon,
    CheckCircleIcon: Icon,
    ChevronDownIcon: Icon,
    ChevronLeftIcon: Icon,
    CloseLineIcon: Icon,
    DocsIcon: Icon,
    EyeIcon: Icon,
    FilterIcon: Icon,
    GridIcon: Icon,
    ListIcon: Icon,
    PieChartIcon: Icon,
    PlusIcon: Icon,
    SearchIcon: Icon,
    SettingsIcon: Icon,
    TableIcon: Icon,
    TaskIcon: Icon,
    TimeIcon: Icon,
  };
});

const api = vi.mocked(apiClient);

function mount(projectId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkWorkspace projectId={projectId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, client };
}

function mountMemberWorkspace(initialProjectId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <MemberWorkspace initialProjectId={initialProjectId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, client };
}

describe("WorkWorkspace project scope", { timeout: 15000 }, () => {
  beforeEach(() => {
    api.mockReset();
    routerReplaceMock.mockReset();
  });

  it("loads the project from the current organization, renders Jira space tabs, and links back to its detail", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "user-1",
          name: "Minh Anh",
          organizationId: "org-1",
          roles: ["MEMBER"],
        };
      }
      if (path === "/iam/projects/project-1") {
        return {
          id: "project-1",
          organizationId: "org-1",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "user-1",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount("project-1");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Apollo" }),
    ).toBeVisible();
    expect(screen.getByText("Project workspace")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Work breadcrumb" }),
    ).toContainElement(screen.getByRole("link", { name: "Apollo" }));
    expect(screen.getByRole("link", { name: "Apollo" })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    for (const activeTab of [
      "Overview",
      "List",
      "Board",
      "Calendar",
      "Timeline",
      "Development",
      "Forms",
      "Docs",
      "Reports",
      "Work Notes",
    ]) {
      expect(screen.getByRole("button", { name: activeTab })).toBeEnabled();
    }

    // Verify Jira Cloud 2026 `+ Add view` 2-column popover
    fireEvent.click(screen.getByRole("button", { name: "Add view" }));
    expect(
      screen.getByRole("dialog", { name: "Add view to navigation" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // Verify List view `AI Search` rainbow natural language bar & Work column menu
    fireEvent.click(screen.getByRole("button", { name: "AI Search" }));
    expect(
      screen.getByLabelText("Ask AI natural language search bar"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "More actions for Work column" }),
    );
    expect(
      screen.getByRole("menu", { name: "Work column options" }),
    ).toBeVisible();

    // Verify Board view Sprint header & Insights drawer
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    fireEvent.click(screen.getByRole("button", { name: /Insights/i }));
    expect(
      screen.getByRole("region", { name: "Sprint insights" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    expect(
      screen.getByRole("region", { name: "Timeline roadmap" }),
    ).toBeVisible();
    expect(screen.getByText(/SCRUM Sprint 1/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Development" }));
    expect(screen.getByText(/Key metrics/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Forms" }));
    expect(screen.getByText(/Create a form from template/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Docs" }));
    expect(screen.getByText(/Document List/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    expect(
      screen.getByRole("heading", { name: "Sprint Burndown Chart" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Work Notes" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Work Notes" }),
    ).toBeVisible();

    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the workspace visible while refreshing the project in the background", async () => {
    const project = {
      id: "project-1",
      organizationId: "org-1",
      name: "Apollo",
      code: "AP",
      visibility: "PRIVATE",
      status: "ACTIVE",
      createdBy: "user-1",
      createdAt: "2026-10-05T00:00:00Z",
      updatedAt: "2026-10-05T00:00:00Z",
    };
    let projectCalls = 0;
    let finishRefresh: ((value: typeof project) => void) | undefined;
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: "user-1", organizationId: "org-1", roles: ["MEMBER"] };
      }
      if (path === "/iam/projects/project-1") {
        projectCalls += 1;
        if (projectCalls > 1) {
          return new Promise<typeof project>((resolve) => {
            finishRefresh = resolve;
          });
        }
        return project;
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    const { client } = mount("project-1");
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Apollo",
    });
    const refresh = client.invalidateQueries({
      queryKey: projectKeys.detail("org-1", "project-1"),
    });

    await waitFor(() => expect(projectCalls).toBe(2));
    expect(heading).toBeVisible();

    finishRefresh?.(project);
    await refresh;
  });

  it("loads the Member workspace with accessible projects and switches active project space", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "user-1",
          name: "Minh Anh",
          organizationId: "org-1",
          roles: ["MEMBER"],
        };
      }
      if (path.startsWith("/iam/projects?")) {
        return {
          data: [
            {
              id: "project-1",
              organizationId: "org-1",
              name: "Apollo",
              code: "AP",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: "user-1",
              createdAt: "2026-10-05T00:00:00Z",
              updatedAt: "2026-10-05T00:00:00Z",
            },
            {
              id: "project-2",
              organizationId: "org-1",
              name: "Hermes",
              code: "HM",
              visibility: "PUBLIC",
              status: "ACTIVE",
              createdBy: "user-1",
              createdAt: "2026-10-06T00:00:00Z",
              updatedAt: "2026-10-06T00:00:00Z",
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 2,
            totalPages: 1,
          },
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mountMemberWorkspace();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Apollo" }),
    ).toBeVisible();
    const selector = screen.getByRole("combobox", {
      name: "Select project workspace",
    });
    expect(selector).toHaveValue("project-1");

    fireEvent.change(selector, { target: { value: "project-2" } });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hermes" }),
    ).toBeVisible();
    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/workspace?projectId=project-2",
      { scroll: false },
    );
  });

  it("fetches a deep-linked project outside the first page of 20 instead of silently falling back to project-1", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "user-1",
          name: "Minh Anh",
          organizationId: "org-1",
          roles: ["MEMBER"],
        };
      }
      if (path.startsWith("/iam/projects?")) {
        return {
          data: [
            {
              id: "project-1",
              organizationId: "org-1",
              name: "Apollo",
              code: "AP",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: "user-1",
              createdAt: "2026-10-05T00:00:00Z",
              updatedAt: "2026-10-05T00:00:00Z",
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 25,
            totalPages: 2,
          },
        };
      }
      if (path === "/iam/projects/project-21") {
        return {
          id: "project-21",
          organizationId: "org-1",
          name: "Orion Twenty-One",
          code: "OR",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "user-1",
          createdAt: "2026-10-07T00:00:00Z",
          updatedAt: "2026-10-07T00:00:00Z",
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mountMemberWorkspace("project-21");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Orion Twenty-One",
      }),
    ).toBeVisible();
    const selector = screen.getByRole("combobox", {
      name: "Select project workspace",
    });
    expect(selector).toHaveValue("project-21");
  });

  it("renders ProjectState error when a deep-linked project does not exist or is inaccessible", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "user-1",
          name: "Minh Anh",
          organizationId: "org-1",
          roles: ["MEMBER"],
        };
      }
      if (path.startsWith("/iam/projects?")) {
        return {
          data: [
            {
              id: "project-1",
              organizationId: "org-1",
              name: "Apollo",
              code: "AP",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: "user-1",
              createdAt: "2026-10-05T00:00:00Z",
              updatedAt: "2026-10-05T00:00:00Z",
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        };
      }
      if (path === "/iam/projects/project-404") {
        throw new Error("Project not found");
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mountMemberWorkspace("project-404");

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Apollo" }),
    ).not.toBeInTheDocument();
  });

  it("preserves dueDate and assignee when creating a work item via the List inline create row", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "user-1",
          name: "Minh Anh",
          organizationId: "org-1",
          roles: ["MEMBER"],
        };
      }
      if (path === "/iam/projects/project-1") {
        return {
          id: "project-1",
          organizationId: "org-1",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "user-1",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount("project-1");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apollo" }),
    ).toBeVisible();

    const createButtons = screen.getAllByRole("button", { name: "Create" });
    fireEvent.click(createButtons[createButtons.length - 1]);
    fireEvent.change(screen.getByPlaceholderText("What needs to be done?"), {
      target: { value: "Verify inline assignee & due date" },
    });
    fireEvent.change(screen.getByLabelText("Inline due date"), {
      target: { value: "2026-11-15" },
    });
    fireEvent.change(screen.getByLabelText("Inline assignee"), {
      target: { value: "person-3" },
    });
    fireEvent.submit(
      screen.getByPlaceholderText("What needs to be done?").closest("form")!,
    );

    expect(
      await screen.findByText("Verify inline assignee & due date"),
    ).toBeVisible();
    expect(screen.getByText("2026-11-15")).toBeVisible();
  });

  it("renders only the tasks belonging to the real backend project without leaking preview or cross-project tasks", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "Minh Anh",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["ADMIN"],
        };
      }
      if (path === `/iam/projects/${realProjectId}`) {
        return {
          id: realProjectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "AI Knowledge Engine",
          code: "AIKE",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${realProjectId}/memberships`)) {
        return {
          data: [
            {
              id: "membership-1",
              organizationId: "69e923c77859fd1c702d4c01",
              projectId: realProjectId,
              userId: "69e923c77859fd1c702d4c10",
              role: "TEAM_LEADER",
              status: "ACTIVE",
              joinedAt: "2026-10-05T00:00:00Z",
              version: 1,
              user: {
                id: "69e923c77859fd1c702d4c10",
                email: "keyt@example.com",
                fullName: "KeyT Xin Chàoo",
                status: "ACTIVE",
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 1,
            totalPages: 1,
          },
        };
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return {
          items: [
            {
              id: "69e923c77859fd1c702d4ca1",
              organizationId: "69e923c77859fd1c702d4c01",
              projectId: realProjectId,
              key: "AIKE-1",
              title: "Build hybrid vector search index for AIKE",
              type: "TASK",
              status: "IN_PROGRESS",
              priority: "HIGH",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: "2026-11-20T00:00:00.000Z",
              startDate: "2026-11-01T00:00:00.000Z",
              labels: ["rag", "vector"],
              subtaskCounts: { total: 0, done: 0 },
              version: 1,
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(realProjectId);

    expect(
      await screen.findByText("Build hybrid vector search index for AIKE"),
    ).toBeVisible();
    expect(screen.getByText("AIKE-1")).toBeVisible();
    expect(
      screen.queryByText(
        "Finalize project visibility rules for private workstreams",
      ),
    ).not.toBeInTheDocument();
  });

  it("persists bulk status updates and rolls back optimistic UI when a backend mutation fails", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const realTaskId = "69e923c77859fd1c702d4ca1";
    let shouldFailTransition = false;

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "Minh Anh",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["ADMIN"],
        };
      }
      if (path === `/iam/projects/${realProjectId}`) {
        return {
          id: realProjectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "AI Knowledge Engine",
          code: "AIKE",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${realProjectId}/memberships`)) {
        return {
          data: [
            {
              id: "membership-1",
              organizationId: "69e923c77859fd1c702d4c01",
              projectId: realProjectId,
              userId: "69e923c77859fd1c702d4c10",
              role: "TEAM_LEADER",
              status: "ACTIVE",
              joinedAt: "2026-10-05T00:00:00Z",
              version: 1,
              user: {
                id: "69e923c77859fd1c702d4c10",
                email: "minhanh@example.com",
                fullName: "Minh Anh",
                status: "ACTIVE",
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 1,
            totalPages: 1,
          },
        };
      }
      if (
        path === `/tasks/projects/${realProjectId}/tasks/${realTaskId}/transitions` &&
        init?.method === "POST"
      ) {
        if (shouldFailTransition) {
          throw new Error("STALE_TASK_VERSION");
        }
        return {
          id: realTaskId,
          projectId: realProjectId,
          key: "AIKE-1",
          title: "Build hybrid vector search index for AIKE",
          description: null,
          type: "TASK",
          status: "IN_REVIEW",
          priority: "HIGH",
          assigneeId: "69e923c77859fd1c702d4c10",
          createdBy: "69e923c77859fd1c702d4c10",
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: null,
          createdAt: "2026-10-20T00:00:00.000Z",
          updatedAt: "2026-10-20T00:00:00.000Z",
          version: 2,
        };
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return {
          items: [
            {
              id: realTaskId,
              projectId: realProjectId,
              key: "AIKE-1",
              title: "Build hybrid vector search index for AIKE",
              type: "TASK",
              status: "IN_PROGRESS",
              priority: "HIGH",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: 1,
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
          ],
          nextAfterId: null,
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(realProjectId);

    expect(
      await screen.findByText("Build hybrid vector search index for AIKE"),
    ).toBeVisible();

    // Select AIKE-1 and trigger bulk status update -> DONE
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Select work item AIKE-1/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Mark as Done/i }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        `/tasks/projects/${realProjectId}/tasks/${realTaskId}/transitions`,
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    // Now simulate a failed bulk delete -> should rollback item into the list
    shouldFailTransition = true;
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Select work item AIKE-1/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /✕ Delete/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Build hybrid vector search index for AIKE"),
      ).toBeVisible();
    });
  });

  it("opens unclipped floating listbox popovers for Status, Assignee, and Priority cells in List view", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return {
          id: "user-1",
          name: "Minh Anh",
          organizationId: "org-1",
          roles: ["MEMBER"],
        };
      }
      if (path === "/iam/projects/project-1") {
        return {
          id: "project-1",
          organizationId: "org-1",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "user-1",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount("project-1");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apollo" }),
    ).toBeVisible();

    const statusTriggers = screen.getAllByTitle("Click to transition status");
    fireEvent.click(statusTriggers[0]);
    const statusListbox = screen.getByRole("listbox", {
      name: /Select status for KNW-142/i,
    });
    expect(statusListbox).toBeVisible();
    expect(statusListbox.className).toContain("fixed");

    const assigneeTriggers = screen.getAllByTitle("Click to change assignee");
    fireEvent.click(assigneeTriggers[0]);
    const assigneeListbox = screen.getByRole("listbox", {
      name: /Select assignee for KNW-142/i,
    });
    expect(assigneeListbox).toBeVisible();
    expect(assigneeListbox.className).toContain("fixed");

    const priorityTriggers = screen.getAllByTitle("Click to change priority");
    fireEvent.click(priorityTriggers[0]);
    const priorityListbox = screen.getByRole("listbox", {
      name: /Select priority for KNW-142/i,
    });
    expect(priorityListbox).toBeVisible();
    expect(priorityListbox.className).toContain("fixed");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("listbox", { name: /Select priority for KNW-142/i }),
    ).not.toBeInTheDocument();
  });

  it("shows only Unassigned and active project members in the Assignee dropdown on a real backend project without mock PREVIEW_PEOPLE", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const realTaskId = "69e923c77859fd1c702d4ca1";

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "KeyT Xin Chàoo",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["ADMIN"],
        };
      }
      if (path === `/iam/projects/${realProjectId}`) {
        return {
          id: realProjectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "Front End",
          code: "FE",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${realProjectId}/memberships`)) {
        return {
          data: [
            {
              id: "membership-1",
              organizationId: "69e923c77859fd1c702d4c01",
              projectId: realProjectId,
              userId: "69e923c77859fd1c702d4c10",
              role: "TEAM_LEADER",
              status: "ACTIVE",
              joinedAt: "2026-10-05T00:00:00Z",
              version: 1,
              user: {
                id: "69e923c77859fd1c702d4c10",
                email: "keyt@example.com",
                fullName: "KeyT Xin Chàoo",
                status: "ACTIVE",
              },
            },
            {
              id: "membership-2",
              organizationId: "69e923c77859fd1c702d4c01",
              projectId: realProjectId,
              userId: "69e923c77859fd1c702d4c11",
              role: "MEMBER",
              status: "ACTIVE",
              joinedAt: "2026-10-06T00:00:00Z",
              version: 1,
              user: {
                id: "69e923c77859fd1c702d4c11",
                email: "phuc@example.com",
                fullName: "Phúc Nguyễn",
                status: "ACTIVE",
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 2,
            totalPages: 1,
          },
        };
      }
      if (
        path === `/tasks/projects/${realProjectId}/tasks/${realTaskId}` &&
        init?.method === "PATCH"
      ) {
        throw new ApiError(
          422,
          "ASSIGNEE_NOT_IN_PROJECT",
          "assigneeId must be an active member of the project.",
        );
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return {
          items: [
            {
              id: realTaskId,
              projectId: realProjectId,
              key: "FE-1",
              title: "làm fe trang chủ",
              type: "TASK",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: 1,
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
          ],
          nextAfterId: null,
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(realProjectId);

    expect(await screen.findByText("làm fe trang chủ")).toBeVisible();

    const assigneeTrigger = screen.getByTitle("Click to change assignee");
    fireEvent.click(assigneeTrigger);

    const assigneeListbox = screen.getByRole("listbox", {
      name: /Select assignee for FE-1/i,
    });
    expect(assigneeListbox).toBeVisible();
    expect(assigneeListbox).toHaveTextContent("Unassigned");
    expect(assigneeListbox).toHaveTextContent("KeyT Xin Chàoo");
    expect(assigneeListbox).toHaveTextContent("Phúc Nguyễn");
    expect(assigneeListbox).not.toHaveTextContent("Automatic");
    expect(assigneeListbox).not.toHaveTextContent("Thu Hà");
    expect(assigneeListbox).not.toHaveTextContent("Quang Huy");
    expect(assigneeListbox).not.toHaveTextContent("Hoàng Nam");

    fireEvent.click(
      within(assigneeListbox).getByRole("button", { name: /Phúc Nguyễn/i }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("ASSIGNEE_NOT_IN_PROJECT");
    expect(
      screen.queryByText("Assigned FE-1 to Phúc Nguyễn"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "KeyT Xin Chàoo" }),
    ).toBeVisible();
  });

  it("formats comment timestamps with both date and hours:minutes (YYYY-MM-DD HH:mm)", () => {
    const sampleDate = new Date(2026, 9, 23, 10, 28, 0);
    expect(formatCommentDateTime(sampleDate)).toBe("2026-10-23 10:28");
    expect(formatCommentDateTime(sampleDate.toISOString())).toBe(
      "2026-10-23 10:28",
    );
    expect(parseWorklogMinutes("1h 30m")).toBe(90);
    expect(formatWorklogMinutes(90)).toBe("1h 30m");
  });

  it("loads real worklogs and posts new worklog to backend without showing mock worklog data", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const realTaskId = "69e923c77859fd1c702d4ca1";

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "KeyT Xin Chàoo",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["ADMIN"],
        };
      }
      if (path === `/iam/projects/${realProjectId}`) {
        return {
          id: realProjectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "Front End",
          code: "FE",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${realProjectId}/memberships`)) {
        return {
          data: [
            {
              id: "membership-1",
              organizationId: "69e923c77859fd1c702d4c01",
              projectId: realProjectId,
              userId: "69e923c77859fd1c702d4c10",
              role: "TEAM_LEADER",
              status: "ACTIVE",
              joinedAt: "2026-10-05T00:00:00Z",
              version: 1,
              user: {
                id: "69e923c77859fd1c702d4c10",
                email: "keyt@example.com",
                fullName: "KeyT Xin Chàoo",
                status: "ACTIVE",
              },
            },
          ],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 1,
            totalPages: 1,
          },
        };
      }
      if (path === `/tasks/projects/${realProjectId}/tasks/${realTaskId}`) {
        return {
          id: realTaskId,
          projectId: realProjectId,
          key: "FE-1",
          title: "làm fe trang chủ",
          description: "Real backend task description",
          type: "TASK",
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: "69e923c77859fd1c702d4c10",
          createdBy: "69e923c77859fd1c702d4c10",
          parentId: null,
          sprintId: null,
          dueDate: null,
          startDate: null,
          completedAt: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          version: 1,
          createdAt: "2026-10-20T00:00:00.000Z",
          updatedAt: "2026-10-20T00:00:00.000Z",
        };
      }
      if (
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${realTaskId}/comments`,
        )
      ) {
        return { items: [], nextAfterId: null };
      }
      if (
        path === `/tasks/projects/${realProjectId}/tasks/${realTaskId}/worklogs` &&
        init?.method === "POST"
      ) {
        return {
          id: "69e923c77859fd1c702d4cw1",
          taskId: realTaskId,
          projectId: realProjectId,
          authorId: "69e923c77859fd1c702d4c10",
          minutes: 90,
          note: "Completed responsive header layout",
          loggedAt: "2026-10-23T03:30:00.000Z",
          createdAt: "2026-10-23T03:30:00.000Z",
        };
      }
      if (
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${realTaskId}/worklogs`,
        )
      ) {
        return { items: [], totalMinutes: 0, nextAfterId: null };
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return {
          items: [
            {
              id: realTaskId,
              projectId: realProjectId,
              key: "FE-1",
              title: "làm fe trang chủ",
              type: "TASK",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: 1,
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
          ],
          nextAfterId: null,
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(realProjectId);

    const taskButton = await screen.findByText("làm fe trang chủ");
    fireEvent.click(taskButton);

    const worklogTab = await screen.findByRole("button", { name: "Work log" });
    fireEvent.click(worklogTab);

    expect(
      screen.queryByText(
        "Implemented initial service boundary and integration test cases.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("No work logged on this work item yet."),
    ).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("Time spent (e.g. 1h 30m)"), {
      target: { value: "1h 30m" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work description…"), {
      target: { value: "Completed responsive header layout" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Log work" }));

    await waitFor(() => {
      expect(
        screen.getByText("Completed responsive header layout"),
      ).toBeVisible();
      expect(screen.getByText("1h 30m")).toBeVisible();
      expect(api).toHaveBeenCalledWith(
        `/tasks/projects/${realProjectId}/tasks/${realTaskId}/worklogs`,
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });
});
