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
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient, ApiError } from "@/lib/api-client";
import { projectMemberKeys } from "@/lib/queries/projects/useProjectMembers";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import ProjectMembers from "./ProjectMembers";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/icons", () =>
  Object.fromEntries(
    [
      "ChevronDownIcon",
      "TrashBinIcon",
      "TimeIcon",
      "UserCircleIcon",
      "GroupIcon",
      "EyeIcon",
      "FolderIcon",
      "ListIcon",
      "CheckCircleIcon",
      "LockIcon",
      "PlusIcon",
      "ArrowRightIcon",
      "SearchIcon",
    ].map((name) => [name, () => null]),
  ),
);
const api = vi.mocked(apiClient);
const rawMockImplementation = api.mockImplementation.bind(api);
api.mockImplementation = ((
  impl: Parameters<typeof api.mockImplementation>[0],
) =>
  rawMockImplementation(async (endpoint, options) => {
    const result = await impl(endpoint, options);
    if (
      endpoint.endsWith("/leaders") &&
      (!options?.method || options.method === "GET") &&
      result &&
      typeof result === "object" &&
      "pagination" in (result as Record<string, unknown>)
    ) {
      return { data: [] };
    }
    return result;
  })) as typeof api.mockImplementation;
let queryClient: QueryClient;
const member = {
  id: "membership-1",
  organizationId: "org-1",
  projectId: "project-1",
  userId: "user-1",
  status: "ACTIVE",
  joinedAt: "2026-10-01T00:00:00Z",
};
const user = { id: "actor", organizationId: "org-1", roles: ["MEMBER"] };
const page = (data: unknown[] = [member], current = 1, total = 1) => ({
  data,
  pagination: {
    page: current,
    pageSize: 20,
    totalItems: data.length,
    totalPages: total,
  },
});
function mount(projectId = "project-1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient = client;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return {
    client,
    ...render(<ProjectMembers projectId={projectId} />, { wrapper: Wrapper }),
  };
}
function respond(listResponse: unknown = page()) {
  api.mockImplementation(async (endpoint) =>
    endpoint === "/auth/me" ? user : listResponse,
  );
}
async function findMember(id: string) {
  const table = await screen.findByRole("table");
  return (await within(table).findAllByText(id))[0];
}
function addFormSubmitButton() {
  const form = screen.getByRole("form", { name: "Add member" });
  return within(form)
    .getAllByRole("button")
    .find((button) => button.getAttribute("type") === "submit")!;
}
async function selectCandidate(id = "user-2") {
  if (!screen.queryByRole("form", { name: "Add member" })) {
    fireEvent.click(
      screen.getByRole("button", { name: "Open Add member form" }),
    );
  }
  const input = screen.getByLabelText(/Search by email/i);
  const email = id.trim() ? `${id}@example.test` : id;
  const selectedCandidate = {
    userId: id,
    email,
    fullName: id,
    avatarUrl: null,
    organizationMembershipStatus: "ACTIVE" as const,
    isProjectMember: false,
  };
  if (email.trim()) {
    queryClient.setQueryData(
      projectMemberKeys.candidates("org-1", "project-1", email),
      [selectedCandidate],
    );
  }
  fireEvent.change(input, { target: { value: email } });
  if (email.trim()) {
    fireEvent.click(await screen.findByText(email));
  }
}

