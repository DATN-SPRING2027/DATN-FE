import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
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

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/icons", () => ({ ChevronDownIcon: () => null }));
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
  useClientStateStore.setState({ activeProjectId: null });
});
it("shows loading while the server list is pending", async () => {
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : new Promise(() => {}),
  );
  mount(<ProjectWorkspace />);
  await screen.findByRole("button", { name: "Create project" });
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
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "ARCHIVED" },
  });
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/iam/projects?page=1&pageSize=20&status=ARCHIVED",
      expect.anything(),
    ),
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
  expect(await screen.findByText("Apollo")).toBeVisible();
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
  expect(await screen.findByText("Apollo")).toBeVisible();
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
  await screen.findByRole("link", { name: "Back to projects" });
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/iam/projects/p1", expect.anything()),
  );
  expect(screen.queryByText("Apollo")).not.toBeInTheDocument();
});
it("clears displayed projects and form state when the trusted organization changes", async () => {
  let organization = "org1";
  api.mockImplementation(async (path) =>
    path === "/auth/me" ? user : organization === "org1" ? list() : list([]),
  );
  const { client } = mount(<ProjectWorkspace />);
  await screen.findByText("Apollo");
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Unsaved" },
  });
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
it("refreshes the list and links to the backend-created project after success", async () => {
  let created = false;
  api.mockImplementation(async (path, options) => {
    if (path === "/auth/me") return user;
    if (options?.method === "POST") {
      created = true;
      return project;
    }
    return created ? list() : list([]);
  });
  mount(<ProjectWorkspace />);
  await screen.findByText(messages.projects.empty);
  fireEvent.click(screen.getByRole("button", { name: "Create project" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Apollo" },
  });
  fireEvent.change(screen.getByLabelText("Code"), { target: { value: "AP" } });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "A project" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Create project" })[0]);
  expect(
    await screen.findByRole("link", { name: "View project" }),
  ).toHaveAttribute("href", "/projects/p1");
  expect(await screen.findByRole("link", { name: "Apollo" })).toBeVisible();
  expect(api).toHaveBeenCalledWith("/iam/projects", {
    method: "POST",
    body: JSON.stringify({
      name: "Apollo",
      code: "AP",
      description: "A project",
    }),
  });
});
