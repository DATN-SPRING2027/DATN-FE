import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgeUniverseWorkspace from "../KnowledgeUniverseWorkspace";
import { useClientStateStore } from "@/stores/client-state";

const {
  replace,
  routerMock,
  overviewMock,
  clusterMock,
  detailMock,
  searchMock,
  navState,
  projectsState,
} = vi.hoisted(() => {
  const replaceFn = vi.fn();
  return {
    replace: replaceFn,
    routerMock: { replace: replaceFn },
    overviewMock: vi.fn(),
    clusterMock: vi.fn(),
    detailMock: vi.fn(),
    searchMock: vi.fn(),
    navState: {
      pathname: "/knowledge",
      search: "",
    },
    projectsState: {
      isLoading: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      isComplete: true,
      projects: [
        {
          id: "69e923c77859fd1c702d4c21",
          organizationId: "org-1",
          name: "Continuum Workspace Core",
          code: "CNTM",
          visibility: "PRIVATE" as const,
          status: "ACTIVE" as const,
          createdBy: "user-1",
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
        {
          id: "69e923c77859fd1c702d4c99",
          organizationId: "org-1",
          name: "AI Knowledge Engine",
          code: "AIKE",
          visibility: "PUBLIC" as const,
          status: "ACTIVE" as const,
          createdBy: "user-1",
          createdAt: "2026-10-02T00:00:00Z",
          updatedAt: "2026-10-02T00:00:00Z",
        },
      ],
    },
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navState.search),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => navState.pathname,
  useRouter: () => routerMock,
}));

const translate = (key: string) => key;

vi.mock("next-intl", () => ({
  useTranslations: () => translate,
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: {
      id: "user-1",
      name: "Minh Anh",
      email: "minh@example.test",
      organizationId: "org-1",
      roles: ["ADMIN"],
    },
  }),
}));

vi.mock("@/lib/queries/projects/useActiveOrganizationProjects", () => ({
  useActiveOrganizationProjects: () => projectsState,
}));

vi.mock("@/lib/queries/knowledge-universe/knowledge-universe.api", () => ({
  knowledgeUniverseApi: {
    overview: overviewMock,
    cluster: clusterMock,
    detail: detailMock,
    search: searchMock,
  },
}));

vi.mock("../neural-atlas-scene", () => ({
  NeuralAtlasScene: () => <div data-testid="neural-atlas-scene" />,
}));

vi.mock("../orbital-graph-3d", () => ({
  OrbitalEventEntityGraph: () => <div data-testid="orbital-graph-3d" />,
}));

vi.mock("../universe-webgl-capability", () => ({
  detectUniverseWebGLCapability: () => "available",
}));

