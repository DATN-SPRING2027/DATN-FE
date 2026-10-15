import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { vi, beforeEach, it, expect } from "vitest";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import { apiClient, ApiError } from "@/lib/api-client";
import { useClientStateStore } from "@/stores/client-state";
import ProjectWorkspace from "./ProjectWorkspace";
import ProjectDetail from "./ProjectDetail";
import ProjectCreateForm from "./ProjectCreateForm";
import ProjectCreate from "./ProjectCreate";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/icons", () => ({
  ChevronDownIcon: () => null,
  FolderIcon: () => null,
  GridIcon: () => null,
  ListIcon: () => null,
  TrashBinIcon: () => null,
  TimeIcon: () => null,
  PlusIcon: () => null,
  CheckCircleIcon: () => null,
  LockIcon: () => null,
  UserCircleIcon: () => null,
  GroupIcon: () => null,
  EyeIcon: () => null,
  TaskIcon: () => null,
}));
const api = vi.mocked(apiClient);
const project = {
  id: "p1",
  organizationId: "org1",
  name: "Apollo",
  code: "AP",
  visibility: "PRIVATE",
  status: "ACTIVE",
  createdBy: "u1",
  createdAt: "2026-10-05T00:00:00Z",
  updatedAt: "2026-10-05T00:00:00Z",
};
const user = { id: "u1", organizationId: "org1", roles: ["MEMBER"] };
const list = (data: unknown[] = [project]) => ({
  data,
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: data.length,
    totalPages: data.length ? 1 : 0,
  },
});
function mount(
  children: ReactNode,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  };
}
beforeEach(() => {
  api.mockReset();
  push.mockReset();
  useClientStateStore.setState({ activeProjectId: null });
});
it("shows loading while the server list is pending", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : new Promise(() => {}),
  );
  mount(<ProjectWorkspace />);
  await screen.findByRole("link", { name: "Create project" });
  expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
});
it("renders an empty organization list", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : list([]),
  );
  mount(<ProjectWorkspace />);
  expect(await screen.findByText(messages.projects.empty)).toBeVisible();
});
it("uses the accepted list path, follows pagination and status filters", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me"
      ? user
      : {
          ...list(),
          pagination: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 },
        },
  );
  mount(<ProjectWorkspace />);
  expect(await screen.findByRole("link", { name: "Apollo" })).toHaveAttribute(
    "href",
    "/projects/p1",
  );
  expect(api).toHaveBeenCalledWith(
    "/iam/projects?page=1&pageSize=20",
    expect.objectContaining({ cache: "no-store" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/iam/projects?page=2&pageSize=20",
      expect.anything(),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Archived" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/iam/projects?page=1&pageSize=20&status=ARCHIVED",
      expect.anything(),
    ),
  );
});
it("supports grid/list layout and client sorting without hiding task data gaps", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me"
      ? user
      : list([
          {
            ...project,
            id: "p2",
            name: "Zulu",
            updatedAt: "2026-10-06T00:00:00Z",
          },
          {
            ...project,
            id: "p1",
            name: "Apollo",
            updatedAt: "2026-10-05T00:00:00Z",
          },
        ]),
  );
  mount(<ProjectWorkspace />);
  expect(await screen.findByRole("link", { name: "Apollo" })).toBeVisible();
  expect(screen.getAllByText("Task data unavailable")).toHaveLength(2);
  expect(screen.queryByText("Visibility")).not.toBeInTheDocument();
  expect(screen.queryByText("Updated at")).not.toBeInTheDocument();
  const listViewButton = screen.getByRole("button", { name: "List view" });
  fireEvent.click(listViewButton);
  expect(listViewButton).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Sort projects"), {
    target: { value: "name" },
  });
  const cards = screen.getAllByRole("article");
  expect(cards[0]).toContainElement(
    screen.getByRole("link", { name: "Apollo" }),
  );
});
it.each([401, 403, 500])(
  "shows list error %s without using client selection as authorization",
  async (status) => {
    useClientStateStore.setState({ activeProjectId: "p1" });
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") return user;
      throw new ApiError(status, undefined, "Denied");
    });
    mount(<ProjectWorkspace />);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
  },
);
it("retries a failed list", async () => {
  let failed = true;
  api.mockImplementation(async (path) => {
    if (path === "/auth/me") return user;
    if (failed) throw new Error("Offline");
    return list();
  });
  mount(<ProjectWorkspace />);
  await screen.findByRole("alert");
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("link", { name: "Apollo" })).toBeVisible();
});
it("validates the form before sending a request, then submits only accepted fields", async () => {
  const onCreated = vi.fn();
  api.mockResolvedValue(project);
  mount(<ProjectCreateForm organizationId="org1" onCreated={onCreated} />);
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.projects.validation,
  );
  expect(api).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Apollo" },
  });
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "AP" } });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await waitFor(() => expect(onCreated.mock.calls[0]?.[0]).toEqual(project));
  expect(api).toHaveBeenCalledWith("/iam/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Apollo", code: "AP" }),
  });
});
it.each([401, 403, 409, 422, 500])(
  "shows create failure %s and preserves input",
  async (status) => {
    api.mockRejectedValue(new ApiError(status, undefined, "Denied"));
    mount(<ProjectCreateForm organizationId="org1" onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Apollo" },
    });
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "AP" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Apollo");
  },
);
it("disables duplicate submissions while creation is pending", async () => {
  api.mockImplementation(() => new Promise(() => {}));
  mount(<ProjectCreateForm organizationId="org1" onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Apollo" },
  });
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "AP" } });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  expect(
    await screen.findByRole("button", { name: "Creating…" }),
  ).toBeDisabled();
  expect(api).toHaveBeenCalledTimes(1);
});
it("loads project detail by the accepted ID path", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : project,
  );
  mount(<ProjectDetail projectId="p1" />);
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apollo" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
    "href",
    "/projects/p1/work",
  );
  expect(screen.getByText("Private")).toBeVisible();
  expect(api).toHaveBeenCalledWith(
    "/iam/projects/p1",
    expect.objectContaining({ cache: "no-store" }),
  );
});
it.each([401, 403, 404, 500])(
  "hides detail on server denial %s even with cached project and selection",
  async (status) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["projects", "org1", "detail", "p1"], project);
    useClientStateStore.setState({ activeProjectId: "p1" });
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") return user;
      throw new ApiError(status, undefined, "Denied");
    });
    mount(<ProjectDetail projectId="p1" />, client);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
  },
);

