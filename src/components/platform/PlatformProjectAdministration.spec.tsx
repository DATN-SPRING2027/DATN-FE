import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import messages from "@/messages/en.json";
import PlatformOperationsDirectory from "./PlatformOperationsDirectory";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const projectId = "651a2b3c4d5e6f7a8b9c0d21";
const organizationId = "651a2b3c4d5e6f7a8b9c0d22";
const userId = "651a2b3c4d5e6f7a8b9c0d23";
const original = {
  id: projectId,
  organization: { id: organizationId, name: "North Star", slug: "north-star" },
  name: "Project Alpha",
  code: "ALPHA",
  visibility: "PRIVATE",
  status: "ACTIVE",
  memberCount: 1,
  leaders: [],
  leadersTruncated: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};
const member = {
  id: "651a2b3c4d5e6f7a8b9c0d24",
  projectId,
  organizationId,
  userId,
  status: "ACTIVE",
  joinedAt: original.createdAt,
  user: {
    id: userId,
    email: "member@example.test",
    fullName: "Project Member",
    accountStatus: "ACTIVE",
  },
};
const page = (data: unknown[], number = 1, totalItems = data.length) => ({
  data,
  pagination: {
    page: number,
    pageSize: 10,
    totalItems,
    totalPages: Math.ceil(totalItems / 10),
  },
});
const clients: QueryClient[] = [];
let current = { ...original };
let mutationError: ApiError | undefined;
let memberError: Error | undefined;
let memberRows: unknown[];
let memberTotal: number;
function setup(
  permissions: PlatformPermission[] = [
    "platform.projects.project.read",
    "platform.projects.project.manage",
  ],
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <PlatformOperationsDirectory
          section="projects"
          permissions={permissions}
          operatorId={userId}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
async function details() {
  fireEvent.click(await screen.findByRole("button", { name: "Details" }));
  await screen.findByRole("button", { name: "View members" });
}
beforeEach(() => {
  current = { ...original };
  mutationError = undefined;
  memberError = undefined;
  memberRows = [member];
  memberTotal = 1;
  vi.spyOn(document, "cookie", "get").mockReturnValue(
    "__Host-csrf=project-csrf",
  );
  vi.mocked(apiClient).mockImplementation(async (path, options) => {
    const url = new URL(path, "http://localhost");
    if (url.pathname.endsWith("/memberships")) {
      if (memberError) throw memberError;
      return page(
        memberRows,
        Number(url.searchParams.get("page")),
        memberTotal,
      ) as never;
    }
    if (options?.method === "PATCH") {
      if (mutationError) throw mutationError;
      const body = JSON.parse(String(options.body));
      current = { ...current, ...body, updatedAt: "2026-10-23T00:00:00.000Z" };
      return current as never;
    }
    if (url.pathname === `/iam/platform/projects/${projectId}`)
      return current as never;
    if (url.pathname === "/iam/platform/projects")
      return page([current]) as never;
    throw new Error(`Unexpected API route: ${path}`);
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.restoreAllMocks();
  vi.mocked(apiClient).mockReset();
});

describe("Platform Project functional controls", () => {
  it("loads members on demand and sends search, status and pagination to the membership API", async () => {
    memberTotal = 11;
    setup();
    await details();
    expect(
      vi
        .mocked(apiClient)
        .mock.calls.some(([path]) => path.includes("/memberships")),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "View members" }));
    expect(await screen.findByText("member@example.test")).toBeInTheDocument();
    const members = screen.getByRole("region", { name: "Project members" });
    fireEvent.click(within(members).getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(
        vi
          .mocked(apiClient)
          .mock.calls.some(([path]) => path.includes("/memberships?page=2")),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText("Search members"), {
      target: { value: " member@example " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByLabelText("Membership status"), {
      target: { value: "INACTIVE" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(apiClient).mock.calls.some(([path]) => {
          const url = new URL(path, "http://localhost");
          return (
            url.pathname.endsWith("/memberships") &&
            url.searchParams.get("page") === "1" &&
            url.searchParams.get("status") === "INACTIVE" &&
            url.searchParams.get("search") === "member@example"
          );
        }),
      ).toBe(true),
    );
  });

  it("saves name, code and visibility with CSRF, CAS and an audit reason, then refreshes metadata", async () => {
    setup();
    await details();
    const name = screen.getByLabelText("Project name");
    const code = screen.getByLabelText("Project code");
    fireEvent.change(name, { target: { value: "Updated Alpha" } });
    fireEvent.change(code, { target: { value: "ALPHA_2" } });
    expect(name).toBeValid();
    expect(code).toBeValid();
    fireEvent.change(screen.getByLabelText("Visibility"), {
      target: { value: "PUBLIC" },
    });
    fireEvent.change(screen.getByLabelText("Audit reason"), {
      target: { value: "SECURITY_INCIDENT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    expect(
      await screen.findByText("Project metadata saved."),
    ).toBeInTheDocument();
    const call = vi
      .mocked(apiClient)
      .mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(call[0]).toBe(`/iam/platform/projects/${projectId}`);
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      name: "Updated Alpha",
      code: "ALPHA_2",
      visibility: "PUBLIC",
      expectedUpdatedAt: original.updatedAt,
      reasonCode: "SECURITY_INCIDENT",
    });
    expect(new Headers(call[1]?.headers).get("X-CSRF-Token")).toBe(
      "project-csrf",
    );
    expect(new Headers(call[1]?.headers).get("X-Request-ID")).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByText("Loaded version: 2026-10-23T00:00:00.000Z"),
      ).toBeInTheDocument(),
    );
  });

  it("allows metadata-only edits without changing visibility and avoids an unchanged mutation", async () => {
    setup();
    await details();
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    expect(
      await screen.findByText("No metadata changes to save."),
    ).toBeInTheDocument();
    expect(
      vi
        .mocked(apiClient)
        .mock.calls.some(([, options]) => options?.method === "PATCH"),
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "New name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    await screen.findByText("Project metadata saved.");
    const [, options] = vi
      .mocked(apiClient)
      .mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(JSON.parse(String(options?.body))).not.toHaveProperty("visibility");
  });

  it("shows members but hides edit controls when manage permission is absent", async () => {
    setup(["platform.projects.project.read"]);
    await details();
    expect(
      screen.queryByRole("button", { name: "Save metadata" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Read-only access/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View members" }));
    await screen.findByText("member@example.test");
  });

  it("does not fetch Project data when read permission is absent", () => {
    setup(["platform.projects.project.manage"]);
    expect(
      screen.queryByRole("button", { name: "Details" }),
    ).not.toBeInTheDocument();
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("blocks resubmission after a stale write until the latest metadata is explicitly reloaded", async () => {
    mutationError = new ApiError(409, "PROJECT_VERSION_STALE", "stale");
    setup();
    await details();
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "My draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The project changed.",
    );
    expect(
      screen.getByRole("button", { name: "Save metadata" }),
    ).toBeDisabled();
    current = {
      ...current,
      name: "Server version",
      updatedAt: "2026-10-23T00:00:00.000Z",
    };
    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest metadata" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Project name")).toHaveValue(
        "Server version",
      ),
    );
    expect(screen.getByRole("button", { name: "Save metadata" })).toBeEnabled();
  });

  it.each([
    [403, "AUTH_CSRF_INVALID", "Security validation failed"],
    [403, "PLATFORM_PERMISSION_DENIED", "does not have permission"],
    [409, "PROJECT_CODE_CONFLICT", "code is already used"],
    [422, "VALIDATION_FAILED", "Review the name"],
    [500, "IAM_PLATFORM_PROJECT_UPDATE_FAILED", "No success was confirmed"],
  ])(
    "retains draft values and reports a failed save (%s, %s)",
    async (status, code, text) => {
      mutationError = new ApiError(Number(status), String(code), "failure");
      setup();
      await details();
      fireEvent.change(screen.getByLabelText("Project name"), {
        target: { value: "Retained draft" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(String(text));
      expect(
        screen.queryByText("Project metadata saved."),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Project name")).toHaveValue(
        "Retained draft",
      );
    },
  );

  it("reports an empty membership result and permits refreshing", async () => {
    memberRows = [];
    memberTotal = 0;
    setup();
    await details();
    fireEvent.click(screen.getByRole("button", { name: "View members" }));
    await screen.findByText("No members match these filters.");
    memberRows = [member];
    memberTotal = 1;
    fireEvent.click(screen.getByRole("button", { name: "Refresh members" }));
    await screen.findByText("member@example.test");
  });

  it.each([new ApiError(403, "FORBIDDEN", "denied"), new Error("network")])(
    "reports member loading errors and allows retry",
    async (error) => {
      memberError = error;
      setup();
      await details();
      fireEvent.click(screen.getByRole("button", { name: "View members" }));
      await screen.findByRole("alert");
      memberError = undefined;
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await screen.findByText("member@example.test");
    },
  );
});
