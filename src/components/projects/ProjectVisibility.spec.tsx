import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import { projectKeys, type Project } from "@/lib/queries/projects/useProjects";
import messages from "@/messages/en.json";
import ProjectVisibility from "./ProjectVisibility";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const api = vi.mocked(apiClient);
const project: Project = {
  id: "p/1",
  organizationId: "org1",
  name: "Apollo",
  code: "AP",
  visibility: "PRIVATE",
  status: "ACTIVE",
  createdBy: "u1",
  createdAt: "2026-10-05T00:00:00Z",
  updatedAt: "2026-10-05T00:00:00Z",
};
function mount(value = project) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(
    projectKeys.detail(value.organizationId, value.id),
    value,
  );
  const listKey = projectKeys.list(value.organizationId, {
    page: 1,
    pageSize: 20,
  });
  client.setQueryData(listKey, { data: [value] });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectVisibility project={value} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { client, listKey };
}
function mutationResult(run: () => Promise<unknown>) {
  api.mockImplementation(async (_path, options) =>
    options?.method === "PATCH" ? run() : { canManageVisibility: true },
  );
}
const patches = () =>
  api.mock.calls.filter(([, options]) => options?.method === "PATCH");
async function open(target: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  const button = screen.getByRole("button", {
    name: target === "PUBLIC" ? "Make public" : "Make private",
  });
  await waitFor(() => expect(button).toBeEnabled());
  button.focus();
  fireEvent.click(button);
  return button;
}
async function confirm(target: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  await open(target);
  fireEvent.click(
    screen.getByRole("button", {
      name:
        target === "PUBLIC"
          ? "Confirm publication"
          : "Confirm private visibility",
    }),
  );
}
beforeEach(() => {
  api.mockReset();
  mutationResult(async () => ({ ...project, visibility: "PUBLIC" }));
});
it("disables the control until authoritative permission arrives", async () => {
  let finish!: (value: unknown) => void;
  api.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  const button = screen.getByRole("button", { name: "Make public" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(patches()).toHaveLength(0);
  finish({ canManageVisibility: true });
  await waitFor(() => expect(button).toBeEnabled());
});
it.each(["PRIVATE", "PUBLIC"] as const)(
  "greys out %s on upfront denial without a mutation or Refresh",
  async (visibility) => {
    api.mockRejectedValue(new ApiError(403, undefined, "Forbidden"));
    mount({ ...project, visibility });
    expect(await screen.findByRole("alert")).toHaveTextContent("permission");
    expect(
      screen.getByRole("button", {
        name: visibility === "PRIVATE" ? "Make public" : "Make private",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Refresh project" }),
    ).not.toBeInTheDocument();
    expect(patches()).toHaveLength(0);
  },
);
it("fails closed on roles or malformed capability instead of authorizing locally", async () => {
  api.mockResolvedValue({ roles: ["ADMIN"] });
  mount();
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
  expect(patches()).toHaveLength(0);
});
it.each(["PUBLIC", "PRIVATE"] as const)(
  "confirms %s with correct scope; cancellation sends nothing",
  async (target) => {
    mount({
      ...project,
      visibility: target === "PUBLIC" ? "PRIVATE" : "PUBLIC",
    });
    const trigger = await open(target);
    expect(screen.getByRole("dialog")).toHaveTextContent("metadata");
    if (target === "PRIVATE")
      expect(screen.getByRole("dialog")).toHaveTextContent("lose access");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(
      screen.getByRole("button", {
        name:
          target === "PUBLIC"
            ? "Confirm publication"
            : "Confirm private visibility",
      }),
    ).toHaveFocus();
    fireEvent.click(cancel);
    expect(trigger).toHaveFocus();
    await open(target);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(patches()).toHaveLength(0);
  },
);
it.each(["PUBLIC", "PRIVATE"] as const)(
  "sends exact %s payload and applies only validated server data",
  async (visibility) => {
    const updated = { ...project, visibility };
    mutationResult(async () => updated);
    const { client, listKey } = mount({
      ...project,
      visibility: visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
    });
    await confirm(visibility);
    await waitFor(() =>
      expect(client.getQueryData(projectKeys.detail("org1", "p/1"))).toEqual(
        updated,
      ),
    );
    expect(patches()).toHaveLength(1);
    expect(patches()[0]).toEqual([
      "/iam/projects/p%2F1/visibility",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ visibility }),
      }),
    ]);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    if (visibility === "PRIVATE")
      expect(
        client.getQueryState(projectKeys.detail("org1", "p/1"))?.isInvalidated,
      ).toBe(true);
  },
);
it("offers no mutation or permission probe for archived Projects", () => {
  mount({ ...project, status: "ARCHIVED" });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});
