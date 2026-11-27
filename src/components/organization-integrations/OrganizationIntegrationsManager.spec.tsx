import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError, apiClient } from "@/lib/api-client";
import type { McpApiKeyView } from "@/lib/queries/mcp-keys/mcp-keys.types";
import OrganizationIntegrationsManager from "./OrganizationIntegrationsManager";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/icons", () => {
  const Icon = () => null;
  return {
    ArrowRightIcon: Icon,
    CheckCircleIcon: Icon,
    CheckLineIcon: Icon,
    CloseIcon: Icon,
    CloseLineIcon: Icon,
    CopyIcon: Icon,
    DocsIcon: Icon,
    InfoIcon: Icon,
    LockIcon: Icon,
    PlugInIcon: Icon,
    PlusIcon: Icon,
    SearchIcon: Icon,
    TrashBinIcon: Icon,
  };
});

const api = vi.mocked(apiClient);
const organizationId = "0123456789abcdef01234567";
const secondOrganizationId = "fedcba9876543210fedcba98";
const memberUserId = "9123456789abcdef01234567";

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
  return {
    queryClient,
    ...render(<OrganizationIntegrationsManager />, { wrapper: Wrapper }),
  };
}

describe("OrganizationIntegrationsManager", () => {
  beforeEach(() => {
    api.mockReset();
    document.body.style.overflow = "";
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders loading skeleton while session is pending and recovers on error retry", async () => {
    let shouldFail = true;
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        return { data: [], pagination: { page: 1, pageSize: 100 } };
      }
      if (endpoint === "/iam/mcp-api-keys") {
        if (shouldFail) {
          throw new ApiError(503, "UNAVAILABLE", "Service unavailable");
        }
        return {
          items: [],
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    mount();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");

    expect(
      await screen.findByText("Unable to complete request"),
    ).toBeInTheDocument();

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("No personal MCP API keys yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Explore Full MCP Docs/i }),
    ).toHaveAttribute("href", "/docs");
  });

  it("creates a personal MCP API key, reveals the one-time ctm_mcp secret with Jump to IDE Setup, supports WAI-ARIA tabs, and revokes keys", async () => {
    let keys: McpApiKeyView[] = [
      {
        id: "key-existing-1",
        name: "Workstation CLI",
        keyPrefix: "ctm_mcp_a8F3k9xZ",
        scope: "READ_ONLY",
        allowedProjectIds: ["proj-cntm", "proj-2", "proj-3"],
        organizationId,
        userId: memberUserId,
        createdAt: "2026-11-01T00:00:00.000Z",
        expiresAt: null,
        lastUsedAt: "2026-11-20T00:00:00.000Z",
        revokedAt: null,
        status: "ACTIVE",
      },
    ];

    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        expect(String(endpoint)).toContain("pageSize=100");
        return {
          data: [
            {
              id: "proj-cntm",
              organizationId,
              name: "Continuum Core",
              code: "CNTM",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: memberUserId,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "proj-2",
              organizationId,
              name: "SAG Engine",
              code: "SAG",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: memberUserId,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "proj-3",
              organizationId,
              name: "Handover Hub",
              code: "HNDV",
              visibility: "PRIVATE",
              status: "ACTIVE",
              createdBy: memberUserId,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          pagination: { page: 1, pageSize: 100 },
        };
      }
      if (
        endpoint === "/iam/mcp-api-keys" &&
        (!options?.method || options.method === "GET")
      ) {
        return {
          items: keys,
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      if (endpoint === "/iam/mcp-api-keys" && options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        const newKey: McpApiKeyView = {
          id: "key-minted-2",
          name: body.name,
          keyPrefix: "ctm_mcp_Z9y8X7w6",
          scope: body.scope,
          allowedProjectIds: body.allowedProjectIds,
          organizationId,
          userId: memberUserId,
          createdAt: "2026-11-26T16:00:00.000Z",
          expiresAt: "2027-02-24T16:00:00.000Z",
          lastUsedAt: null,
          revokedAt: null,
          status: "ACTIVE",
        };
        keys = [newKey, ...keys];
        return {
          key: newKey,
          rawKey: "ctm_mcp_Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e",
        };
      }
      if (
        endpoint === "/iam/mcp-api-keys/key-existing-1" &&
        options?.method === "DELETE"
      ) {
        keys = keys.map((item) =>
          item.id === "key-existing-1"
            ? {
                ...item,
                status: "REVOKED",
                revokedAt: "2026-11-26T16:05:00.000Z",
              }
            : item,
        );
        return {
          key: keys.find((item) => item.id === "key-existing-1")!,
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint} (${options?.method})`);
    });

    mount();

    expect(await screen.findByText("Workstation CLI")).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 \+ Live RBAC/)).toBeInTheDocument();
    // +1 overflow badge for 3 allowed projects (showing 2 codes + "+1")
    expect(await screen.findByText("+1")).toBeInTheDocument();

    // Initially IDE snippet shows placeholder token
    expect(screen.getByTestId("mcp-ide-config-pre")).toHaveTextContent(
      "ctm_mcp_YOUR_PERSONAL_SECRET_KEY",
    );

    // Open Create Key Modal and verify initial focus + scroll lock
    fireEvent.click(
      screen.getAllByRole("button", { name: /Create Personal MCP API Key/i })[0],
    );
    const dialog = screen.getByRole("dialog", {
      name: "Create Personal MCP API Key",
    });
    expect(document.body.style.overflow).toBe("hidden");
    const nameInput = within(dialog).getByLabelText("Key label");
    await waitFor(() => {
      expect(nameInput).toHaveFocus();
    });

    fireEvent.change(nameInput, {
      target: { value: "Cursor — MacBook Pro" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /READ_WRITE/i }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /Restrict to specific projects/i,
      }),
    );
    fireEvent.click(within(dialog).getByLabelText(/Continuum Core/i));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Generate Secret Key" }),
    );

    const secretVault = await screen.findByTestId("mcp-secret-reveal-vault");
    expect(document.body.style.overflow).toBe("");
    expect(secretVault).toHaveTextContent(
      "ctm_mcp_Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e",
    );
    expect(
      within(secretVault).getByRole("button", { name: /Jump to IDE Setup/i }),
    ).toBeInTheDocument();

    const postCall = api.mock.calls.find(
      ([endpoint, opts]) =>
        endpoint === "/iam/mcp-api-keys" && opts?.method === "POST",
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      name: "Cursor — MacBook Pro",
      scope: "READ_WRITE",
      allowedProjectIds: ["proj-cntm"],
      expiresInDays: 90,
    });

    // Newly minted secret is automatically injected into IDE Quick-Setup tabs
    expect(screen.getByTestId("mcp-ide-config-pre")).toHaveTextContent(
      "ctm_mcp_Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e",
    );

    // Keyboard ArrowRight navigation on IDE tablist
    const antigravityTab = screen.getByRole("tab", {
      name: "Google Antigravity",
    });
    fireEvent.keyDown(antigravityTab, { key: "ArrowRight" });
    const claudeCodeTab = screen.getByRole("tab", { name: "Claude Code CLI" });
    expect(claudeCodeTab).toHaveAttribute("aria-selected", "true");
    expect(claudeCodeTab).toHaveFocus();
    expect(screen.getByTestId("mcp-ide-config-pre")).toHaveTextContent(
      "claude mcp add --transport http continuum",
    );

    // Revoke Workstation CLI key with confirmation & verify revokedAt timestamp without opacity-70
    const row = screen.getByText("Workstation CLI").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Revoke" }));

    const revokeDialog = screen.getByRole("dialog", {
      name: "Revoke MCP API key?",
    });
    const cancelBtn = within(revokeDialog).getByRole("button", {
      name: "Cancel",
    });
    await waitFor(() => {
      expect(cancelBtn).toHaveFocus();
    });

    fireEvent.click(
      within(revokeDialog).getByRole("button", {
        name: "Revoke Key Immediately",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Revoked")).toBeInTheDocument();
    });
    expect(screen.getByText(/Revoked Nov 26, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Workstation CLI").closest("tr")).not.toHaveClass(
      "opacity-70",
    );
  });

  it("clears mintedSecret immediately when organizationId changes (C-01 cross-org leak defense)", async () => {
    let activeOrg = organizationId;

    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId: activeOrg,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        return { data: [], pagination: { page: 1, pageSize: 100 } };
      }
      if (
        endpoint === "/iam/mcp-api-keys" &&
        (!options?.method || options.method === "GET")
      ) {
        return {
          items: [],
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      if (endpoint === "/iam/mcp-api-keys" && options?.method === "POST") {
        return {
          key: {
            id: "key-org-a",
            name: "Org A Secret Key",
            keyPrefix: "ctm_mcp_OrgA1234",
            scope: "READ_ONLY",
            allowedProjectIds: null,
            organizationId: activeOrg,
            userId: memberUserId,
            createdAt: "2026-11-26T16:00:00.000Z",
            expiresAt: null,
            lastUsedAt: null,
            revokedAt: null,
            status: "ACTIVE",
          },
          rawKey: "ctm_mcp_ORG_A_TOP_SECRET_RAW_TOKEN_VALUE_123456",
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const { queryClient } = mount();
    await screen.findByText("No personal MCP API keys yet");

    fireEvent.click(
      screen.getAllByRole("button", { name: /Create Personal MCP API Key/i })[0],
    );
    const dialog = screen.getByRole("dialog", {
      name: "Create Personal MCP API Key",
    });
    fireEvent.change(within(dialog).getByLabelText("Key label"), {
      target: { value: "Org A Secret Key" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Generate Secret Key" }),
    );

    await screen.findByTestId("mcp-secret-reveal-vault");
    expect(screen.getByTestId("mcp-ide-config-pre")).toHaveTextContent(
      "ctm_mcp_ORG_A_TOP_SECRET_RAW_TOKEN_VALUE_123456",
    );

    // Switch organization context to secondOrganizationId
    activeOrg = secondOrganizationId;
    await queryClient.invalidateQueries();

    await waitFor(() => {
      expect(
        screen.queryByTestId("mcp-secret-reveal-vault"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("mcp-ide-config-pre")).toHaveTextContent(
      "ctm_mcp_YOUR_PERSONAL_SECRET_KEY",
    );
    expect(screen.getByTestId("mcp-ide-config-pre")).not.toHaveTextContent(
      "ctm_mcp_ORG_A_TOP_SECRET_RAW_TOKEN_VALUE_123456",
    );
  });

  it("maps 403 CSRF_INVALID & 409 MCP_API_KEY_LIMIT_EXCEEDED accurately, traps modal focus, and never fakes Copied on clipboard rejection", async () => {
    let postError: ApiError = new ApiError(
      403,
      "CSRF_INVALID",
      "Invalid CSRF token",
    );

    api.mockImplementation(async (endpoint, options) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        return { data: [], pagination: { page: 1, pageSize: 100 } };
      }
      if (
        endpoint === "/iam/mcp-api-keys" &&
        (!options?.method || options.method === "GET")
      ) {
        return {
          items: [],
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      if (endpoint === "/iam/mcp-api-keys" && options?.method === "POST") {
        throw postError;
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    mount();
    await screen.findByText("No personal MCP API keys yet");

    // Clipboard failure must NOT set "Config Copied"
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Blocked")),
      },
    });
    document.execCommand = vi.fn(() => false);

    fireEvent.click(screen.getByRole("button", { name: "Copy Config" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("button", { name: "Config Copied" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Automatic copy was blocked by your browser/i),
    ).toBeInTheDocument();

    // Open Create Modal -> verify 403 CSRF_INVALID error mapping
    const openBtn = screen.getAllByRole("button", {
      name: /Create Personal MCP API Key/i,
    })[0];
    openBtn.focus();
    fireEvent.click(openBtn);

    const dialog = screen.getByRole("dialog", {
      name: "Create Personal MCP API Key",
    });
    fireEvent.change(within(dialog).getByLabelText("Key label"), {
      target: { value: "Test Key" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Generate Secret Key" }),
    );
    expect(
      await within(dialog).findByText(
        "Your security token expired or changed. Refresh the page and try again.",
      ),
    ).toBeInTheDocument();

    // Verify 409 MCP_API_KEY_LIMIT_EXCEEDED error mapping
    postError = new ApiError(
      409,
      "MCP_API_KEY_LIMIT_EXCEEDED",
      "Key limit exceeded",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Generate Secret Key" }),
    );
    expect(
      await within(dialog).findByText(
        /You have reached the maximum number of active MCP API keys/i,
      ),
    ).toBeInTheDocument();

    // Escape closes modal and restores focus to trigger button
    // First verify Tab/Shift+Tab focus trap stays inside the dialog
    const closeBtn = within(dialog).getByRole("button", {
      name: "Close key creation dialog",
    });
    const submitBtn = within(dialog).getByRole("button", {
      name: "Generate Secret Key",
    });
    closeBtn.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(submitBtn).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeBtn).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Create Personal MCP API Key" }),
    ).not.toBeInTheDocument();
    expect(openBtn).toHaveFocus();
  });

  it("handles >6 projects search/Select-All/Clear and recovers from projectsQuery error", async () => {
    let failProjects = true;
    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        if (failProjects) {
          throw new ApiError(503, "UNAVAILABLE", "Projects down");
        }
        return {
          data: Array.from({ length: 7 }, (_, i) => ({
            id: `proj-${i + 1}`,
            organizationId,
            name: `Project Alpha ${i + 1}`,
            code: `ALP${i + 1}`,
            visibility: "PRIVATE",
            status: "ACTIVE",
            createdBy: memberUserId,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          })),
          pagination: { page: 1, pageSize: 100 },
        };
      }
      if (endpoint === "/iam/mcp-api-keys") {
        return {
          items: [],
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    mount();
    await screen.findByText("No personal MCP API keys yet");

    fireEvent.click(
      screen.getAllByRole("button", { name: /Create Personal MCP API Key/i })[0],
    );
    const dialog = screen.getByRole("dialog", {
      name: "Create Personal MCP API Key",
    });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /Restrict to specific projects/i,
      }),
    );

    expect(
      await within(dialog).findByText(/Could not load active projects/i),
    ).toBeInTheDocument();

    failProjects = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));

    const filterInput = await within(dialog).findByRole("searchbox", {
      name: /Filter projects by name or code/i,
    });
    fireEvent.change(filterInput, { target: { value: "ALP7" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Select all" }));
    expect(within(dialog).getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("portals create & revoke modal backdrops to document.body at z-99999 and closes on backdrop click", async () => {
    const activeKey: McpApiKeyView = {
      id: "key-existing-1",
      name: "Workstation CLI",
      keyPrefix: "ctm_mcp_a8F3k9xZ",
      scope: "READ_ONLY",
      allowedProjectIds: null,
      organizationId,
      userId: memberUserId,
      createdAt: "2026-11-01T00:00:00.000Z",
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      status: "ACTIVE",
    };

    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        return { data: [], pagination: { page: 1, pageSize: 100 } };
      }
      if (endpoint === "/iam/mcp-api-keys") {
        return {
          items: [activeKey],
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const { container } = mount();
    await screen.findByText("Workstation CLI");

    // 1. Create Modal portals to document.body with z-99999 above AdminLayout & floating widgets
    const openBtn = screen.getAllByRole("button", {
      name: /Create Personal MCP API Key/i,
    })[0];
    openBtn.focus();
    fireEvent.click(openBtn);

    const createBackdrop = screen.getByTestId("mcp-create-modal-backdrop");
    expect(createBackdrop.parentElement).toBe(document.body);
    expect(container.contains(createBackdrop)).toBe(false);
    expect(createBackdrop).toHaveClass("z-99999");

    const createDialog = within(createBackdrop).getByRole("dialog", {
      name: "Create Personal MCP API Key",
    });
    // Clicking inside dialog must keep modal open
    fireEvent.click(createDialog);
    expect(screen.getByTestId("mcp-create-modal-backdrop")).toBeInTheDocument();

    // Clicking backdrop closes modal and restores trigger focus
    fireEvent.click(createBackdrop);
    expect(
      screen.queryByTestId("mcp-create-modal-backdrop"),
    ).not.toBeInTheDocument();
    expect(openBtn).toHaveFocus();

    // 2. Revoke Modal portals to document.body with z-99999 and closes on backdrop click
    const revokeBtn = screen.getByRole("button", { name: "Revoke" });
    revokeBtn.focus();
    fireEvent.click(revokeBtn);

    const revokeBackdrop = screen.getByTestId("mcp-revoke-modal-backdrop");
    expect(revokeBackdrop.parentElement).toBe(document.body);
    expect(container.contains(revokeBackdrop)).toBe(false);
    expect(revokeBackdrop).toHaveClass("z-99999");

    const revokeDialog = within(revokeBackdrop).getByRole("dialog", {
      name: "Revoke MCP API key?",
    });
    fireEvent.click(revokeDialog);
    expect(screen.getByTestId("mcp-revoke-modal-backdrop")).toBeInTheDocument();

    fireEvent.click(revokeBackdrop);
    expect(
      screen.queryByTestId("mcp-revoke-modal-backdrop"),
    ).not.toBeInTheDocument();
    expect(revokeBtn).toHaveFocus();
  });

  it("applies custom scrollbars, supports Wrap toggle on code snippets, and filters/searches the key ledger", async () => {
    const keys: McpApiKeyView[] = [
      {
        id: "key-1",
        name: "Workstation CLI",
        keyPrefix: "ctm_mcp_a8F3k9xZ",
        scope: "FULL_OPERATIONS",
        allowedProjectIds: null,
        organizationId,
        userId: memberUserId,
        createdAt: "2026-11-01T00:00:00.000Z",
        expiresAt: null,
        lastUsedAt: "2026-11-20T00:00:00.000Z",
        revokedAt: null,
        status: "ACTIVE",
      },
      {
        id: "key-2",
        name: "Legacy Cursor Key",
        keyPrefix: "ctm_mcp_OldRevoked",
        scope: "READ_ONLY",
        allowedProjectIds: null,
        organizationId,
        userId: memberUserId,
        createdAt: "2026-10-01T00:00:00.000Z",
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: "2026-10-15T00:00:00.000Z",
        status: "REVOKED",
      },
    ];

    api.mockImplementation(async (endpoint) => {
      if (endpoint === "/auth/me") {
        return {
          id: memberUserId,
          email: "member@continuum.ai",
          name: "Linh Member",
          organizationId,
          roles: ["MEMBER"],
        };
      }
      if (String(endpoint).startsWith("/iam/projects")) {
        return { data: [], pagination: { page: 1, pageSize: 100 } };
      }
      if (endpoint === "/iam/mcp-api-keys") {
        return {
          items: keys,
          mcpEndpointPath: "/api/v1/mcp",
          protocolVersion: "2025-03-26",
          toolCount: 36,
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    mount();
    expect(await screen.findByText("Workstation CLI")).toBeInTheDocument();
    expect(screen.getByText("Legacy Cursor Key")).toBeInTheDocument();

    // Custom scrollbar classes on table wrapper & IDE code <pre>
    const tableWrapper = screen.getByRole("table").parentElement!;
    expect(tableWrapper).toHaveClass("custom-scrollbar");

    const codePre = screen.getByTestId("mcp-ide-config-pre");
    expect(codePre).toHaveClass("custom-scrollbar-dark");
    expect(codePre).not.toHaveClass("whitespace-pre-wrap");

    // Wrap toggle toggles aria-pressed and whitespace-pre-wrap
    const wrapBtn = screen.getByRole("button", {
      name: "Wrap lines in code block",
    });
    expect(wrapBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(wrapBtn);
    expect(wrapBtn).toHaveAttribute("aria-pressed", "true");
    expect(codePre).toHaveClass("whitespace-pre-wrap");

    // Filter Revoked
    fireEvent.click(screen.getByRole("button", { name: /^Revoked \(1\)/i }));
    expect(screen.queryByText("Workstation CLI")).not.toBeInTheDocument();
    expect(screen.getByText("Legacy Cursor Key")).toBeInTheDocument();

    // Search miss & Reset filters
    const searchInput = screen.getByRole("searchbox", {
      name: /Search keys by label or prefix/i,
    });
    fireEvent.change(searchInput, { target: { value: "nonexistent-key" } });
    expect(
      screen.getByText("No MCP API keys match your filter."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("Workstation CLI")).toBeInTheDocument();
    expect(screen.getByText("Legacy Cursor Key")).toBeInTheDocument();
  });
});