it("does not show cached detail before a fresh backend response", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["projects", "org1", "detail", "p1"], project);
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : new Promise(() => {}),
  );
  mount(<ProjectDetail projectId="p1" />, client);
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/iam/projects/p1", expect.anything()),
  );
  expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
});
it("clears displayed projects when the trusted organization changes", async () => {
  let organization = "org1";
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : organization === "org1" ? list() : list([]),
  );
  const { client } = mount(<ProjectWorkspace />);
  await screen.findByRole("link", { name: "Apollo" });
  organization = "org2";
  act(() => {
    client.setQueryData(["auth", "current-user"], {
      ...user,
      organizationId: "org2",
    });
  });
  await screen.findByText(messages.projects.empty);
  expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  expect(
    client.getQueryData([
      "projects",
      "org2",
      "list",
      { page: 1, pageSize: 20 },
    ]),
  ).toEqual(list([]));
});
it.each([
  { name: " ", code: "AP", description: "" },
  { name: "A".repeat(201), code: "AP", description: "" },
  { name: "Apollo", code: "aP", description: "" },
  { name: "Apollo", code: "A", description: "" },
  { name: "Apollo", code: "AP", description: "A".repeat(2001) },
])("rejects invalid create input before calling the backend %#", (input) => {
  mount(<ProjectCreateForm organizationId="org1" onCreated={vi.fn()} />);
  for (const field of ["name", "code", "description"] as const)
    fireEvent.change(screen.getByLabelText(messages.projects[field]), {
      target: { value: input[field] },
    });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.projects.validation,
  );
  expect(api).not.toHaveBeenCalled();
});
it("creates on a separate page and navigates to the backend-created detail", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : project,
  );
  mount(<ProjectCreate />);
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Apollo" },
  });
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "AP" } });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "A project" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p1"));
  expect(api).toHaveBeenCalledWith("/iam/projects", {
    method: "POST",
    body: JSON.stringify({
      name: "Apollo",
      code: "AP",
      description: "A project",
    }),
  });
});

it("renders server-returned public archived metadata without adding administration actions", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me"
      ? user
      : list([
          {
            ...project,
            visibility: "PUBLIC",
            status: "ARCHIVED",
            description: "Project purpose",
          },
        ]),
  );
  mount(<ProjectWorkspace />);
  expect(await screen.findByRole("link", { name: "Apollo" })).toBeVisible();
  expect(
    within(screen.getByRole("article")).getByText("Archived"),
  ).toBeVisible();
  expect(screen.getByText("Project purpose")).toBeVisible();
  expect(screen.getByText("1 project")).toBeVisible();
  expect(screen.queryByText("Public")).not.toBeInTheDocument();
  expect(screen.queryByText("Oct 5, 2026")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /publish|edit|add task|members/i }),
  ).not.toBeInTheDocument();
});

