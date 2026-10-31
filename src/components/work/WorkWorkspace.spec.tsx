import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import type { WorkView } from "./WorkPageHeader";
import { taskKeys } from "@/lib/queries/tasks/useTasks";

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

function mount(projectId: string, view?: WorkView) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkWorkspace projectId={projectId} view={view} />
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

  it.each(["MEMBER", "TEAM_LEADER"])("keeps other actors' Tasks read-only and hides Sprint management for an unassigned %s", async (role) => {
    const projectId = "69e923c77859fd1c702d4c21";
    const actorId = "69e923c77859fd1c702d4c10";
    const otherId = "69e923c77859fd1c702d4c11";
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") return { id: actorId, name: "Member", organizationId: "org-a", roles: [role] };
      if (path === `/iam/projects/${projectId}`) return { id: projectId, organizationId: "org-a", name: "Apollo", code: "AP", status: "ACTIVE", visibility: "PRIVATE", leaders: [], createdBy: otherId, createdAt: "2026-10-01", updatedAt: "2026-10-01" };
      if (path.includes("/memberships")) return { data: [], pagination: { totalItems: 0, totalPages: 0 } };
      if (path.endsWith("/sprints")) return { items: [{ id: "sprint-a", name: "Sprint A", status: "ACTIVE", version: 1 }] };
      if (path.startsWith(`/tasks/projects/${projectId}/tasks`)) return { items: [otherId, actorId].map((owner, index) => ({ id: `69e923c77859fd1c702d4c3${index}`, projectId, key: `AP-${index + 1}`, title: `Task ${index + 1}`, createdBy: owner, assigneeId: owner, status: "TODO", priority: "MEDIUM", type: "TASK", parentId: null, dueDate: null, startDate: null, labels: [], subtaskCounts: { total: 0, done: 0 }, version: 1, createdAt: "2026-10-01", updatedAt: "2026-10-01" })), nextCursor: null, nextAfterId: null };
      throw new Error(`Unexpected API path: ${path}`);
    });
    const view = mount(projectId);
    const other = await screen.findByRole("checkbox", { name: /AP-1/ });
    const own = await screen.findByRole("checkbox", { name: /AP-2/ });
    await waitFor(() => expect(own).toBeEnabled());
    expect(other).toBeDisabled();
    expect(own).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Create subtask under AP-1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create subtask under AP-2" })).toBeEnabled();
    expect(within(other.closest("tr")!).getByTitle("Click to transition status")).toBeDisabled();
    expect(within(own.closest("tr")!).getByTitle("Click to transition status")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.queryByRole("button", { name: "Complete sprint" })).not.toBeInTheDocument();
    expect(api.mock.calls.some(([, init]) => init?.method === "PATCH" || init?.method === "POST")).toBe(false);
    const grantedApi = api.getMockImplementation()!;
    api.mockImplementation((path, init) => path.startsWith(`/tasks/projects/${projectId}/tasks`)
      ? Promise.reject(new ApiError(403, "FORBIDDEN", "Project membership revoked"))
      : grantedApi(path, init));
    await act(async () => { await view.client.invalidateQueries({ queryKey: taskKeys.projectScope(projectId) }); });
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: /AP-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
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
      "Reports",
    ]) {
      expect(screen.getByRole("button", { name: activeTab })).toBeEnabled();
    }
    for (const unavailableTab of ["Development", "Forms", "Docs", "Work Notes"]) {
      expect(
        screen.queryByRole("button", { name: unavailableTab }),
      ).not.toBeInTheDocument();
    }

    // Verify Jira Cloud 2026 `+ Add view` 2-column popover
    fireEvent.click(screen.getByRole("button", { name: "Add view" }));
    expect(
      screen.getByRole("dialog", { name: "Add view to navigation" }),
    ).toBeVisible();
    for (const unavailableTab of ["Development", "Forms", "Docs", "Work Notes"]) {
      expect(
        screen.queryByRole("button", { name: unavailableTab }),
      ).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // AI search depends on the out-of-scope G9 assistant feature.
    expect(screen.queryByRole("button", { name: "AI Search" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ask AI natural language search bar")).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    expect(
      screen.getByRole("heading", { name: "Sprint Burndown Chart" }),
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

    expect(parseWorklogMinutes("abc")).toBe(0);
    expect(parseWorklogMinutes("1h abc")).toBe(0);
    expect(parseWorklogMinutes("")).toBe(0);

    // Invalid time input should show error, preserve form values, and not call POST /worklogs
    fireEvent.change(screen.getByPlaceholderText("Time spent (e.g. 1h 30m)"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work description…"), {
      target: { value: "Completed responsive header layout" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Log work" }));

    expect(
      screen.getByText(
        "Invalid duration. Use e.g. 30m, 1h 30m, 2h, or pick a preset.",
      ),
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText("Time spent (e.g. 1h 30m)"),
    ).toHaveValue("abc");
    expect(api).not.toHaveBeenCalledWith(
      `/tasks/projects/${realProjectId}/tasks/${realTaskId}/worklogs`,
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.change(screen.getByPlaceholderText("Time spent (e.g. 1h 30m)"), {
      target: { value: "1h 30m" },
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

  it("opens the calendar date picker popover when clicking a Due date cell, allows choosing year/month/day, and persists to backend", async () => {
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
      if (
        path === `/tasks/projects/${realProjectId}/tasks/${realTaskId}` &&
        init?.method === "PATCH"
      ) {
        return {
          id: realTaskId,
          projectId: realProjectId,
          key: "FE-1",
          title: "làm fe trang chủ",
          description: null,
          type: "TASK",
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: "69e923c77859fd1c702d4c10",
          createdBy: "69e923c77859fd1c702d4c10",
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: "2026-12-15T00:00:00.000Z",
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
              key: "FE-1",
              title: "làm fe trang chủ",
              type: "TASK",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: "2026-11-15T00:00:00.000Z",
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

    const dueTrigger = screen.getByRole("button", {
      name: "Due date for FE-1",
    });
    expect(dueTrigger).toHaveTextContent("2026-11-15");
    await waitFor(() => expect(dueTrigger).toBeEnabled());

    fireEvent.click(dueTrigger);

    const pickerDialog = screen.getByRole("dialog", {
      name: "Select due date for FE-1",
    });
    expect(pickerDialog).toBeVisible();

    // Change month to December (month index 11) and select day 15
    fireEvent.change(
      within(pickerDialog).getByRole("combobox", { name: "Month for FE-1" }),
      { target: { value: "11" } },
    );
    fireEvent.click(
      within(pickerDialog).getByRole("button", {
        name: "Set due date 2026-12-15",
      }),
    );

    await waitFor(() => {
      expect(dueTrigger).toHaveTextContent("2026-12-15");
      expect(api).toHaveBeenCalledWith(
        `/tasks/projects/${realProjectId}/tasks/${realTaskId}`,
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });
  });

  it("does not render a Comments column in List view", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const realTaskId = "69e923c77859fd1c702d4ca1";

    api.mockImplementation(async (path) => {
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
              dueDate: "2026-11-15T00:00:00.000Z",
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
    expect(screen.queryByText("Comments", { exact: true })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Comments" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Comments for FE-1" }),
    ).not.toBeInTheDocument();
  });

  it("loads real task history events in the History tab and disables demo vulnerability task creation on real projects", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const realTaskId = "69e923c77859fd1c702d4ca1";

    api.mockImplementation(async (path) => {
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
          status: "IN_PROGRESS",
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
          version: 2,
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
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${realTaskId}/worklogs`,
        )
      ) {
        return { items: [], totalMinutes: 0, nextAfterId: null };
      }
      if (
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${realTaskId}/history`,
        )
      ) {
        return {
          data: [
            {
              id: "69e923c77859fd1c702d4ch1",
              type: "TASK_STATUS_TRANSITIONED",
              actor: {
                id: "69e923c77859fd1c702d4c10",
                fullName: "KeyT Xin Chàoo",
              },
              fromStatus: "TODO",
              toStatus: "IN_PROGRESS",
              changedFields: ["status"],
              occurredAt: "2026-10-23T08:15:00.000Z",
              version: 2,
            },
          ],
          pagination: {
            page: 1,
            limit: 50,
            hasNext: false,
          },
        };
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
              status: "IN_PROGRESS",
              priority: "MEDIUM",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: 2,
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

    const historyTab = await screen.findByRole("button", { name: "History" });
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(
        screen.getByText(/updated status from TODO to IN_PROGRESS/i),
      ).toBeVisible();
    });
    expect(screen.queryByText(/• Today/i)).not.toBeInTheDocument();
  });

  it("auto-expands subtasks in the main List view and shows them on the Board view with Parent badge", async () => {
    const realProjectId = "69e923c77859fd1c702d4ca0";
    const realTaskId = "69e923c77859fd1c702d4cb0";
    const subTask1Id = "69e923c77859fd1c702d4cb1";
    const subTask2Id = "69e923c77859fd1c702d4cb2";

    api.mockImplementation(async (path) => {
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
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return {
          items: [
            {
              id: realTaskId,
              projectId: realProjectId,
              key: "FE-1",
              title: "làm fe trang chủ",
              type: "TASK",
              status: "IN_PROGRESS",
              priority: "MEDIUM",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 2, done: 0 },
              version: 1,
              createdAt: "2026-10-20T00:00:00.000Z",
              updatedAt: "2026-10-20T00:00:00.000Z",
            },
            {
              id: subTask1Id,
              projectId: realProjectId,
              key: "FE-2",
              title: "làm phần header",
              type: "SUBTASK",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: "69e923c77859fd1c702d4c10",
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: realTaskId,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: 1,
              createdAt: "2026-10-20T01:00:00.000Z",
              updatedAt: "2026-10-20T01:00:00.000Z",
            },
            {
              id: subTask2Id,
              projectId: realProjectId,
              key: "FE-3",
              title: "làm phần thân",
              type: "SUBTASK",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: null,
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: realTaskId,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: 1,
              createdAt: "2026-10-20T02:00:00.000Z",
              updatedAt: "2026-10-20T02:00:00.000Z",
            },
          ],
          nextAfterId: null,
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(realProjectId);

    // Subtasks FE-2 and FE-3 are automatically expanded and visible in main List view
    expect(await screen.findByText("làm fe trang chủ")).toBeVisible();
    expect(screen.getByText("làm phần header")).toBeVisible();
    expect(screen.getByText("làm phần thân")).toBeVisible();
    expect(screen.getByText("FE-2")).toBeVisible();
    expect(screen.getByText("FE-3")).toBeVisible();

    // Switch to Board tab and verify subtasks are visible with Parent: FE-1 badge
    const boardTab = screen.getByRole("button", { name: "Board" });
    fireEvent.click(boardTab);

    expect(await screen.findByText("làm phần header")).toBeVisible();
    expect(screen.getByText("làm phần thân")).toBeVisible();
    expect(screen.getAllByText(/Parent: FE-1/i).length).toBeGreaterThanOrEqual(2);
  });

  it("completes the active sprint through the API and only then shows confirmation", async () => {
    const projectId = "69e923c77859fd1c702d4c21";
    const sprintId = "69e923c77859fd1c702d4c31";
    const activeSprint = {
      id: sprintId,
      projectId,
      name: "Sprint 12",
      goal: "Ship workspace basics",
      status: "ACTIVE",
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: "2026-10-14T00:00:00.000Z",
      createdBy: "69e923c77859fd1c702d4c10",
      createdAt: "2026-10-01T00:00:00.000Z",
      completedAt: null,
      version: 3,
      counts: { totalTasks: 6, doneTasks: 4, inProgressTasks: 1, todoTasks: 1 },
    };
    const completePath = `/tasks/projects/${projectId}/sprints/${sprintId}/complete`;
    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "Minh Anh",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["MEMBER"],
        };
      }
      if (path === `/iam/projects/${projectId}`) {
        return {
          id: projectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          leaders: [{ userId: "69e923c77859fd1c702d4c10", fullName: "Minh Anh", email: "leader@example.test" }],
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${projectId}/memberships`)) {
        return { data: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } };
      }
      if (path === `/tasks/projects/${projectId}/sprints`) {
        return { items: [activeSprint] };
      }
      if (path === completePath && init?.method === "POST") {
        return {
          ...activeSprint,
          status: "COMPLETED",
          completedAt: "2026-10-23T00:00:00.000Z",
          version: 4,
        };
      }
      if (path.startsWith(`/tasks/projects/${projectId}/tasks`)) {
        return { items: [], nextAfterId: null, nextCursor: null };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(projectId);
    await screen.findByRole("heading", { level: 1, name: "Apollo" });
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete sprint" }));
    const dialog = await screen.findByRole("dialog", { name: "Complete sprint" });
    expect(dialog).toHaveTextContent("2 open work items will move to the backlog.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Complete sprint" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith(
      completePath,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ moveIncompleteToSprintId: null }),
      }),
    ));
    expect(await screen.findAllByText("Sprint completed.")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Sprint completed.");
    expect(screen.queryByText(/velocity recorded/i)).not.toBeInTheDocument();
  });

  it("keeps the sprint dialog open and reports an API error when completion fails", async () => {
    const projectId = "69e923c77859fd1c702d4c21";
    const sprintId = "69e923c77859fd1c702d4c31";
    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["MEMBER"],
        };
      }
      if (path === `/iam/projects/${projectId}`) {
        return {
          id: projectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          leaders: [{ userId: "69e923c77859fd1c702d4c10", fullName: "Minh Anh", email: "leader@example.test" }],
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${projectId}/memberships`)) {
        return { data: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } };
      }
      if (path === `/tasks/projects/${projectId}/sprints`) {
        return {
          items: [{ id: sprintId, name: "Sprint 12", status: "ACTIVE", version: 3 }],
        };
      }
      if (
        path === `/tasks/projects/${projectId}/sprints/${sprintId}/complete` &&
        init?.method === "POST"
      ) {
        throw new Error("Sprint completion failed");
      }
      if (path.startsWith(`/tasks/projects/${projectId}/tasks`)) {
        return { items: [], nextAfterId: null, nextCursor: null };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(projectId);
    await screen.findByRole("heading", { level: 1, name: "Apollo" });
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete sprint" }));
    const dialog = await screen.findByRole("dialog", { name: "Complete sprint" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Complete sprint" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sprint could not be completed. Please try again.",
    );
    expect(screen.getByRole("dialog", { name: "Complete sprint" })).toBeVisible();
    expect(screen.queryByText("Sprint completed.")).not.toBeInTheDocument();
  });

  it("persists quick-created tasks in the selected Board column", async () => {
    const projectId = "69e923c77859fd1c702d4c21";
    const taskId = "69e923c77859fd1c702d4c41";
    const createPath = `/tasks/projects/${projectId}/tasks`;
    const transitionPath = `${createPath}/${taskId}/transitions`;
    const createdTask = {
      id: taskId,
      projectId,
      key: "AP-42",
      title: "Add board quick-create regression test",
      description: null,
      type: "TASK",
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: null,
      createdBy: "69e923c77859fd1c702d4c10",
      parentId: null,
      sprintId: null,
      labels: [],
      steps: [],
      subtaskCounts: { total: 0, done: 0 },
      dueDate: null,
      startDate: null,
      completedAt: null,
      createdAt: "2026-10-23T00:00:00.000Z",
      updatedAt: "2026-10-23T00:00:00.000Z",
      version: 1,
    };
    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "Minh Anh",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["TEAM_LEADER"],
        };
      }
      if (path === `/iam/projects/${projectId}`) {
        return {
          id: projectId,
          organizationId: "69e923c77859fd1c702d4c01",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "69e923c77859fd1c702d4c10",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${projectId}/memberships`)) {
        return { data: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } };
      }
      if (path === createPath && init?.method === "POST") return createdTask;
      if (path === transitionPath && init?.method === "POST") {
        return { ...createdTask, status: "IN_PROGRESS", version: 2 };
      }
      if (path.startsWith(`/tasks/projects/${projectId}/tasks`)) {
        return { items: [], nextAfterId: null, nextCursor: null };
      }
      if (path === `/tasks/projects/${projectId}/sprints`) return { items: [] };
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(projectId);
    await screen.findByRole("heading", { level: 1, name: "Apollo" });
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    const inProgressColumn = document.getElementById("work-column-IN_PROGRESS")?.closest("section");
    expect(inProgressColumn).not.toBeNull();
    fireEvent.click(within(inProgressColumn!).getByRole("button", { name: "Create issue" }));
    fireEvent.change(screen.getByPlaceholderText("What needs to be done?"), {
      target: { value: "Add board quick-create regression test" },
    });
    fireEvent.submit(screen.getByPlaceholderText("What needs to be done?").closest("form")!);

    await waitFor(() => expect(api).toHaveBeenCalledWith(
      transitionPath,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ fromStatus: "TODO", toStatus: "IN_PROGRESS" }),
      }),
    ));
  });

  it("shows an unavailable state if an out-of-scope view is requested directly", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: "user-1", organizationId: "org-1", roles: ["MEMBER"] };
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

    mount("project-1", "forms");

    expect(await screen.findByText("Not available yet.")).toBeVisible();
    expect(screen.queryByText(/Create a form from template/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forms" })).not.toBeInTheDocument();
  });

  it("portals the task detail modal to document.body outside the workspace container with a sticky header", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: "user-1", name: "Minh Anh", organizationId: "org-1", roles: ["MEMBER"] };
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

    const { container } = mount("project-1");
    await screen.findByRole("heading", { level: 1, name: "Apollo" });

    const openTaskBtn = screen.getByRole("button", {
      name: /Open work item KNW-142/i,
    });
    fireEvent.click(openTaskBtn);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeVisible();
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);

    const header = dialog.querySelector("header");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(within(dialog).getByRole("button", { name: "Close work item details" })).toBeVisible();
  });

  it("allows an Organization Manager (ADMIN) to create tasks without direct project membership and edit Task title and description with ETag CAS and rollback", async () => {
    const orgId = "6ad76c7d938f3bf53df7335e";
    const projectId = "6addb4e1601e4bc926ed4602";
    const managerId = "6acbab2449b08a24945ccb6e";
    const otherCreatorId = "6ae3e59a2dee7f772d44cfaa";
    const existingTaskId = "6addbc84601e4bc926ed6b71";
    const createdTaskId = "6addbc84601e4bc926ed6b99";

    let currentTitle = "[DATN-289] [AUTH] Google OAuth đăng nhập và tự động tạo tài khoản";
    let currentDescription: string | null = "Original Jira specification";
    let currentVersion = 3;
    let failNextPatch = false;

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: managerId,
          name: "KeyT Xin Chàoo",
          organizationId: orgId,
          roles: ["ADMIN"],
        };
      }
      if (path === `/iam/projects/${projectId}`) {
        return {
          id: projectId,
          organizationId: orgId,
          name: "General",
          code: "GENERAL",
          visibility: "PRIVATE",
          status: "ACTIVE",
          leaders: [],
          createdBy: otherCreatorId,
          createdAt: "2026-10-25T00:00:00Z",
          updatedAt: "2026-10-25T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${projectId}/memberships`)) {
        return {
          data: [],
          pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
        };
      }
      if (path === `/tasks/projects/${projectId}/sprints`) {
        return { items: [] };
      }
      if (
        path === `/tasks/projects/${projectId}/tasks` &&
        init?.method === "POST"
      ) {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          title: string;
          description: string | null;
          assigneeId: string | null;
        };
        if (body.assigneeId !== null) {
          throw new ApiError(
            422,
            "ASSIGNEE_NOT_IN_PROJECT",
            "assigneeId must be an active member of the project.",
          );
        }
        return {
          id: createdTaskId,
          projectId,
          key: "GENERAL-99",
          title: body.title,
          description: body.description,
          type: "TASK",
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: null,
          createdBy: managerId,
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: null,
          createdAt: "2026-10-30T10:00:00.000Z",
          updatedAt: "2026-10-30T10:00:00.000Z",
          version: 1,
        };
      }
      if (
        path === `/tasks/projects/${projectId}/tasks/${existingTaskId}` &&
        init?.method === "PATCH"
      ) {
        if (failNextPatch) {
          throw new ApiError(
            409,
            "TASK_VERSION_CONFLICT",
            "Task was modified by another request.",
          );
        }
        const headers = new Headers(init.headers);
        expect(headers.get("If-Match")).toBe(
          `"task:${existingTaskId}:${currentVersion}"`,
        );
        const patchBody = JSON.parse(String(init.body ?? "{}")) as {
          title?: string;
          description?: string | null;
        };
        if (patchBody.title !== undefined) {
          currentTitle = patchBody.title;
        }
        if (patchBody.description !== undefined) {
          currentDescription = patchBody.description;
        }
        currentVersion += 1;
        return {
          id: existingTaskId,
          projectId,
          key: "GENERAL-2",
          title: currentTitle,
          description: currentDescription,
          type: "TASK",
          status: "DONE",
          priority: "MEDIUM",
          assigneeId: null,
          createdBy: otherCreatorId,
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: "2026-10-25T10:00:00.000Z",
          createdAt: "2026-10-25T00:00:00.000Z",
          updatedAt: "2026-10-30T10:00:00.000Z",
          version: currentVersion,
        };
      }
      if (path === `/tasks/projects/${projectId}/tasks/${existingTaskId}`) {
        return {
          id: existingTaskId,
          projectId,
          key: "GENERAL-2",
          title: currentTitle,
          description: currentDescription,
          type: "TASK",
          status: "DONE",
          priority: "MEDIUM",
          assigneeId: null,
          createdBy: otherCreatorId,
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: "2026-10-25T10:00:00.000Z",
          createdAt: "2026-10-25T00:00:00.000Z",
          updatedAt: "2026-10-25T00:00:00.000Z",
          version: currentVersion,
        };
      }
      if (
        path.startsWith(
          `/tasks/projects/${projectId}/tasks/${existingTaskId}/comments`,
        )
      ) {
        return { items: [], nextAfterId: null };
      }
      if (
        path.startsWith(
          `/tasks/projects/${projectId}/tasks/${existingTaskId}/worklogs`,
        )
      ) {
        return { items: [], totalMinutes: 0, nextAfterId: null };
      }
      if (
        path.startsWith(
          `/tasks/projects/${projectId}/tasks/${existingTaskId}/history`,
        )
      ) {
        return {
          data: [],
          pagination: { page: 1, limit: 50, hasNext: false },
        };
      }
      if (path.startsWith(`/tasks/projects/${projectId}/tasks`)) {
        return {
          items: [
            {
              id: existingTaskId,
              projectId,
              key: "GENERAL-2",
              title: currentTitle,
              type: "TASK",
              status: "DONE",
              priority: "MEDIUM",
              assigneeId: null,
              createdBy: otherCreatorId,
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: currentVersion,
              createdAt: "2026-10-25T00:00:00.000Z",
              updatedAt: "2026-10-25T00:00:00.000Z",
            },
          ],
          nextAfterId: null,
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(projectId);

    // 1. Manager creates a task via top Create dialog without hitting ASSIGNEE_NOT_IN_PROJECT
    expect(await screen.findByText(currentTitle)).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Create" })[0]);
    const createDialog = await screen.findByRole("dialog", {
      name: "Create work item",
    });
    fireEvent.change(
      within(createDialog).getByPlaceholderText("Describe the work item"),
      { target: { value: "Manager roadmap review task" } },
    );
    fireEvent.change(
      within(createDialog).getByPlaceholderText(
        /Add acceptance criteria or engineering context/i,
      ),
      { target: { value: "Created by Organization Manager" } },
    );
    fireEvent.submit(within(createDialog).getByRole("textbox", { name: /Summary/i }).closest("form")!);

    expect(await screen.findByText("GENERAL-99")).toBeVisible();
    expect(screen.getByText("Manager roadmap review task")).toBeVisible();

    // 2. Manager opens GENERAL-2 (created by another user) and edits Title + Description
    fireEvent.click(screen.getByText(currentTitle));
    const detailDialog = await screen.findByRole("dialog");
    expect(
      await within(detailDialog).findByText("Original Jira specification"),
    ).toBeVisible();

    fireEvent.click(
      within(detailDialog).getByRole("button", {
        name: "Edit work item title",
      }),
    );
    const titleInput = within(detailDialog).getByRole("textbox", {
      name: "Edit work item title",
    });
    fireEvent.change(titleInput, {
      target: {
        value: "[DATN-289] [AUTH] Google OAuth đăng nhập (Manager Updated)",
      },
    });
    fireEvent.submit(titleInput.closest("form")!);

    await waitFor(() => {
      expect(
        within(detailDialog).getByRole("heading", {
          name: "[DATN-289] [AUTH] Google OAuth đăng nhập (Manager Updated)",
        }),
      ).toBeVisible();
    });

    fireEvent.click(
      within(detailDialog).getByRole("button", {
        name: "Edit work item description",
      }),
    );
    const descInput = within(detailDialog).getByRole("textbox", {
      name: "Edit work item description",
    });
    fireEvent.change(descInput, {
      target: { value: "Updated description by Manager in General workspace" },
    });
    fireEvent.submit(descInput.closest("form")!);

    await waitFor(() => {
      expect(
        within(detailDialog).getByText(
          "Updated description by Manager in General workspace",
        ),
      ).toBeVisible();
    });
    expect(currentVersion).toBe(5);

    // 3. Simulate version conflict on next Title PATCH -> rolls back optimistic state & shows alert
    failNextPatch = true;
    fireEvent.click(
      within(detailDialog).getByRole("button", {
        name: "Edit work item title",
      }),
    );
    const failingTitleInput = within(detailDialog).getByRole("textbox", {
      name: "Edit work item title",
    });
    fireEvent.change(failingTitleInput, {
      target: { value: "Conflicting title edit" },
    });
    fireEvent.submit(failingTitleInput.closest("form")!);

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    await waitFor(() => {
      expect(
        screen.getAllByText(
          "[DATN-289] [AUTH] Google OAuth đăng nhập (Manager Updated)",
        ).length,
      ).toBeGreaterThan(0);
    });
  });

  it("supports Jira-style docked inline quick-create popovers (Type, Due date calendar, and Assignee) and sends exact POST payload", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const actorId = "69e923c77859fd1c702d4c10";
    const createdTaskId = "69e923c77859fd1c702d4cb8";
    let capturedCreateBody: Record<string, unknown> | null = null;

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: actorId,
          name: "KeyT Xin Chàoo",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["TEAM_LEADER"],
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
          createdBy: actorId,
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
              userId: actorId,
              role: "TEAM_LEADER",
              status: "ACTIVE",
              joinedAt: "2026-10-05T00:00:00Z",
              version: 1,
              user: {
                id: actorId,
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
      if (path.startsWith(`/tasks/projects/${realProjectId}/sprints`)) {
        return { items: [], nextCursor: null };
      }
      if (
        path === `/tasks/projects/${realProjectId}/tasks` &&
        init?.method === "POST"
      ) {
        capturedCreateBody = JSON.parse(String(init.body));
        return {
          id: createdTaskId,
          projectId: realProjectId,
          key: "FE-78",
          title: String(capturedCreateBody?.title ?? ""),
          description: null,
          type: String(capturedCreateBody?.type ?? "TASK"),
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: (capturedCreateBody?.assigneeId as string | null) ?? null,
          createdBy: actorId,
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: (capturedCreateBody?.dueDate as string | null) ?? null,
          startDate: null,
          completedAt: null,
          createdAt: "2026-10-31T00:00:00.000Z",
          updatedAt: "2026-10-31T00:00:00.000Z",
          version: 1,
        };
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return {
          items: [
            {
              id: "69e923c77859fd1c702d4ca1",
              projectId: realProjectId,
              key: "FE-1",
              title: "Existing workspace item",
              type: "TASK",
              status: "TODO",
              priority: "MEDIUM",
              assigneeId: null,
              createdBy: actorId,
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
    expect(await screen.findByText("Existing workspace item")).toBeVisible();

    // Open docked inline quick-create composer
    fireEvent.click(screen.getByTestId("work-list-inline-create-trigger"));
    expect(screen.getByTestId("work-list-inline-composer")).toBeVisible();

    // 1. Select BUG via interactive Issue Type popover
    fireEvent.click(screen.getByTestId("inline-create-type-trigger"));
    fireEvent.click(screen.getByTestId("inline-create-type-option-BUG"));

    // 2. Select 2026-12-20 via interactive Calendar Due Date popover
    const dueWrapper = screen.getByTestId("inline-create-due-date-wrapper");
    fireEvent.click(within(dueWrapper).getByRole("button"));
    const calendarDialog = screen.getByRole("dialog", {
      name: /Select due date for new work item/i,
    });
    fireEvent.change(
      within(calendarDialog).getByRole("combobox", {
        name: /Year for new work item/i,
      }),
      { target: { value: "2026" } },
    );
    fireEvent.change(
      within(calendarDialog).getByRole("combobox", {
        name: /Month for new work item/i,
      }),
      { target: { value: "11" } },
    );
    fireEvent.click(
      within(calendarDialog).getByRole("button", {
        name: "Set due date 2026-12-20",
      }),
    );

    // 3. Assign to current user via interactive Assignee popover
    fireEvent.click(screen.getByTestId("inline-create-assignee-trigger"));
    fireEvent.click(screen.getByTestId("inline-create-assign-to-me"));

    // 4. Enter summary & submit
    fireEvent.change(screen.getByPlaceholderText("What needs to be done?"), {
      target: { value: "Fix docked composer keyboard focus" },
    });
    fireEvent.click(screen.getByTestId("inline-create-submit"));

    await waitFor(() => {
      expect(capturedCreateBody).toMatchObject({
        title: "Fix docked composer keyboard focus",
        type: "BUG",
        assigneeId: actorId,
        dueDate: "2026-12-20T00:00:00.000Z",
      });
    });
    expect(await screen.findByText("FE-78")).toBeVisible();
  });

  it("shows an actionable Created <KEY> / View <KEY> toast after task creation and opens the full-page task editor when clicking View", async () => {
    const realProjectId = "69e923c77859fd1c702d4c21";
    const actorId = "69e923c77859fd1c702d4c10";
    const createdTaskId = "69e923c77859fd1c702d4cb9";

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: actorId,
          name: "KeyT Xin Chàoo",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["TEAM_LEADER"],
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
          createdBy: actorId,
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      if (path.startsWith(`/iam/projects/${realProjectId}/memberships`)) {
        return {
          data: [],
          pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 1 },
        };
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/sprints`)) {
        return { items: [], nextCursor: null };
      }
      if (
        path === `/tasks/projects/${realProjectId}/tasks` &&
        init?.method === "POST"
      ) {
        return {
          id: createdTaskId,
          projectId: realProjectId,
          key: "FE-79",
          title: "Upgrade Jira toast experience",
          description: null,
          type: "TASK",
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: null,
          createdBy: actorId,
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: null,
          createdAt: "2026-10-31T00:00:00.000Z",
          updatedAt: "2026-10-31T00:00:00.000Z",
          version: 1,
        };
      }
      if (path === `/tasks/projects/${realProjectId}/tasks/${createdTaskId}`) {
        return {
          id: createdTaskId,
          projectId: realProjectId,
          key: "FE-79",
          title: "Upgrade Jira toast experience",
          description: null,
          type: "TASK",
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: null,
          createdBy: actorId,
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: null,
          createdAt: "2026-10-31T00:00:00.000Z",
          updatedAt: "2026-10-31T00:00:00.000Z",
          version: 1,
        };
      }
      if (
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${createdTaskId}/comments`,
        )
      ) {
        return { items: [], nextAfterId: null };
      }
      if (
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${createdTaskId}/worklogs`,
        )
      ) {
        return { items: [], totalMinutes: 0, nextAfterId: null };
      }
      if (
        path.startsWith(
          `/tasks/projects/${realProjectId}/tasks/${createdTaskId}/history`,
        )
      ) {
        return {
          data: [],
          pagination: { page: 1, limit: 50, hasNext: false },
        };
      }
      if (path.startsWith(`/tasks/projects/${realProjectId}/tasks`)) {
        return { items: [], nextAfterId: null, nextCursor: null };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount(realProjectId);
    expect(
      await screen.findByTestId("work-list-inline-create-trigger"),
    ).toBeVisible();

    fireEvent.click(screen.getByTestId("work-list-inline-create-trigger"));
    fireEvent.change(screen.getByPlaceholderText("What needs to be done?"), {
      target: { value: "Upgrade Jira toast experience" },
    });
    fireEvent.click(screen.getByTestId("inline-create-submit"));

    // Verify Jira-style Created FE-79 / View FE-79 toast notification
    const toast = await screen.findByTestId("created-task-toast");
    await waitFor(() => {
      expect(toast).toBeVisible();
    });
    expect(within(toast).getByText("Created FE-79")).toBeVisible();
    const viewBtn = within(toast).getByRole("button", { name: "View FE-79" });
    expect(viewBtn).toBeVisible();

    // Clicking View FE-79 dismisses the toast and opens the full-page task detail editor
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("created-task-toast")).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("heading", {
        name: "Upgrade Jira toast experience",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit work item description" }),
    ).toBeVisible();
  });

  it("chains 2-step TODO <-> IN_REVIEW transitions and keeps header Create button outside sr-only when hideProjectBanner is true", async () => {
    const projectId = "69e923c77859fd1c702d4c21";
    const taskId = "69e923c77859fd1c702d4ca9";
    const transitionBodies: Array<{ fromStatus: string; toStatus: string }> = [];
    let currentStatus = "TODO";
    let currentVersion = 1;

    api.mockImplementation(async (path, init) => {
      if (path === "/auth/me") {
        return {
          id: "69e923c77859fd1c702d4c10",
          name: "Minh Manager",
          organizationId: "69e923c77859fd1c702d4c01",
          roles: ["ADMIN"],
        };
      }
      if (path.startsWith("/iam/projects?")) {
        return {
          data: [
            {
              id: projectId,
              organizationId: "69e923c77859fd1c702d4c01",
              name: "Continuum Frontend Portal",
              code: "CONT-FE",
              visibility: "PUBLIC",
              status: "ACTIVE",
              createdBy: "69e923c77859fd1c702d4c10",
              createdAt: "2026-10-05T00:00:00Z",
              updatedAt: "2026-10-05T00:00:00Z",
            },
          ],
          pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        };
      }
      if (path.startsWith(`/iam/projects/${projectId}/memberships`)) {
        return {
          data: [],
          pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
        };
      }
      if (path === `/tasks/projects/${projectId}/sprints`) {
        return { items: [] };
      }
      if (
        path === `/tasks/projects/${projectId}/tasks/${taskId}/transitions` &&
        init?.method === "POST"
      ) {
        const body = JSON.parse(String(init.body ?? "{}")) as {
          fromStatus: string;
          toStatus: string;
        };
        transitionBodies.push(body);
        currentStatus = body.toStatus;
        currentVersion += 1;
        return {
          id: taskId,
          projectId,
          key: "CONT-FE-1",
          title: "Verify 2-step review transition",
          description: null,
          type: "TASK",
          status: currentStatus,
          priority: "MEDIUM",
          assigneeId: null,
          createdBy: "69e923c77859fd1c702d4c10",
          parentId: null,
          sprintId: null,
          labels: [],
          steps: [],
          subtaskCounts: { total: 0, done: 0 },
          dueDate: null,
          startDate: null,
          completedAt: null,
          createdAt: "2026-10-25T00:00:00.000Z",
          updatedAt: "2026-10-30T00:00:00.000Z",
          version: currentVersion,
        };
      }
      if (path.startsWith(`/tasks/projects/${projectId}/tasks`)) {
        return {
          items: [
            {
              id: taskId,
              projectId,
              key: "CONT-FE-1",
              title: "Verify 2-step review transition",
              type: "TASK",
              status: currentStatus,
              priority: "MEDIUM",
              assigneeId: null,
              createdBy: "69e923c77859fd1c702d4c10",
              parentId: null,
              sprintId: null,
              dueDate: null,
              startDate: null,
              labels: [],
              subtaskCounts: { total: 0, done: 0 },
              version: currentVersion,
              createdAt: "2026-10-25T00:00:00.000Z",
              updatedAt: "2026-10-25T00:00:00.000Z",
            },
          ],
          nextAfterId: null,
          nextCursor: null,
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mountMemberWorkspace(projectId);
    expect(await screen.findByText("Verify 2-step review transition")).toBeVisible();

    const headerCreateBtn = screen
      .getAllByRole("button", { name: "Create" })
      .find((btn) => btn.closest("header") !== null);
    expect(headerCreateBtn).toBeDefined();
    expect(headerCreateBtn?.closest(".sr-only")).toBeNull();

    // Open CONT-FE-1 detail modal and transition TODO -> IN_REVIEW -> TODO
    fireEvent.click(screen.getByText("Verify 2-step review transition"));
    const dialog = await screen.findByRole("dialog");
    const statusSelect = within(dialog).getByLabelText("Update work item status");

    fireEvent.change(statusSelect, { target: { value: "IN_REVIEW" } });
    await waitFor(() => {
      expect(transitionBodies).toEqual([
        { fromStatus: "TODO", toStatus: "IN_PROGRESS" },
        { fromStatus: "IN_PROGRESS", toStatus: "IN_REVIEW" },
      ]);
    });

    fireEvent.change(statusSelect, { target: { value: "TODO" } });
    await waitFor(() => {
      expect(transitionBodies).toEqual([
        { fromStatus: "TODO", toStatus: "IN_PROGRESS" },
        { fromStatus: "IN_PROGRESS", toStatus: "IN_REVIEW" },
        { fromStatus: "IN_REVIEW", toStatus: "IN_PROGRESS" },
        { fromStatus: "IN_PROGRESS", toStatus: "TODO" },
      ]);
    });
  });
});
