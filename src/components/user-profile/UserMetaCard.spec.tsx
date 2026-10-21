import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import type { DirectoryUser } from "@/lib/queries/users/useUsers";
import UserMetaCard from "./UserMetaCard";

vi.mock("@/lib/api-client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

const userA: CurrentUserResponse = {
  id: "user-a",
  email: "alex@example.test",
  name: "Alex Example",
  organizationId: "org-a",
  roles: ["ADMIN"],
};

const directoryUserA: DirectoryUser = {
  id: "user-a",
  email: "alex@example.test",
  fullName: "Alex Example",
  avatarUrl: "https://cdn.example.test/alex.png",
  status: "ACTIVE",
  roleCodes: ["ADMIN"],
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderProfile(queryClient = createQueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <UserMetaCard />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  return queryClient;
}

function mockProfileApi() {
  let currentUser: CurrentUserResponse = userA;
  const profiles = new Map<string, DirectoryUser>([[userA.id, directoryUserA]]);

  mockedApiClient.mockImplementation(async (endpoint, options) => {
    if (typeof endpoint !== "string") {
      throw new Error(`Unexpected profile request endpoint: ${String(endpoint)}`);
    }

    if (endpoint === "/auth/me") return currentUser as never;

    if (endpoint.startsWith("/iam/users/") && options?.method === "PATCH") {
      const userId = decodeURIComponent(endpoint.split("/").at(-1) ?? "");
      const changes = JSON.parse(String(options.body)) as Partial<DirectoryUser>;
      const updated = { ...profiles.get(userId)!, ...changes };
      profiles.set(userId, updated);
      if (currentUser.id === userId && typeof changes.fullName === "string") {
        currentUser = { ...currentUser, name: changes.fullName };
      }
      return updated as never;
    }

    if (endpoint.startsWith("/iam/users/")) {
      const userId = decodeURIComponent(endpoint.split("/").at(-1) ?? "");
      const profile = profiles.get(userId);
      if (profile) return profile as never;
    }

    throw new Error(`Unexpected profile request: ${endpoint}`);
  });

  return {
    setCurrentUser(next: CurrentUserResponse, profile: DirectoryUser) {
      currentUser = next;
      profiles.set(next.id, profile);
    },
  };
}

describe("UserMetaCard", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("loads the authenticated profile and renders only supported, real fields", async () => {
    mockProfileApi();
    renderProfile();

    expect(
      await screen.findByText("Alex Example", { selector: "p" }),
    ).toBeVisible();
    expect(await screen.findByAltText("Profile picture for Alex Example")).toBeVisible();
    expect(screen.getByText("alex@example.test")).toBeVisible();
    expect(screen.getAllByText("Manager")).toHaveLength(2);
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(document.querySelector('img[src="https://cdn.example.test/alex.png"]')).not.toBeNull();
    expect(mockedApiClient).toHaveBeenCalledWith("/auth/me");
    expect(mockedApiClient).toHaveBeenCalledWith("/iam/users/user-a");

    expect(screen.queryByText(/Musharof|Chowdhury|randomuser@pimjo\.com|Arizona|Phoenix|TAX ID|Team Manager/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /facebook|linkedin|instagram|x\.com/i })).toBeNull();
  });

  it("shows loading and error states without falling back to demo profile data", async () => {
    let rejectIdentity!: (reason: Error) => void;
    mockedApiClient.mockImplementation(
      () => new Promise((_, reject) => { rejectIdentity = reject; }),
    );
    renderProfile();

    expect(screen.getByText("Loading profile…")).toBeVisible();
    await act(async () => rejectIdentity(new Error("session unavailable")));

    expect(await screen.findByText("Unable to load profile.")).toBeVisible();
    expect(screen.queryByText(/Musharof|randomuser@pimjo\.com|Arizona|Phoenix/i)).toBeNull();
  });

  it("persists only the supported self-profile fields and refreshes current identity", async () => {
    mockProfileApi();
    renderProfile();

    await screen.findByText("Alex Example", { selector: "p" });
    const editButton = screen.getByRole("button", { name: "Edit profile" });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Alex Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Alex Updated", { selector: "p" })).toBeVisible();
    await waitFor(() =>
      expect(mockedApiClient).toHaveBeenCalledWith("/iam/users/user-a", {
        method: "PATCH",
        body: JSON.stringify({ fullName: "Alex Updated" }),
      }),
    );
  });

  it.each([
    "javascript:alert(1)",
    "https://user:secret@cdn.example.test/avatar.png",
  ])("rejects unsafe avatar URL %s before sending an update", async (unsafeAvatarUrl) => {
    mockProfileApi();
    renderProfile();

    await screen.findByAltText("Profile picture for Alex Example");
    const editButton = screen.getByRole("button", { name: "Edit profile" });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    fireEvent.change(screen.getByLabelText("Avatar URL"), {
      target: { value: unsafeAvatarUrl },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Use a secure HTTPS image URL.")).toBeVisible();
    expect(
      mockedApiClient.mock.calls.some(
        ([endpoint, options]) => endpoint === "/iam/users/user-a" && options?.method === "PATCH",
      ),
    ).toBe(false);
  });

  it("uses account-session identity without querying or editing organization profiles", async () => {
    const accountUser: CurrentUserResponse = {
      id: "account-user",
      email: "account@example.test",
      name: "Account User",
      context: "ACCOUNT",
    };
    mockedApiClient.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") return accountUser as never;
      throw new Error(`Unexpected account profile request: ${endpoint}`);
    });
    renderProfile();

    expect(await screen.findByText("Account User", { selector: "p" })).toBeVisible();
    expect(screen.getByText("account@example.test")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeDisabled();
    expect(mockedApiClient).toHaveBeenCalledTimes(1);
  });

  it("switches to the new authenticated user's query instead of retaining the prior profile", async () => {
    const api = mockProfileApi();
    const queryClient = renderProfile();

    await screen.findByText("Alex Example", { selector: "p" });
    const userB: CurrentUserResponse = {
      id: "user-b",
      email: "blair@example.test",
      name: "Blair Example",
      organizationId: "org-b",
      roles: ["MEMBER"],
    };
    const directoryUserB: DirectoryUser = {
      ...directoryUserA,
      id: "user-b",
      email: "blair@example.test",
      fullName: "Blair Example",
      avatarUrl: "javascript:alert(1)",
    };
    api.setCurrentUser(userB, directoryUserB);

    await act(async () => {
      queryClient.setQueryData(authKeys.currentUser(), userB);
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit profile" })).toBeEnabled(),
    );
    expect(
      await screen.findByText("Blair Example", { selector: "p" }),
    ).toBeVisible();
    expect(screen.getByText("blair@example.test")).toBeVisible();
    expect(screen.queryByText("Alex Example")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(mockedApiClient).toHaveBeenCalledWith("/iam/users/user-b");
  });
});
