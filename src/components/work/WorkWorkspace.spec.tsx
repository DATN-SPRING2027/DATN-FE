import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import { projectKeys } from "@/lib/queries/projects/useProjects";
import { apiClient } from "@/lib/api-client";
import WorkWorkspace from "./WorkWorkspace";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/icons", () => {
  const Icon = () => null;
  return {
    CalenderIcon: Icon,
    CheckCircleIcon: Icon,
    ChevronLeftIcon: Icon,
    CloseLineIcon: Icon,
    DocsIcon: Icon,
    FilterIcon: Icon,
    GridIcon: Icon,
    ListIcon: Icon,
    PieChartIcon: Icon,
    PlusIcon: Icon,
    SearchIcon: Icon,
    TableIcon: Icon,
    TaskIcon: Icon,
    TimeIcon: Icon,
  };
});

const api = vi.mocked(apiClient);

function mount(projectId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkWorkspace projectId={projectId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, client };
}

describe("WorkWorkspace project scope", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("loads the project from the current organization and links back to its detail", async () => {
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: "user-1", organizationId: "org-1", roles: ["MEMBER"] };
      }
      if (path === "/iam/projects/project-1") {
        return {
          id: "project-1",
          organizationId: "org-1",
          name: "Apollo",
          code: "AP",
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBy: "user-1",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        };
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    mount("project-1");

    expect(await screen.findByRole("heading", { level: 1, name: "Apollo" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Work breadcrumb" })).toContainElement(
      screen.getByRole("link", { name: "Apollo" }),
    );
    expect(screen.getByRole("link", { name: "Apollo" })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(api).toHaveBeenCalledWith(
      "/iam/projects/project-1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the workspace visible while refreshing the project in the background", async () => {
    const project = {
      id: "project-1",
      organizationId: "org-1",
      name: "Apollo",
      code: "AP",
      visibility: "PRIVATE",
      status: "ACTIVE",
      createdBy: "user-1",
      createdAt: "2026-10-05T00:00:00Z",
      updatedAt: "2026-10-05T00:00:00Z",
    };
    let projectCalls = 0;
    let finishRefresh: ((value: typeof project) => void) | undefined;
    api.mockImplementation(async (path) => {
      if (path === "/auth/me") {
        return { id: "user-1", organizationId: "org-1", roles: ["MEMBER"] };
      }
      if (path === "/iam/projects/project-1") {
        projectCalls += 1;
        if (projectCalls > 1) {
          return new Promise<typeof project>((resolve) => {
            finishRefresh = resolve;
          });
        }
        return project;
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    const { client } = mount("project-1");
    const heading = await screen.findByRole("heading", { level: 1, name: "Apollo" });
    const refresh = client.invalidateQueries({
      queryKey: projectKeys.detail("org-1", "project-1"),
    });

    await waitFor(() => expect(projectCalls).toBe(2));
    expect(heading).toBeVisible();

    finishRefresh?.(project);
    await refresh;
  });
});