async function submitAdd(id = "user-2") {
  await selectCandidate(id);
  fireEvent.submit(screen.getByRole("form", { name: "Add member" }));
}
beforeEach(() => {
  api.mockReset();
});
it("lists the documented projection without role or appointment controls", async () => {
  respond();
  mount();
  expect(await findMember("user-1")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Open Add member form" }),
  ).toBeEnabled();
  expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  expect(api).toHaveBeenCalledWith(
    "/iam/projects/project-1/memberships?page=1&pageSize=20&status=ACTIVE",
    expect.any(Object),
  );
  expect(
    screen.queryByRole("button", { name: /role|leader|appoint/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Project details" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Check access again" }),
  ).not.toBeInTheDocument();
});
it("adds an ordinary member with only userId and refreshes the list", async () => {
  let added = false;
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "POST") {
      added = true;
      return { ...member, id: "membership-2", userId: "user-2" };
    }
    return page(
      added
        ? [member, { ...member, id: "membership-2", userId: "user-2" }]
        : [member],
    );
  });
  mount();
  await findMember("user-1");
  await submitAdd();
  expect(await screen.findByText("Member added.")).toBeVisible();
  expect(await findMember("user-2")).toBeVisible();
  expect(api).toHaveBeenCalledWith(
    "/iam/projects/project-1/memberships",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "user-2" }),
    }),
  );
});
it("requires confirmation, removes by membership ID and handles 204", async () => {
  let removed = false;
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "DELETE") {
      removed = true;
      return undefined;
    }
    return page(removed ? [] : [member]);
  });
  mount();
  await findMember("user-1");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(
    api.mock.calls.some(([, options]) => options?.method === "DELETE"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.queryByRole("button", { name: "Confirm removal" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(
    await screen.findByText("Member removed from active Project access."),
  ).toBeVisible();
  expect(
    await screen.findByText("No members match this filter."),
  ).toBeVisible();
  expect(api).toHaveBeenCalledWith(
    "/iam/projects/project-1/memberships/membership-1",
    expect.objectContaining({ method: "DELETE" }),
  );
});
it("denied listing is not empty and does not infer denial of add", async () => {
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return { ...user, roles: ["ADMIN"] };
    throw new ApiError(403, "FORBIDDEN", "Denied");
  });
  mount();
  expect(
    await screen.findByText(
      "You do not have permission to view Project members.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByText("No members match this filter."),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open Add member form" }),
  ).toBeEnabled();
});
it("denied add disables only add until access is checked again", async () => {
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "POST")
      throw new ApiError(403, "FORBIDDEN", "Denied");
    return page();
  });
  mount();
  await findMember("user-1");
  await submitAdd();
  expect(
    await screen.findByText(
      "You do not have permission to add Project members.",
    ),
  ).toBeVisible();
  expect(addFormSubmitButton()).toBeDisabled();
  expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Check access again" }));
  await waitFor(() => expect(addFormSubmitButton()).toBeEnabled());
});
it("denied remove disables remove and keeps the member visible", async () => {
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "DELETE")
      throw new ApiError(403, "FORBIDDEN", "Denied");
    return page();
  });
  mount();
  await findMember("user-1");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(
    await screen.findByText(
      "You do not have permission to remove Project members.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  expect(screen.getAllByText("user-1")[0]).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Open Add member form" }),
  ).toBeEnabled();
});
it.each([
  [
    404,
    "NOT_FOUND",
    "The requested Project or membership is unavailable in this scope.",
  ],
  [422, "VALIDATION_FAILED", "Check the input and try again."],
  [
    409,
    "PROJECT_LEADER_MUST_BE_REVOKED_FIRST",
    "This member has a Leader appointment. An authorized Organization Manager must revoke it before removal.",
  ],
  [429, "RATE_LIMITED", "Too many requests. Wait before trying again."],
  [401, "UNAUTHORIZED", "Your session has expired. Sign in again."],
  [503, "UNAVAILABLE", "The server is unavailable. Try again later."],
  [
    0,
    "NETWORK",
    "The request could not be completed. Check your connection and refresh the list before repeating a change.",
  ],
])(
  "handles %s errors for list, add and remove without claiming success",
  async (status, code, text) => {
    const error = status
      ? new ApiError(status, code, "Untrusted message")
      : new TypeError("Failed to fetch");
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return user;
      throw error;
    });
    const view = mount();
    const listText =
      code === "PROJECT_LEADER_MUST_BE_REVOKED_FIRST"
        ? "The change conflicts with the current membership state. Refresh the list before trying again."
        : text;
    expect(await screen.findByText(listText)).toBeVisible();
    expect(screen.queryByText("Untrusted message")).not.toBeInTheDocument();
    view.unmount();
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (options?.method) throw error;
      return page();
    });
    mount();
    await findMember("user-1");
    await submitAdd();
    expect(await screen.findByText(listText)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(
      await within(
        screen.getByRole("region", { name: "Remove member" }),
      ).findByText(text),
    ).toBeVisible();
    expect(screen.queryByText("Member added.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Member removed from active Project access."),
    ).not.toBeInTheDocument();
  },
);
it("rejects empty input locally and accepts opaque identifiers", async () => {
  respond();
  mount();
  await findMember("user-1");
  await submitAdd("   ");
  expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
  expect(api.mock.calls.some(([, options]) => options?.method === "POST")).toBe(
    false,
  );
});
it("does not show membership records from a different scope", async () => {
  respond(page([{ ...member, projectId: "other-project" }]));
  mount();
  expect(
    await screen.findByText(
      "The server returned an unexpected response. Refresh and try again.",
    ),
  ).toBeVisible();
  expect(screen.queryByText("user-1")).not.toBeInTheDocument();
});
it("clears cached rows after a subsequent denied list", async () => {
  let denied = false;
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return user;
    if (denied) throw new ApiError(403, "FORBIDDEN", "Denied");
    return page();
  });
  const { client } = mount();
  await findMember("user-1");
  denied = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["project-members"] });
  });
  expect(
    await screen.findByText(
      "You do not have permission to view Project members.",
    ),
  ).toBeVisible();
  expect(screen.queryByText("user-1")).not.toBeInTheDocument();
});
it("keeps pagination and status filtering in the documented contract", async () => {
  api.mockImplementation(async (endpoint) =>
    endpoint === "/auth/me"
      ? user
      : page([member], endpoint.includes("page=2") ? 2 : 1, 2),
  );
  mount();
  await findMember("user-1");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining("page=2&pageSize=20&status=ACTIVE"),
      expect.any(Object),
    ),
  );
  await findMember("user-1");
  fireEvent.change(
    screen.getByRole("combobox", { name: "Membership status" }),
    {
      target: { value: "INACTIVE" },
    },
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining("page=1&pageSize=20&status=INACTIVE"),
      expect.any(Object),
    ),
  );
});
it("prevents duplicate add requests while the server is deciding", async () => {
  let finish: ((value: unknown) => void) | undefined;
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "POST")
      return new Promise((resolve) => {
        finish = resolve;
      });
    return page();
  });
  mount();
  await findMember("user-1");
  await submitAdd();
  await waitFor(() =>
    expect(addFormSubmitButton()).toHaveTextContent("Adding…"),
  );
  expect(addFormSubmitButton()).toBeDisabled();
  fireEvent.submit(screen.getByRole("form", { name: "Add member" }));
  expect(
    api.mock.calls.filter(([, options]) => options?.method === "POST"),
  ).toHaveLength(1);
  finish?.({ ...member, id: "membership-2", userId: "user-2" });
  expect(await screen.findByText("Member added.")).toBeVisible();
});
it("prevents duplicate remove requests while waiting for 204", async () => {
  let finish: (() => void) | undefined;
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "DELETE")
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    return page();
  });
  mount();
  await findMember("user-1");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(
    await screen.findByRole("button", { name: "Removing…" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Removing…" }));
  expect(
    api.mock.calls.filter(([, options]) => options?.method === "DELETE"),
  ).toHaveLength(1);
  finish?.();
  expect(
    await screen.findByText("Member removed from active Project access."),
  ).toBeVisible();
});
it("resets form, confirmation and denied action when Project scope changes", async () => {
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "POST")
      throw new ApiError(403, "FORBIDDEN", "Denied");
    return endpoint.includes("project-2")
      ? page([
          {
            ...member,
            id: "membership-2",
            projectId: "project-2",
            userId: "user-2",
          },
        ])
      : page();
  });
  const view = mount();
  await findMember("user-1");
  await submitAdd();
  expect(
    await screen.findByText(
      "You do not have permission to add Project members.",
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  view.rerender(<ProjectMembers projectId="project-2" />);
  expect(await findMember("user-2")).toBeVisible();
  expect(screen.queryByText("user-1")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Remove member" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("form", { name: "Add member" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open Add member form" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Open Add member form" }));
  expect(screen.getByLabelText(/Search by email/i)).toHaveValue("");
});
it("resets denied action when the trusted Organization changes", async () => {
  let organizationId = "org-1";
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return { ...user, organizationId };
    if (options?.method === "POST")
      throw new ApiError(403, "FORBIDDEN", "Denied");
    return page([
      {
        ...member,
        organizationId,
        userId: organizationId === "org-1" ? "user-1" : "user-2",
      },
    ]);
  });
  const view = mount();
  await findMember("user-1");
  await submitAdd();
  expect(
    await screen.findByText(
      "You do not have permission to add Project members.",
    ),
  ).toBeVisible();
  organizationId = "org-2";
  await act(async () => {
    view.client.setQueryData(authKeys.currentUser(), {
      ...user,
      organizationId,
    });
  });
  view.rerender(<ProjectMembers projectId="project-1" />);
  expect(await findMember("user-2")).toBeVisible();
  expect(screen.queryByText("user-1")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open Add member form" }),
  ).toBeEnabled();
});
it("does not offer removal for inactive memberships", async () => {
  respond(page([{ ...member, status: "INACTIVE" }]));
  mount();
  expect(await findMember("user-1")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Remove" }),
  ).not.toBeInTheDocument();
});
it("does not send any unsupported operations", async () => {
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return user;
    if (endpoint === "/iam/projects/project-1/leaders")
      throw new ApiError(403, "FORBIDDEN", "Forbidden");
    return page();
  });
  mount();
  await findMember("user-1");
  const requests = api.mock.calls.filter(
    ([endpoint]) => endpoint !== "/auth/me",
  );
  expect(
    requests.every(
      ([endpoint, options]) =>
        (endpoint.startsWith("/iam/projects/project-1/memberships") ||
          endpoint ===
            "/iam/projects/project-1/member-candidates?email=user-2%40example.test" ||
          endpoint === "/iam/projects/project-1/leaders") &&
        ["GET", "POST", "DELETE", "PUT"].includes(options?.method ?? "GET"),
    ),
  ).toBe(true);
  expect(
    requests.some(
      ([endpoint, options]) =>
        (endpoint.includes("leaders") &&
          (options?.method ?? "GET") !== "GET") ||
        options?.method === "PATCH" ||
        (options?.method === "PUT" && !endpoint.endsWith("/leaders")),
    ),
  ).toBe(false);
});
it("retains input after a failed add following a previous success", async () => {
  let attempt = 0;
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "POST") {
      if (++attempt === 1)
        return { ...member, id: "member-2", userId: "user-2" };
      throw new TypeError("Offline");
    }
    return page();
  });
  mount();
  await findMember("user-1");
  await submitAdd();
  expect(await screen.findByText("Member added.")).toBeVisible();
  await submitAdd("user-3");
  expect(
    await screen.findByText(
      "The request could not be completed. Check your connection and refresh the list before repeating a change.",
    ),
  ).toBeVisible();
  expect(screen.getByLabelText(/Search by email/i)).toHaveValue(
    "user-3@example.test",
  );
});
it("rejects invalid Project context without leaving a loading screen", async () => {
  respond();
  mount(" ");
  expect(
    await screen.findByText("Check the input and try again."),
  ).toBeVisible();
  expect(api.mock.calls.every(([endpoint]) => endpoint === "/auth/me")).toBe(
    true,
  );
});
it("checks server validation rather than assuming opaque user IDs are ObjectIds", async () => {
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "POST")
      throw new ApiError(422, "VALIDATION_FAILED", "Invalid storage ID");
    return page();
  });
  mount();
  await findMember("user-1");
  await submitAdd("opaque/id");
  expect(
    await screen.findByText("Check the input and try again."),
  ).toBeVisible();
  expect(api).toHaveBeenCalledWith(
    "/iam/projects/project-1/memberships",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "opaque/id" }),
    }),
  );
  expect(addFormSubmitButton()).toBeEnabled();
});
it("rejects malformed backend status without rendering a member row", async () => {
  respond(page([{ ...member, status: ["ACTIVE"] }]));
  mount();
  expect(
    await screen.findByText(
      "The server returned an unexpected response. Refresh and try again.",
    ),
  ).toBeVisible();
  expect(screen.queryByText("user-1")).not.toBeInTheDocument();
});
it("handles archived Project access denial without exposing a member list", async () => {
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return { ...user, roles: ["TEAM_LEADER"] };
    throw new ApiError(403, "FORBIDDEN", "Archived Project");
  });
  mount();
  await screen.findByText(
    "You do not have permission to view Project members.",
  );
  await submitAdd();
  expect(
    await screen.findByText(
      "You do not have permission to add Project members.",
    ),
  ).toBeVisible();
  expect(addFormSubmitButton()).toBeDisabled();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it("selects a member from the table without requesting new backend operations", async () => {
  respond(
    page([
      member,
      { ...member, id: "membership-2", userId: "user-2", status: "INACTIVE" },
    ]),
  );
  mount();
  await screen.findByRole("button", { name: "View member user-2" });
  const requestCount = api.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "View member user-2" }));
  const details = screen.getByRole("region", { name: "Membership details" });
  expect(within(details).getAllByText("user-2")[0]).toBeVisible();
  expect(
    screen.getByRole("button", { name: "View member user-2" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    within(
      screen.getByRole("button", { name: "View member user-2" }).closest("tr")!,
    ).queryByRole("button", { name: "Remove" }),
  ).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(requestCount);
});
it("searches only loaded User IDs without adding a backend search operation", async () => {
  respond(page([member, { ...member, id: "membership-2", userId: "user-2" }]));
  mount();
  await screen.findByRole("button", { name: "View member user-2" });
  const requests = api.mock.calls.length;
  fireEvent.change(screen.getByLabelText("Search current page"), {
    target: { value: "user-2" },
  });
  expect(
    screen.queryByRole("button", { name: "View member user-1" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "View member user-2" }),
  ).toBeVisible();
  expect(api).toHaveBeenCalledTimes(requests);
});
it("opens an accessible removal dialog and cancels with Escape without deleting", async () => {
  respond();
  mount();
  await findMember("user-1");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.getByRole("dialog", { name: "Remove member" })).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    api.mock.calls.some(([, options]) => options?.method === "DELETE"),
  ).toBe(false);
});

