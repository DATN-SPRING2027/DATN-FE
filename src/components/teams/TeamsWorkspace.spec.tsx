import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import TeamsWorkspace from "./TeamsWorkspace";
import { teamKeys } from "@/lib/queries/teams/useTeams";

const authority = vi.hoisted(() => ({ isLeader: true }));
vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectQuery: (_organizationId: string, projectId: string) => ({
    isPending: false,
    data: { id: projectId, organizationId: "org1", status: "ACTIVE", leaders: authority.isLeader ? [{ userId: "actor1" }] : [] },
  }),
}));

const { push, identity } = vi.hoisted(() => ({
  push: vi.fn(),
  identity: { id: "actor1", organizationId: "org1", roles: ["ADMIN"] },
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    isPending: false,
    isError: false,
    data: identity,
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const team = {
  id: "team1",
  organizationId: "org1",
  projectId: "project1",
  name: "Engineering",
  code: "ENG",
  description: null,
  status: "ACTIVE",
  version: 1,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
  archivedAt: null,
  archivedBy: null,
};
const list = (data: unknown[] = [team], page = 1, totalPages = 1) => ({
  data,
  pagination: { page, pageSize: 20, totalItems: data.length, totalPages },
});
const response = (body: unknown = team, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { etag: `"team:team1:${(body as typeof team)?.version ?? 1}"` },
  });
// Command tests first authorize the read-only Team access check, then exercise
// the independently configured write outcome. Read-denial tests do not use this.
const withTeamRead = (command: (url: RequestInfo | URL, options?: RequestInit) => Promise<Response>) =>
  (url: RequestInfo | URL, options?: RequestInit) => String(url).includes("/projects/project1/teams?")
    ? Promise.resolve(response(list()))
    : command(url, options);
function mount(
  mode: "list" | "create" | "detail" | "edit" = "list",
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const element = (projectId = "project1") => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <TeamsWorkspace
          projectId={projectId}
          teamId={mode === "detail" || mode === "edit" ? "team1" : undefined}
          mode={mode}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const view = render(element());
  return { client, ...view, rerenderProject: (projectId: string) => view.rerender(element(projectId)) };
}
async function fill() {
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Research" },
  });
  fireEvent.change(screen.getByLabelText("Code"), {
    target: { value: "RESEARCH" },
  });
}
beforeEach(() => { push.mockReset(); authority.isLeader = true; });