describe("KnowledgeUniverseWorkspace project synchronization", () => {
  beforeEach(() => {
    useClientStateStore.setState({
      activeProjectId: null,
      selectedProjectByOrg: {},
    });
    navState.pathname = "/knowledge";
    navState.search = "";
    replace.mockReset();
    overviewMock.mockReset().mockImplementation(async (projectId: string) => ({
      project_id: projectId,
      trees: [],
    }));
    clusterMock.mockReset().mockImplementation(
      async (
        projectId: string,
        params: { tree_version: string; node_id: string },
      ) => ({
        project_id: projectId,
        tree_version: params.tree_version,
        node_id: params.node_id,
        total: 0,
        units: [],
        edges: [],
      }),
    );
    detailMock.mockReset();
    searchMock.mockReset();
  });

  it("preserves the remembered active project from client state when opening /knowledge without query params instead of resetting to projects[0]", async () => {
    useClientStateStore
      .getState()
      .setSelectedProjectForOrg("org-1", "69e923c77859fd1c702d4c99");
    const syncListener = vi.fn();
    window.addEventListener("continuum:workspace-project-sync", syncListener);

    try {
      render(<KnowledgeUniverseWorkspace />);

      await waitFor(() => {
        expect(overviewMock).toHaveBeenCalledWith(
          "69e923c77859fd1c702d4c99",
          expect.any(AbortSignal),
        );
      });
      expect(overviewMock).not.toHaveBeenCalledWith(
        "69e923c77859fd1c702d4c21",
        expect.anything(),
      );
      expect(replace).toHaveBeenCalledWith(
        "/knowledge?projectId=69e923c77859fd1c702d4c99",
      );
      expect(
        useClientStateStore.getState().selectedProjectByOrg["org-1"],
      ).toBe("69e923c77859fd1c702d4c99");
      expect(
        syncListener.mock.calls.map(
          (call) => (call[0] as CustomEvent<{ projectId: string }>).detail.projectId,
        ),
      ).toEqual(["69e923c77859fd1c702d4c99"]);
    } finally {
      window.removeEventListener(
        "continuum:workspace-project-sync",
        syncListener,
      );
    }
  });

  it("prioritizes continuum:workspace-project-switch immediately even before ?projectId in the URL updates, and still honors subsequent popstate navigation", async () => {
    navState.search = "projectId=69e923c77859fd1c702d4c21";
    const view = render(<KnowledgeUniverseWorkspace />);

    await waitFor(() => {
      expect(overviewMock).toHaveBeenCalledWith(
        "69e923c77859fd1c702d4c21",
        expect.any(AbortSignal),
      );
    });

    // Switch project via sidebar event while URL query still holds the old projectId
    act(() => {
      window.dispatchEvent(
        new CustomEvent("continuum:workspace-project-switch", {
          detail: { projectId: "69e923c77859fd1c702d4c99" },
        }),
      );
    });

    await waitFor(() => {
      expect(overviewMock).toHaveBeenCalledWith(
        "69e923c77859fd1c702d4c99",
        expect.any(AbortSignal),
      );
    });
    expect(replace).toHaveBeenCalledWith(
      "/knowledge?projectId=69e923c77859fd1c702d4c99",
    );

    // Simulate URL catching up and then user pressing Browser Back to the original project
    navState.search = "projectId=69e923c77859fd1c702d4c99";
    view.rerender(<KnowledgeUniverseWorkspace />);

    overviewMock.mockClear();
    navState.search = "projectId=69e923c77859fd1c702d4c21";
    act(() => {
      fireEvent(window, new PopStateEvent("popstate"));
    });
    view.rerender(<KnowledgeUniverseWorkspace />);

    await waitFor(() => {
      expect(overviewMock).toHaveBeenCalledWith(
        "69e923c77859fd1c702d4c21",
        expect.any(AbortSignal),
      );
    });
  });

  it("does not cover the 3D scene with the centered stale overlay when SAG returns source-snapshot trees while status is stale", async () => {
    overviewMock.mockResolvedValueOnce({
      version: null,
      status: "stale",
      stale: true,
      trees: [
        {
          project_id: "69e923c77859fd1c702d4c21",
          tree_version: "source-1234",
          projection: "source",
          node_count: 1,
          unit_count: 14,
          source_count: 1,
          nodes: [
            {
              id: "node-doc-1",
              parent_id: null,
              depth: 0,
              label: "NHÓM 11 · Xây dựng hệ thống",
              is_leaf: true,
              unit_count: 14,
              source_count: 1,
              document_count: 1,
              top_entities: [],
            },
          ],
        },
      ],
    });

    render(<KnowledgeUniverseWorkspace />);

    await waitFor(() => {
      expect(screen.getByTestId("neural-atlas-scene")).toBeInTheDocument();
    });

    expect(screen.queryByText("staleTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("staleHint")).not.toBeInTheDocument();
    expect(screen.queryByText("openDocuments")).not.toBeInTheDocument();
    expect(screen.getByText("sourceSnapshotBadge")).toBeInTheDocument();
    expect(screen.getByLabelText("sourceNotice")).toBeInTheDocument();
  });

  it("still renders the centered stale empty state when status is stale and no trees are available", async () => {
    overviewMock.mockResolvedValueOnce({
      version: null,
      status: "stale",
      stale: true,
      trees: [],
    });

    render(<KnowledgeUniverseWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("staleTitle")).toBeInTheDocument();
    });

    expect(screen.getByText("staleHint")).toBeInTheDocument();
    expect(screen.getByText("openDocuments")).toBeInTheDocument();
    expect(screen.queryByTestId("neural-atlas-scene")).not.toBeInTheDocument();
  });
});