it.each([
  [403, "permission"],
  [409, "changed"],
  [401, "session expired"],
  [404, "unavailable"],
  [422, "rejected"],
  [429, "Too many"],
  [500, "could not be confirmed"],
])("handles mutation %s after permission was allowed", async (status, text) => {
  mutationResult(async () => {
    throw new ApiError(status as number, undefined, "Sensitive backend text");
  });
  const { client } = mount();
  await confirm();
  expect(await screen.findByRole("alert")).toHaveTextContent(text as string);
  expect(screen.queryByText("Sensitive backend text")).not.toBeInTheDocument();
  expect(screen.queryByText("Project is now public.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Make public" })).toBeDisabled();
  expect(client.getQueryData(projectKeys.detail("org1", "p/1"))).toEqual(
    project,
  );
  expect(patches()).toHaveLength(1);
  if (status === 403) {
    expect(
      screen.queryByRole("button", { name: "Refresh project" }),
    ).not.toBeInTheDocument();
    return;
  }
  fireEvent.click(screen.getByRole("button", { name: "Refresh project" }));
  await waitFor(() =>
    expect(
      client.getQueryState(projectKeys.detail("org1", "p/1"))?.isInvalidated,
    ).toBe(true),
  );
});
it.each([
  new TypeError("network"),
  new DOMException("timeout", "TimeoutError"),
])("requires reconciliation after uncertain results", async (error) => {
  mutationResult(async () => {
    throw error;
  });
  mount();
  await confirm();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Refresh the project before trying again",
  );
  expect(patches()).toHaveLength(1);
});
it("rejects a cross-organization response", async () => {
  mutationResult(async () => ({
    ...project,
    organizationId: "other",
    visibility: "PUBLIC",
  }));
  const { client } = mount();
  await confirm();
  await screen.findByRole("alert");
  expect(client.getQueryData(projectKeys.detail("org1", "p/1"))).toEqual(
    project,
  );
});
it("blocks duplicates and dismissal while pending", async () => {
  let finish!: (value: unknown) => void;
  mutationResult(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  await confirm();
  fireEvent.click(
    await screen.findByRole("button", { name: "Updating visibility…" }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(patches()).toHaveLength(1);
  finish({ ...project, visibility: "PUBLIC" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
it.each([403, 409])(
  "handles reverse-transition %s without optimistic privacy",
  async (status) => {
    mutationResult(async () => {
      throw new ApiError(status, undefined, "Rejected");
    });
    const original = { ...project, visibility: "PUBLIC" as const };
    const { client } = mount(original);
    await confirm("PRIVATE");
    await screen.findByRole("alert");
    expect(client.getQueryData(projectKeys.detail("org1", "p/1"))).toEqual(
      original,
    );
    expect(screen.getByRole("button", { name: "Make private" })).toBeDisabled();
    expect(patches()).toHaveLength(1);
  },
);

it("disables confirmation if the server withdraws permission while the dialog is open", async () => {
  let allowed = true;
  api.mockImplementation(async () => {
    if (!allowed) throw new ApiError(403, undefined, "Revoked");
    return { canManageVisibility: true };
  });
  const { client } = mount();
  await open();
  allowed = false;
  await client.invalidateQueries({
    queryKey: ["project-visibility-access", "org1", "p/1"],
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Confirm publication" }),
    ).toBeDisabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
  expect(patches()).toHaveLength(0);
});
