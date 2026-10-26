import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import { projectKeys, type Project } from "@/lib/queries/projects/useProjects";
import messages from "@/messages/en.json";
import ProjectSettings from "./ProjectSettings";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

const api = vi.mocked(apiClient);
const project: Project = {
  id: "project-1",
  organizationId: "org-1",
  name: "Continuum Core",
  code: "CONTINUUM_CORE",
  description: "Core project",
  visibility: "PRIVATE",
  status: "ACTIVE",
  createdBy: "user-1",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

function mount(value = project) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(
    projectKeys.detail(value.organizationId, value.id),
    value,
  );
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectSettings project={value} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (path, options) => {
    if (options?.method === "PATCH")
      return { ...project, updatedAt: "2026-10-20T10:00:00Z" };
    if (path.endsWith("/settings-access")) return { canUpdateProject: true };
    if (path.endsWith("/visibility")) return { canManageVisibility: true };
    throw new Error(`Unexpected API request: ${path}`);
  });
});

it("does not render administrative forms for a Member opening the Settings route directly", async () => {
  api.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Not permitted"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(/do not have permission/i);
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete project" })).not.toBeInTheDocument();
});

it("hides administrative forms until the backend confirms settings access", async () => {
  let finish!: (value: unknown) => void;
  api.mockImplementation((path) =>
    path.endsWith("/settings-access")
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({ canManageVisibility: true }),
  );
  mount();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  finish({ canUpdateProject: true });
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());
});

it("fails closed when the user is denied project.update", async () => {
  api.mockImplementation(async (path) => {
    if (path.endsWith("/settings-access"))
      throw new ApiError(403, "FORBIDDEN", "Forbidden");
    return { canManageVisibility: true };
  });
  mount();
  expect(
    await screen.findByText(/do not have permission to update/i),
  ).toBeVisible();
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(
    api.mock.calls.some(([, options]) => options?.method === "PATCH"),
  ).toBe(false);
});

it("disables editing when a settings access refetch fails after an earlier allow", async () => {
  let accessCalls = 0;
  api.mockImplementation(async (path, options) => {
    if (path.endsWith("/settings-access")) {
      accessCalls += 1;
      if (accessCalls > 1) throw new Error("Network failure");
      return { canUpdateProject: true };
    }
    if (options?.method === "PATCH")
      return { ...project, updatedAt: "2026-10-20T10:00:00Z" };
    if (path.endsWith("/visibility")) return { canManageVisibility: true };
    throw new Error(`Unexpected API request: ${path}`);
  });

  const client = mount();
  const name = await screen.findByLabelText("Name");
  fireEvent.change(name, { target: { value: "Unsaved update" } });
  const saveButton = screen.getByRole("button", { name: "Save changes" });
  expect(saveButton).toBeEnabled();

  await client.refetchQueries({
    queryKey: ["project-settings-access", "org-1", "project-1"],
    type: "active",
  });

  await waitFor(() => expect(name).toBeDisabled());
  expect(saveButton).toBeDisabled();
  expect(await screen.findByText(/access could not be checked/i)).toBeVisible();
  expect(
    api.mock.calls.some(([, options]) => options?.method === "PATCH"),
  ).toBe(false);
});

it("validates and saves only modified fields, then refreshes the Project cache", async () => {
  const updated = {
    ...project,
    name: "Updated Project",
    updatedAt: "2026-10-20T10:00:00Z",
  };
  api.mockImplementation(async (path, options) => {
    if (options?.method === "PATCH") return updated;
    if (path.endsWith("/settings-access")) return { canUpdateProject: true };
    if (path.endsWith("/visibility")) return { canManageVisibility: true };
    throw new Error(`Unexpected API request: ${path}`);
  });
  const client = mount();
  const name = await screen.findByLabelText("Name");
  fireEvent.change(name, { target: { value: "   " } });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Project name is required.",
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

  fireEvent.change(name, { target: { value: "Updated Project" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Project details updated.");
  const patch = api.mock.calls.find(
    ([, options]) => options?.method === "PATCH",
  );
  expect(patch?.[0]).toBe("/iam/projects/project-1");
  expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
    name: "Updated Project",
  });
  expect(client.getQueryData(projectKeys.detail("org-1", "project-1"))).toEqual(
    updated,
  );
});

it("sends null when clearing the description and reports a denied mutation", async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method === "PATCH")
      throw new ApiError(403, "FORBIDDEN", "Forbidden");
    if (path.endsWith("/settings-access")) return { canUpdateProject: true };
    if (path.endsWith("/visibility")) return { canManageVisibility: true };
    throw new Error(`Unexpected API request: ${path}`);
  });
  mount();
  const description = await screen.findByLabelText("Description");
  fireEvent.change(description, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "do not have permission",
  );
  const patch = api.mock.calls.find(
    ([, options]) => options?.method === "PATCH",
  );
  expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ description: null });
});