it.each(["add", "remove"] as const)(
  "shows a corner notification outside the member panel for four seconds after %s",
  async (action) => {
    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") return user;
      if (options?.method === "POST")
        return { ...member, id: "membership-2", userId: "user-2" };
      if (options?.method === "DELETE") return undefined;
      return page();
    });
    const view = mount();
    await findMember("user-1");
    if (action === "add") {
      await selectCandidate();
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    }
    vi.useFakeTimers();
    try {
      await act(async () => {
        if (action === "add")
          fireEvent.submit(screen.getByRole("form", { name: "Add member" }));
        else
          fireEvent.click(
            screen.getByRole("button", { name: "Confirm removal" }),
          );
        await vi.advanceTimersByTimeAsync(0);
      });
      const text =
        action === "add"
          ? "Member added."
          : "Member removed from active Project access.";
      const notification = screen.getByText(text).closest('[role="status"]');
      expect(notification).toBeVisible();
      expect(notification?.parentElement).toBe(document.body);
      expect(view.container).not.toContainElement(notification as HTMLElement);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByText(text)).toBeVisible();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  },
);

it("removes the intended table row by membership ID and offers only supported status filters", async () => {
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (options?.method === "DELETE") return undefined;
    return page([member, { ...member, id: "membership-2", userId: "user-2" }]);
  });
  mount();
  const row = (
    await screen.findByRole("button", { name: "View member user-2" })
  ).closest("tr")!;
  const status = screen.getByRole("combobox", { name: "Membership status" });
  expect(
    within(status)
      .getAllByRole("option")
      .map((option) => option.getAttribute("value")),
  ).toEqual(["ACTIVE", "INACTIVE"]);
  fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("user-2");
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  await screen.findByText("Member removed from active Project access.");
  expect(api).toHaveBeenCalledWith(
    "/iam/projects/project-1/memberships/membership-2",
    expect.objectContaining({ method: "DELETE" }),
  );
});