it("submits a multiline description unchanged", async () => {
  api.mockResolvedValue(project);
  mount(<ProjectCreateForm organizationId="org1" onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Apollo" },
  });
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "AP" } });
  const description = screen.getByLabelText("Description");
  expect(description.tagName).toBe("TEXTAREA");
  fireEvent.change(description, {
    target: { value: "First line\nSecond line" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/iam/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "Apollo",
        code: "AP",
        description: "First line\nSecond line",
      }),
    }),
  );
});

it("keeps detail in a loading state until the backend resolves", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : new Promise(() => {}),
  );
  mount(<ProjectDetail projectId="p1" />);
  expect(await screen.findByRole("status")).toHaveTextContent(
    messages.projects.loading,
  );
  expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
});

it("shows private creation as information and cancels back to the list", async () => {
  api.mockResolvedValue(user);
  mount(<ProjectCreate />);
  expect(await screen.findByText(messages.projects.privateHint)).toBeVisible();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(push).toHaveBeenCalledWith("/projects");
  expect(api.mock.calls.some(([, options]) => options?.method === "POST")).toBe(
    false,
  );
});

it("links to a separate create page without embedding the form in the list", async () => {
  api.mockImplementation(async (path) => (path === "/auth/me" ? user : list()));
  mount(<ProjectWorkspace />);
  expect(
    await screen.findByRole("link", { name: "Create project" }),
  ).toHaveAttribute("href", "/projects/new");
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  expect(screen.getByText(messages.projects.workspaceHint)).toBeVisible();
  expect(
    screen.queryByText(messages.projects.organizationScope),
  ).not.toBeInTheDocument();
});

it("resets create input when the trusted organization changes", async () => {
  api.mockResolvedValue(user);
  const { client } = mount(<ProjectCreate />);
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Unsaved" },
  });
  act(() =>
    client.setQueryData(["auth", "current-user"], {
      ...user,
      organizationId: "org2",
    }),
  );
  await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(""));
});

it.each([401, 403, 500])(
  "hides create form if session is denied %s",
  async (status) => {
    api.mockRejectedValue(new ApiError(status, undefined, "Denied"));
    mount(<ProjectCreate />);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  },
);

it("renders detail overview and context from backend metadata", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me"
      ? user
      : { ...project, description: "First line\nSecond line" },
  );
  mount(<ProjectDetail projectId="p1" />);
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apollo" }),
  ).toBeVisible();
  expect(screen.getAllByText("First line Second line")[0]).toBeVisible();
  expect(screen.getByText("org1")).toBeVisible();
  expect(screen.getByText("u1")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /deploy|edit|manage access/i }),
  ).not.toBeInTheDocument();
});

