import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import { projectLeaderKeys } from "@/lib/queries/projects/useProjectLeaders";
import messages from "@/messages/en.json";
import ProjectLeaders from "./ProjectLeaders";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

const api = vi.mocked(apiClient);
const leader = {
  userId: "leader-1",
  fullName: "Current Leader",
  email: "current@example.test",
  avatarUrl: null,
  role: "TEAM_LEADER",
  status: "ACTIVE",
} as const;
const candidate = {
  userId: "member-2",
  fullName: "Eligible Member",
  email: "eligible@example.test",
  avatarUrl: null,
  role: "MEMBER",
  status: "ACTIVE",
} as const;

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectLeaders organizationId="org-1" projectId="project-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (path) => {
    if (path.endsWith("/leaders")) return { data: [leader] };
    if (path.includes("/leader-candidates")) return { data: [candidate] };
    return undefined;
  });
});

it("shows safe leader identity fields without rendering account identifiers", async () => {
  mount();
  expect(await screen.findByText("Current Leader")).toBeVisible();
  expect(screen.getByText("current@example.test")).toBeVisible();
  expect(screen.queryByText("leader-1")).not.toBeInTheDocument();
});

it("searches by email and appoints a selected eligible Project member", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Add Leader" }));
  fireEvent.change(screen.getByLabelText(/search eligible project members/i), {
    target: { value: "eligible@example.test" },
  });
  const candidateButton = await screen.findByRole("button", {
    name: /eligible member/i,
  });
  fireEvent.click(candidateButton);
  fireEvent.click(screen.getByRole("button", { name: "Appoint Leader" }));
  await waitFor(() => {
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1/leaders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "member-2" }),
      }),
    );
  });
});

it("hides cached candidates and blocks appointment while a candidate refetch is pending or failed", async () => {
  const client = mount();
  fireEvent.click(await screen.findByRole("button", { name: "Add Leader" }));
  fireEvent.change(screen.getByLabelText(/search eligible project members/i), {
    target: { value: "eligible@example.test" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /eligible member/i }),
  );
  const appointButton = screen.getByRole("button", { name: "Appoint Leader" });
  expect(appointButton).toBeEnabled();

  let rejectRefetch!: (error: Error) => void;
  api.mockImplementation(async (path) => {
    if (path.endsWith("/leaders")) return { data: [leader] };
    if (path.includes("/leader-candidates"))
      return new Promise((_, reject) => {
        rejectRefetch = reject;
      });
    return undefined;
  });
  const refetch = client.refetchQueries({
    queryKey: projectLeaderKeys.candidates(
      "org-1",
      "project-1",
      "eligible@example.test",
    ),
    type: "active",
  });

  await waitFor(() => expect(rejectRefetch).toBeTypeOf("function"));
  expect(await screen.findByRole("status")).toHaveTextContent(/searching/i);
  expect(
    screen.queryByRole("button", { name: /eligible member/i }),
  ).not.toBeInTheDocument();
  expect(appointButton).toBeDisabled();

  rejectRefetch(new Error("Network failure"));
  await refetch;

  expect(await screen.findByRole("alert")).toHaveTextContent(
    /could not be searched/i,
  );
  expect(
    screen.queryByRole("button", { name: /eligible member/i }),
  ).not.toBeInTheDocument();
  expect(appointButton).toBeDisabled();
  expect(api.mock.calls.some(([, options]) => options?.method === "POST")).toBe(
    false,
  );
});

it("replaces a selected Leader with a member in one PUT request", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
  fireEvent.change(screen.getByLabelText(/search eligible project members/i), {
    target: { value: "eligible@example.test" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /eligible member/i }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm replacement" }));
  await waitFor(() => {
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1/leaders",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          previousUserId: "leader-1",
          nextUserId: "member-2",
        }),
      }),
    );
  });
});

it("requires explicit confirmation before revoking a Leader", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  expect(screen.getByRole("alertdialog")).toBeVisible();
  expect(
    api.mock.calls.some(([, options]) => options?.method === "DELETE"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Revoke Leader" }));
  await waitFor(() => {
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1/leaders/leader-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

it("does not expose Leader data or actions to a non-Admin", async () => {
  api.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Forbidden"));
  mount();
  expect(await screen.findByText(/only an organization manager/i)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Add Leader" }),
  ).not.toBeInTheDocument();
});