it("searches candidates by email within the Organization and adds selected candidate", async () => {
  const candidate = {
    userId: "candidate-user-1",
    email: "colleague@datn-dev.example.test",
    fullName: "Colleague Name",
    avatarUrl: null,
    organizationMembershipStatus: "ACTIVE",
    isProjectMember: false,
  };
  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return user;
    if (endpoint.includes("/member-candidates")) {
      return { data: [candidate] };
    }
    if (options?.method === "POST") {
      return {
        ...member,
        id: "membership-new",
        userId: "candidate-user-1",
        user: {
          id: "candidate-user-1",
          email: "colleague@datn-dev.example.test",
          fullName: "Colleague Name",
        },
      };
    }
    return page([member]);
  });

  mount();
  await findMember("user-1");

  fireEvent.click(screen.getByRole("button", { name: "Open Add member form" }));
  const searchInput = screen.getByLabelText(/Search by email/i);
  fireEvent.change(searchInput, {
    target: { value: "colleague@datn-dev.example.test" },
  });

  expect(await screen.findByText("Colleague Name")).toBeVisible();
  expect(screen.getByText("colleague@datn-dev.example.test")).toBeVisible();
  expect(screen.getAllByText("Active").length).toBeGreaterThan(0);

  const addCandidateButtons = screen.getAllByRole("button", {
    name: "Add member",
  });
  const addCandidateButton =
    addCandidateButtons[addCandidateButtons.length - 1];
  expect(addCandidateButton).toBeEnabled();

  fireEvent.click(addCandidateButton);

  await waitFor(() => {
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1/memberships",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "candidate-user-1" }),
      }),
    );
  });
  expect(await screen.findByText("Member added.")).toBeVisible();
});