it("switches member management inline without navigating away from Project details", async () => {
  api.mockImplementation(async (path) => {
    if (path === "/auth/me") return user;
    if (path.includes("/memberships")) return list([]);
    return project;
  });
  mount(<ProjectDetail projectId="p1" />);
  const overview = await screen.findByRole("tab", { name: "Overview" });
  const members = screen.getByRole("tab", { name: "Project members" });
  expect(overview).toHaveAttribute("aria-selected", "true");
  expect(api.mock.calls.some(([path]) => path.includes("/memberships"))).toBe(
    false,
  );
  fireEvent.click(members);
  await waitFor(() =>
    expect(
      screen.queryByRole("form", { name: "Add member" }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Open Add member form" }));
  expect(await screen.findByRole("form", { name: "Add member" })).toBeVisible();
  expect(screen.getByRole("dialog", { name: "Add member" })).toBeVisible();
  expect(members).toHaveAttribute("aria-selected", "true");
  expect(
    screen.queryByRole("link", { name: "Project members" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Private")).not.toBeVisible();
  expect(push).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/p1/memberships?page=1&pageSize=20&status=ACTIVE",
      expect.any(Object),
    ),
  );
  fireEvent.keyDown(members, { key: "ArrowLeft" });
  expect(overview).toHaveFocus();
  expect(screen.getByText("Private")).toBeVisible();
  expect(
    screen.queryByRole("form", { name: "Add member" }),
  ).not.toBeInTheDocument();
});

it.each(["PUBLIC", "PRIVATE"] as const)(
  "changes visibility to %s on the live Project page",
  async (target) => {
    let changed = false;
    api.mockImplementation(async (path, options) => {
      if (path === "/auth/me") return user;
      if (path.endsWith("/visibility") && options?.method !== "PATCH")
        return { canManageVisibility: true };
      if (path.endsWith("/visibility")) {
        changed = true;
        return { ...project, visibility: target };
      }
      return {
        ...project,
        visibility: changed
          ? target
          : target === "PUBLIC"
            ? "PRIVATE"
            : "PUBLIC",
      };
    });
    mount(<ProjectDetail projectId="p1" />);
    const label = target === "PUBLIC" ? "Make public" : "Make private";
    await waitFor(() =>
      expect(screen.getByRole("button", { name: label })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: label }));
    fireEvent.click(
      screen.getByRole("button", {
        name:
          target === "PUBLIC"
            ? "Confirm publication"
            : "Confirm private visibility",
      }),
    );
    expect(
      await screen.findByText(target === "PUBLIC" ? "Public" : "Private"),
    ).toBeVisible();
    expect(
      await screen.findByText(
        target === "PUBLIC"
          ? "Project is now public."
          : "Project is now private.",
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: target === "PUBLIC" ? "Make private" : "Make public",
        }),
      ).toBeEnabled(),
    );
    const toast = screen
      .getByText(
        target === "PUBLIC"
          ? "Project is now public."
          : "Project is now private.",
      )
      .closest('[role="status"]');
    expect(toast).toHaveClass("fixed", "end-4", "top-5");
    expect(toast?.parentElement).toBe(document.body);
  },
);
it("reconciles stale visibility after conflict without false publication success", async () => {
  let changed = false;
  api.mockImplementation(async (path, options) => {
    if (path === "/auth/me") return user;
    if (path.endsWith("/visibility") && options?.method !== "PATCH")
      return { canManageVisibility: true };
    if (path.endsWith("/visibility")) {
      changed = true;
      throw new ApiError(409, undefined, "Conflict");
    }
    return { ...project, visibility: changed ? "PUBLIC" : "PRIVATE" };
  });
  mount(<ProjectDetail projectId="p1" />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Make public" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Make public" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("changed");
  fireEvent.click(screen.getByRole("button", { name: "Refresh project" }));
  expect(await screen.findByText("Public")).toBeVisible();
  expect(screen.queryByText("Project is now public.")).not.toBeInTheDocument();
});
it("hides metadata if making private removes the actor's PUBLIC-only read access", async () => {
  let changed = false;
  api.mockImplementation(async (path, options) => {
    if (path === "/auth/me") return user;
    if (path.endsWith("/visibility") && options?.method !== "PATCH")
      return { canManageVisibility: true };
    if (path.endsWith("/visibility")) {
      changed = true;
      return { ...project, visibility: "PRIVATE" };
    }
    if (changed) throw new ApiError(403, undefined, "Read denied");
    return { ...project, visibility: "PUBLIC" };
  });
  mount(<ProjectDetail projectId="p1" />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Make private" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Make private" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm private visibility" }),
  );
  await screen.findByRole("alert");
  expect(await screen.findByText("Project is now private.")).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Apollo" }),
  ).not.toBeInTheDocument();
});
it("does not grant visibility management from ADMIN client roles", async () => {
  api.mockImplementation(async (path) => {
    if (path === "/auth/me") return { ...user, roles: ["ADMIN"] };
    if (path.endsWith("/visibility"))
      throw new ApiError(403, undefined, "Denied");
    return project;
  });
  mount(<ProjectDetail projectId="p1" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("permission");
  expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
  expect(
    api.mock.calls.some(([, options]) => options?.method === "PATCH"),
  ).toBe(false);
});

it("keeps a late visibility response scoped to the original Project", async () => {
  let finish!: (value: unknown) => void;
  api.mockImplementation(async (path, options) => {
    if (path === "/auth/me") return user;
    if (path.endsWith("/visibility") && options?.method !== "PATCH")
      return { canManageVisibility: true };
    if (path.endsWith("/visibility"))
      return new Promise((resolve) => {
        finish = resolve;
      });
    return path.endsWith("/p2")
      ? { ...project, id: "p2", name: "Other project" }
      : project;
  });
  const { client, rerender } = mount(<ProjectDetail projectId="p1" />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Make public" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Make public" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
  await waitFor(() => expect(finish).toBeDefined());
  rerender(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectDetail projectId="p2" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Other project" });
  await act(async () => {
    finish({ ...project, visibility: "PUBLIC" });
  });
  expect(screen.getByText("Private")).toBeVisible();
  expect(screen.queryByText("Project is now public.")).not.toBeInTheDocument();
});