it.each(["MEMBER", "ADMIN", "TEAM_LEADER"])("does not render the Team create form for an unassigned %s", async (role) => {
  authority.isLeader = false;
  identity.roles = [role];
  mount("create");
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it("denies the direct Team edit route without effective Project leadership", async () => {
  authority.isLeader = false;
  mount("edit");
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
});

it.each(["create", "edit"] as const)("denies %s for a Project Leader without effective Team delegation", async (mode) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ code: "TEAM_ACTION_FORBIDDEN", message: "Denied" }, 403));
  mount(mode);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it("closes an open management form after Team delegation is revoked", async () => {
  let allowed = true;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => allowed
    ? response(list())
    : response({ code: "TEAM_ACTION_FORBIDDEN", message: "Denied" }, 403));
  const view = mount();
  await screen.findByText("Engineering");
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("dialog")).toBeVisible();
  allowed = false;
  await act(async () => { await view.client.invalidateQueries({ queryKey: teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1") }); });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create team" })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  allowed = true;
  await act(async () => { await view.client.invalidateQueries({ queryKey: teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1") }); });
  expect(await screen.findByRole("button", { name: "Create team" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each(["page", "status"])("uses the current directory %s read to gate management", async (filter) => {
  let finish!: (result: Response) => void;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => String(url).includes("page=2") || String(url).includes("status=ALL")
    ? new Promise<Response>((resolve) => { finish = resolve; })
    : response(list([team], 1, 2)));
  mount();
  expect(await screen.findByRole("button", { name: "Create team" })).toBeVisible();
  if (filter === "page") fireEvent.click(screen.getByRole("button", { name: "Next" }));
  else fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ALL" } });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Create team" })).not.toBeInTheDocument());
  await act(async () => { finish(response({ code: "TEAM_ACTION_FORBIDDEN" }, 403)); });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Create team" })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([, options]) => options?.method && options.method !== "GET")).toBe(false);
});

it("scopes directory pagination and filters to the current Project", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => response(list([team], String(url).includes("page=2") ? 2 : 1, 2)));
  const view = mount();
  await screen.findByText("Engineering");
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ALL" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain("page=2&pageSize=20&status=ALL"));
  view.rerenderProject("project2");
  await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain("/projects/project2/teams?page=1&pageSize=20&status=ACTIVE"));
  expect(screen.getByLabelText("Status")).toHaveValue("ACTIVE");
});

it.each(["create", "edit"] as const)("does not authorize a %s command from cached Team success while its current read is pending", async (mode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const scopeKey = teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1");
  if (mode === "create") client.setQueryData([...scopeKey, "list", 1, "ACTIVE"], list());
  else client.setQueryData([...scopeKey, "detail", "team1"], { team, etag: '"team:team1:1"' });
  let finish!: (result: Response) => void;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
  mount(mode, client);
  expect(await screen.findByLabelText("Name")).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
  expect(fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  await act(async () => { finish(response({ code: "TEAM_ACTION_FORBIDDEN", message: "Denied" }, 403)); });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
});

it("locks an open draft during Team revalidation and restores it without a refetch loop", async () => {
  let pending = false;
  let finish!: (result: Response) => void;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => pending
    ? new Promise<Response>((resolve) => { finish = resolve; })
    : response(list()));
  const view = mount();
  await screen.findByText("Engineering");
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await fill();
  pending = true;
  await act(async () => { void view.client.invalidateQueries({ queryKey: teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1") }); });
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeDisabled());
  fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
  expect(fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  pending = false;
  await act(async () => { finish(response(list())); });
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
});

it.each(["create", "edit", "list"] as const)("preserves the %s draft but blocks commands after a transient access failure", async (mode) => {
  let failed = false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => failed
    ? response({ code: "UNAVAILABLE" }, 500)
    : response(String(url).includes("teams?") ? list() : team));
  const view = mount(mode);
  if (mode === "list") {
    fireEvent.click(await screen.findByRole("button", { name: "Create team" }));
  }
  const name = await screen.findByLabelText("Name");
  await waitFor(() => expect(name).toBeEnabled());
  fireEvent.change(name, { target: { value: "Unsaved draft" } });
  failed = true;
  await act(async () => { await view.client.invalidateQueries({ queryKey: teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1") }); });
  expect(screen.getByLabelText("Name")).toHaveValue("Unsaved draft");
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeDisabled());
  fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
  expect(fetch.mock.calls.some(([, options]) => options?.method && options.method !== "GET")).toBe(false);
  failed = false;
  await act(async () => { await view.client.invalidateQueries({ queryKey: teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1") }); });
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());
  expect(screen.getByLabelText("Name")).toHaveValue("Unsaved draft");
});

it("allows the user to cancel a disabled draft during access revalidation", async () => {
  let pending = false;
  let finish!: (result: Response) => void;
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => pending
    ? new Promise<Response>((resolve) => { finish = resolve; })
    : response(list()));
  const view = mount();
  fireEvent.click(await screen.findByRole("button", { name: "Create team" }));
  await fill();
  pending = true;
  await act(async () => { void view.client.invalidateQueries({ queryKey: teamKeys({ organizationId: "org1", projectId: "project1" }, "actor1") }); });
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeDisabled());
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  pending = false;
  await act(async () => { finish(response(list())); });
});

it("hides create and archive actions from a reader without Project leadership", async () => {
  authority.isLeader = false;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(list())));
  mount();
  await screen.findByText("Engineering");
  expect(screen.queryByRole("button", { name: "Create team" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actions for Engineering" }));
  expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
});
afterEach(() => vi.restoreAllMocks());

it("lists real HTTP response metadata and uses only supported paging/status query", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      response(list([team], String(url).includes("page=2") ? 2 : 1, 2)),
    );
  mount();
  expect(await screen.findByText("Engineering")).toBeVisible();
  expect(
    screen.queryByText(/Development integration · production release/),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetch.mock.calls.at(-1)?.[0]).toContain("page=2"));
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "ALL" },
  });
  await waitFor(() =>
    expect(fetch.mock.calls.at(-1)?.[0]).toContain(
      "page=1&pageSize=20&status=ALL",
    ),
  );
});
it("shows an empty list without invented metrics", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response(list([], 1, 0)));
  mount();
  expect(await screen.findByText(messages.teamFoundation.empty)).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it.each([401, 403, 404, 503])(
  "hides list data when the backend returns %s",
  async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response(
        {
          code: status === 503 ? "TEAM_POLICY_NOT_READY" : "DENIED",
          message: "private",
          details: {},
          requestId: "r1",
        },
        status,
      ),
    );
    mount();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText("Engineering")).not.toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create team" })).not.toBeInTheDocument();
  },
);
it("retries a failed list read", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new TypeError("Offline"))
    .mockResolvedValueOnce(response(list()));
  mount();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Engineering")).toBeVisible();
});
it("creates from the list in a modal and refreshes the contract-backed directory", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_, options) =>
      options?.method === "POST" ? response(team, 201) : response(list()),
    );
  mount();
  await screen.findByText("Engineering");
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAccessibleName("Create team");
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Research" },
  });
  fireEvent.change(within(dialog).getByLabelText("Code"), {
    target: { value: "RESEARCH" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create team" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(true),
  );
  expect(push).not.toHaveBeenCalled();
});
it("dims the page behind Team dialogs without applying blur", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response(list()));
  mount();
  await screen.findByText("Engineering");
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  const backdrop = document.querySelector(".modal > div");
  expect(backdrop).toHaveClass("bg-gray-900/40");
  expect(backdrop?.className).not.toContain("backdrop-blur");
});
it("opens a row detail dialog, then edits only contract-editable fields", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, options) => {
      if (options?.method === "PATCH")
        return response({ ...team, name: "Research", version: 2 });
      if (String(url).endsWith("/team1")) return response(team);
      return response(list());
    });
  mount();
  await screen.findByText("Engineering");
  fireEvent.click(screen.getByLabelText("Actions for Engineering"));
  expect(
    screen.queryByRole("button", { name: "Edit Engineering" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Archive team" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "View Engineering" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: "Edit team" }),
  );
  const name = await within(dialog).findByLabelText("Name");
  expect(within(dialog).getByLabelText("Code")).toHaveAttribute("readonly");
  fireEvent.change(name, { target: { value: "Research" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === "PATCH"),
    ).toBe(true),
  );
  const patchCall = fetch.mock.calls.find(
    ([, options]) => options?.method === "PATCH",
  )!;
  expect(JSON.parse(String(patchCall[1]?.body))).toEqual({ name: "Research" });
});
it("creates through HTTP and navigates to the returned detail", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(withTeamRead(async () => response(team, 201)));
  mount("create");
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith("/projects/project1/teams/team1"),
  );
  expect(JSON.parse(String(fetch.mock.calls.find(([, options]) => options?.method === "POST")?.[1]?.body))).toEqual({
    name: "Research",
    code: "RESEARCH",
    description: "",
  });
});
it("validates and focuses before any HTTP mutation", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(withTeamRead(async () => response()));
  mount("create");
  await screen.findByLabelText("Name");
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByLabelText("Name")).toHaveFocus();
  expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  expect(fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});