it("shows already in project and disables addition when candidate is already a member", async () => {
  const existingCandidate = {
    userId: "user-1",
    email: "user1@datn-dev.example.test",
    fullName: "User One",
    avatarUrl: null,
    organizationMembershipStatus: "ACTIVE",
    isProjectMember: true,
  };
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return user;
    if (endpoint.includes("/member-candidates")) {
      return { data: [existingCandidate] };
    }
    return page([member]);
  });

  mount();
  await findMember("user-1");

  fireEvent.click(screen.getByRole("button", { name: "Open Add member form" }));
  const searchInput = screen.getByLabelText(/Search by email/i);
  fireEvent.change(searchInput, {
    target: { value: "user1@datn-dev.example.test" },
  });

  expect(await screen.findByText("Already in project")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
});

it("shows empty state when no organization member candidate matches the search", async () => {
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return user;
    if (endpoint.includes("/member-candidates")) {
      return { data: [] };
    }
    return page([member]);
  });

  mount();
  await findMember("user-1");

  fireEvent.click(screen.getByRole("button", { name: "Open Add member form" }));
  const searchInput = screen.getByLabelText(/Search by email/i);
  fireEvent.change(searchInput, {
    target: { value: "nonexistent@datn-dev.example.test" },
  });

  expect(
    await screen.findByText("No active organization member found."),
  ).toBeVisible();
});


