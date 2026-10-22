import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import OrganizationOverviewDashboard from "./OrganizationOverviewDashboard";

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
  AlertIcon: () => null,
  ArrowRightIcon: () => null,
  CheckCircleIcon: () => null,
  EyeIcon: () => null,
  FolderIcon: () => null,
  GroupIcon: () => null,
  InfoIcon: () => null,
  LockIcon: () => null,
  MailIcon: () => null,
  SettingsIcon: () => null,
  TimeIcon: () => null,
  UserIcon: () => null,
}));

const api = vi.mocked(apiClient);
const organizationId = "0123456789abcdef01234567";
const managerUserId = "9123456789abcdef01234567";
const leaderlessProjectId = "2123456789abcdef01234567";
const healthyProjectId = "3123456789abcdef01234567";

function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return render(<OrganizationOverviewDashboard />, { wrapper: Wrapper });
}

describe("OrganizationOverviewDashboard", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("renders real Organization Overview KPIs, Project Governance table, Leaderless Projects banner, and Last-Manager protection notice for Managers", async () => {
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") {
        return {
          id: managerUserId,
          email: "manager@continuum.ai",
          name: "Thang Manager",
          organizationId,
          roles: ["ADMIN"],
        };
      }
      if (endpoint === `/iam/organizations/${organizationId}/overview`) {
        return {
          organization: {
            id: organizationId,
            name: "Continuum Engineering",
            slug: "continuum-eng",
            description: "Core AI Engineering Organization",
            status: "ACTIVE",
            plan: "ENTERPRISE",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          metrics: {
            activeMembers: 14,
            suspendedMembers: 2,
            pendingInvitations: 3,
            totalProjects: 5,
            activeProjects: 4,
            archivedProjects: 1,
            leaderlessProjectsCount: 1,
          },
          leaderlessProjects: [
            {
              id: leaderlessProjectId,
              name: "Platform Migration",
              code: "PMIG",
              visibility: "PRIVATE",
              status: "ACTIVE",
              activeMemberCount: 4,
              effectiveLeaderCount: 0,
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          managers: [
            {
              userId: managerUserId,
              fullName: "Thang Manager",
              email: "manager@continuum.ai",
              accountStatus: "ACTIVE",
            },
          ],
        };
      }
      if (endpoint.startsWith("/iam/projects?")) {
        return {
          data: [
            {
              id: leaderlessProjectId,
              organizationId,
              name: "Platform Migration",
              code: "PMIG",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: managerUserId,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
              activeMemberCount: 4,
              effectiveLeaderCount: 0,
              leaders: [],
              requiresLeaderRecovery: true,
            },
            {
              id: healthyProjectId,
              organizationId,
              name: "Knowledge Core",
              code: "KCOR",
              visibility: "PUBLIC",
              status: "ACTIVE",
              createdBy: managerUserId,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
              activeMemberCount: 8,
              effectiveLeaderCount: 1,
              leaders: [
                {
                  userId: managerUserId,
                  fullName: "Thang Manager",
                  email: "manager@continuum.ai",
                },
              ],
              requiresLeaderRecovery: false,
            },
          ],
          pagination: {
            page: 1,
            pageSize: 6,
            totalItems: 2,
            totalPages: 1,
          },
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    mount();

    expect(
      await screen.findByRole("heading", { name: "Continuum Engineering" }),
    ).toBeVisible();
    expect(
      screen.getByText("1 active project has 0 effective Leaders"),
    ).toBeVisible();
    expect(screen.getAllByText("Platform Migration").length).toBeGreaterThan(0);
    expect(await screen.findByText("Knowledge Core")).toBeVisible();
    expect(screen.getAllByText("Recover Leader").length).toBeGreaterThan(0);
    expect(screen.getByText("Manage Leaders")).toBeVisible();
    expect(
      screen.getByText(/Last Manager Protection is active/i),
    ).toBeVisible();
    expect(screen.getByText("Protected")).toBeVisible();
  });
});