it("clears description explicitly with null without uncontrolled-field warnings", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(withTeamRead(async () => response()));
  mount("create");
  await fill();
  fireEvent.click(screen.getByLabelText("Clear description"));
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(
    JSON.parse(String(fetch.mock.calls.find(([, options]) => options?.method === "POST")?.[1]?.body)).description,
  ).toBeNull();
  expect(consoleError).not.toHaveBeenCalled();
});
it("does not grant ADMIN write access or bypass server denial", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(withTeamRead(async () => response({ code: "TEAM_ACTION_FORBIDDEN", message: "Denied" }, 403)));
  mount("create");
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.teamFoundation.denied,
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
  expect(screen.getByRole("button", { name: "Create team" })).toBeDisabled();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  expect(push).not.toHaveBeenCalled();
});
it("retains the draft after server validation failure", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(withTeamRead(async () => response({ code: "VALIDATION_FAILED", message: "Invalid" }, 422)));
  mount("create");
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.teamFoundation.validation,
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
  expect(screen.getByLabelText("Name")).toBeEnabled();
});
it("prevents duplicate submission while the HTTP mutation is pending", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(withTeamRead(() => new Promise(() => {})));
  mount("create");
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});
it("edits only mutable fields with the server detail ETag", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_, options) =>
      response(options?.method === "PATCH" ? { ...team, version: 2 } : team),
    );
  mount("edit");
  await screen.findByLabelText("Name");
  expect(screen.getByLabelText("Code")).toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "New name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  const call = fetch.mock.calls.find(([, o]) => o?.method === "PATCH")!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({ name: "New name" });
  expect(new Headers(call[1]?.headers).get("if-match")).toBe('"team:team1:1"');
});
it.each(["archive", "restore"] as const)(
  "confirms %s with a reason, without exposing internal reason or delete",
  async (operation) => {
    const archived = operation === "restore";
    const current = {
      ...team,
      status: archived ? "ARCHIVED" : "ACTIVE",
      archivedAt: archived ? team.createdAt : null,
      archivedBy: archived ? "actor1" : null,
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_, options) =>
        response(
          options?.method === "POST"
            ? {
                ...current,
                version: 2,
                status: archived ? "ACTIVE" : "ARCHIVED",
              }
            : current,
        ),
      );
    mount("detail");
    await screen.findByRole("heading", { name: "Engineering" });
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: archived ? "Restore team" : "Archive team",
      }),
    );
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Reviewed" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: archived ? "Confirm restore" : "Confirm archive",
      }),
    );
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url, o]) =>
            String(url).endsWith(`/${operation}`) && o?.method === "POST",
        ),
      ).toBe(true),
    );
    const call = fetch.mock.calls.find(([, o]) => o?.method === "POST")!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ reason: "Reviewed" });
    expect(new Headers(call[1]?.headers).get("if-match")).toBe(
      '"team:team1:1"',
    );
  },
);
it("does not rebase a stale update or silently retry it", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_, options) =>
      options?.method === "PATCH"
        ? response({ code: "PRECONDITION_FAILED", message: "Stale" }, 412)
        : response(),
    );
  mount("edit");
  await screen.findByLabelText("Name");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Changed" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.teamFoundation.stale,
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Changed");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(
    fetch.mock.calls.filter(([, o]) => o?.method === "PATCH"),
  ).toHaveLength(1);
});
it("recovers the same ambiguous command after form unmount within this session", async () => {
  let attempts = 0;
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(withTeamRead(async () => {
      if (attempts++ === 0) throw new TypeError("Response lost");
      return response();
    }));
  const first = mount("create");
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await screen.findByRole("button", { name: "Retry the same request" });
  const original = fetch.mock.calls.find(([, options]) => options?.method === "POST")?.[1];
  first.unmount();
  mount("create", first.client);
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
  expect(screen.getByLabelText("Name")).toBeDisabled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry the same request" })).toBeEnabled());
  fireEvent.click(
    screen.getByRole("button", { name: "Retry the same request" }),
  );
  await waitFor(() => expect(push).toHaveBeenCalled());
  const replay = fetch.mock.calls.filter(([, options]) => options?.method === "POST")[1]?.[1];
  expect(replay?.body).toBe(original?.body);
  expect(
    new Headers(replay?.headers).get("idempotency-key"),
  ).toBe(new Headers(original?.headers).get("idempotency-key"));
});
it("rejects another project's detail instead of exposing its metadata", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    response({ ...team, projectId: "other", name: "Hidden team" }),
  );
  mount("detail");
  await screen.findByRole("alert");
  expect(screen.queryByText("Hidden team")).not.toBeInTheDocument();
});