it("prevents revoking or removing the sole Project Leader until a second Leader is appointed", async () => {
  let activeLeaders = [
    {
      userId: "user-1",
      fullName: "Leader One",
      email: "user1@datn-dev.example.test",
      avatarUrl: null,
      role: "TEAM_LEADER" as const,
      status: "ACTIVE" as const,
    },
  ];
  const secondMember = {
    ...member,
    id: "membership-2",
    userId: "user-2",
    user: {
      id: "user-2",
      email: "user2@datn-dev.example.test",
      fullName: "Member Two",
    },
  };

  api.mockImplementation(async (endpoint, options) => {
    if (endpoint === "/auth/me") return { ...user, roles: ["ADMIN"] };
    if (endpoint === "/iam/projects/project-1/leaders") {
      if (options?.method === "POST") {
        activeLeaders = [
          ...activeLeaders,
          {
            userId: "user-2",
            fullName: "Member Two",
            email: "user2@datn-dev.example.test",
            avatarUrl: null,
            role: "TEAM_LEADER",
            status: "ACTIVE",
          },
        ];
        return undefined;
      }
      return { data: activeLeaders };
    }
    if (
      endpoint === "/iam/projects/project-1/leaders/user-1" &&
      options?.method === "DELETE"
    ) {
      activeLeaders = activeLeaders.filter((item) => item.userId !== "user-1");
      return undefined;
    }
    return page([member, secondMember]);
  });

  mount();
  const row1 = (
    await screen.findByRole("button", { name: "View member user-1" })
  ).closest("tr")!;
  const row2 = (
    await screen.findByRole("button", { name: "View member Member Two" })
  ).closest("tr")!;

  const revokeBtn1 = await within(row1).findByRole("button", {
    name: "Revoke Leader",
  });
  const removeBtn1 = within(row1).getByRole("button", { name: "Remove" });
  const appointBtn2 = within(row2).getByRole("button", {
    name: "Set as Leader",
  });

  expect(revokeBtn1).toBeDisabled();
  expect(revokeBtn1).toHaveAttribute(
    "title",
    "Cannot revoke the only Project Leader. Appoint another member as Leader first.",
  );
  expect(removeBtn1).toBeDisabled();
  expect(appointBtn2).toBeEnabled();

  fireEvent.click(appointBtn2);

  await waitFor(() => {
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1/leaders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "user-2" }),
      }),
    );
  });

  await waitFor(() => {
    expect(
      within(row1).getByRole("button", { name: "Revoke Leader" }),
    ).toBeEnabled();
  });

  fireEvent.click(within(row1).getByRole("button", { name: "Revoke Leader" }));

  await waitFor(() => {
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1/leaders/user-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});


it("shows unverified role state and locks Remove when the Leader list returns 403 or fails", async () => {
  api.mockImplementation(async (endpoint) => {
    if (endpoint === "/auth/me") return { ...user, roles: ["TEAM_LEADER"] };
    if (endpoint === "/iam/projects/project-1/leaders") {
      throw new ApiError(403, "FORBIDDEN", "Forbidden");
    }
    return page([member]);
  });

  mount();
  await findMember("user-1");

  expect(
    await screen.findByText(
      "Leader roles could not be verified for this view. Member removal is locked until Leader status is confirmed.",
    ),
  ).toBeVisible();
  expect(screen.getByText("Role unverified")).toBeVisible();

  const removeButton = screen.getByRole("button", { name: "Remove" });
  expect(removeButton).toBeDisabled();
  expect(removeButton).toHaveAttribute(
    "title",
    "Member removal is locked until Leader roles can be verified.",
  );

  fireEvent.click(screen.getByRole("button", { name: "View member user-1" }));
  const details = screen.getByRole("region", { name: "Membership details" });
  expect(within(details).getByText("Role unverified · Project scope")).toBeVisible();
});
