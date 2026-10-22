import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import OrganizationSettingsManager from "./OrganizationSettingsManager";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/icons", () => ({
  CheckCircleIcon: () => null,
  InfoIcon: () => null,
  LockIcon: () => null,
  SettingsIcon: () => null,
  UserIcon: () => null,
}));

const api = vi.mocked(apiClient);
const organizationId = "0123456789abcdef01234567";
const managerUserId = "9123456789abcdef01234567";

function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return render(<OrganizationSettingsManager />, { wrapper: Wrapper });
}

describe("OrganizationSettingsManager", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("loads organization settings, shows read-only platform-governed fields, and saves allowlisted changes with CAS", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "__Host-csrf=csrf-value",
    );
    let orgName = "Continuum Engineering";
    let orgDescription: string | null = "Core AI Workspace";
    let updatedAt = "2026-01-02T00:00:00.000Z";

    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") {
        return {
          id: managerUserId,
          email: "manager@continuum.ai",
          name: "Thang Manager",
          organizationId,
          roles: ["ADMIN"],
        };
      }
      if (
        endpoint === `/iam/organizations/${organizationId}/settings` &&
        (!options?.method || options.method === "GET")
      ) {
        return {
          organization: {
            id: organizationId,
            name: orgName,
            slug: "continuum-eng",
            description: orgDescription,
            plan: "ENTERPRISE",
            status: "ACTIVE",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt,
          },
          editableFields: ["name", "description"],
          managers: [
            {
              userId: managerUserId,
              fullName: "Thang Manager",
              email: "manager@continuum.ai",
              accountStatus: "ACTIVE",
            },
          ],
          availablePermissions: [
            "org:read",
            "org:update",
            "member:invite",
            "member:remove",
            "role:assign",
            "project:create",
          ],
        };
      }
      if (
        endpoint === `/iam/organizations/${organizationId}/settings` &&
        options?.method === "PATCH"
      ) {
        const body = JSON.parse(String(options.body));
        orgName = body.name;
        orgDescription = body.description;
        updatedAt = "2026-01-03T00:00:00.000Z";
        return {
          organization: {
            id: organizationId,
            name: orgName,
            slug: "continuum-eng",
            description: orgDescription,
            plan: "ENTERPRISE",
            status: "ACTIVE",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt,
          },
          editableFields: ["name", "description"],
          managers: [
            {
              userId: managerUserId,
              fullName: "Thang Manager",
              email: "manager@continuum.ai",
              accountStatus: "ACTIVE",
            },
          ],
          availablePermissions: ["org:read", "org:update"],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    mount();

    const nameInput = await screen.findByLabelText("Organization name");
    expect(nameInput).toHaveValue("Continuum Engineering");
    expect(screen.getByText("@continuum-eng")).toBeVisible();
    expect(screen.getByText("ENTERPRISE")).toBeVisible();

    fireEvent.change(nameInput, {
      target: { value: "Continuum AI Global" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated governance workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Organization settings updated."),
    ).toBeVisible();

    await waitFor(() => {
      const patchCall = api.mock.calls.find(
        ([endpoint, options]) =>
          endpoint === `/iam/organizations/${organizationId}/settings` &&
          options?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        name: "Continuum AI Global",
        description: "Updated governance workspace",
        expectedUpdatedAt: "2026-01-02T00:00:00.000Z",
      });
    });
  });
});
