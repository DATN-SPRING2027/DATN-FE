import {
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
function mount(
  mode: "list" | "create" | "detail" | "edit" = "list",
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const element = (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <TeamsWorkspace
          projectId="project1"
          teamId={mode === "detail" || mode === "edit" ? "team1" : undefined}
          mode={mode}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { client, ...render(element) };
}
function fill() {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Research" },
  });
  fireEvent.change(screen.getByLabelText("Code"), {
    target: { value: "RESEARCH" },
  });
}
beforeEach(() => push.mockReset());
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
    .mockResolvedValue(response(team, 201));
  mount("create");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith("/projects/project1/teams/team1"),
  );
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    name: "Research",
    code: "RESEARCH",
    description: "",
  });
});
it("validates and focuses before any HTTP request", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  mount("create");
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByLabelText("Name")).toHaveFocus();
  expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  expect(fetch).not.toHaveBeenCalled();
});
it("clears description explicitly with null without uncontrolled-field warnings", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
  mount("create");
  fill();
  fireEvent.click(screen.getByLabelText("Clear description"));
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(
    JSON.parse(String(fetch.mock.calls[0][1]?.body)).description,
  ).toBeNull();
  expect(consoleError).not.toHaveBeenCalled();
});
it("does not grant ADMIN write access or bypass server denial", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      response({ code: "TEAM_ACTION_FORBIDDEN", message: "Denied" }, 403),
    );
  mount("create");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.teamFoundation.denied,
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
  expect(screen.getByRole("button", { name: "Create team" })).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
});
it("retains the draft after server validation failure", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    response({ code: "VALIDATION_FAILED", message: "Invalid" }, 422),
  );
  mount("create");
  fill();
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
    .mockImplementation(() => new Promise(() => {}));
  mount("create");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
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
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new TypeError("Response lost"))
    .mockResolvedValueOnce(response());
  const first = mount("create");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await screen.findByRole("button", { name: "Retry the same request" });
  const original = fetch.mock.calls[0][1];
  first.unmount();
  mount("create", first.client);
  expect(screen.getByLabelText("Name")).toHaveValue("Research");
  expect(screen.getByLabelText("Name")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry the same request" }),
  );
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(fetch.mock.calls[1][1]?.body).toBe(original?.body);
  expect(
    new Headers(fetch.mock.calls[1][1]?.headers).get("idempotency-key"),
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
