import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import { ApiError, apiClient } from "@/lib/api-client";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import NotificationsWorkspace from "@/components/notifications/NotificationsWorkspace";
import WorkNotesWorkspace from "@/components/work-notes/WorkNotesWorkspace";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useProjectQuery } from "@/lib/queries/projects/useProjects";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

const routerPushMock = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
  }),
  usePathname: () => "/notifications",
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
}));

vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectQuery: vi.fn(),
}));

const api = vi.mocked(apiClient);

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          {ui}
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("Notification MVP — Dropdown, Center, Deep-link & Safe Fallback", () => {
  beforeEach(() => {
    api.mockReset();
    routerPushMock.mockReset();
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: "507f1f77bcf86cd799439001",
        email: "member@example.com",
        name: "Member User",
        context: "ORGANIZATION",
        organizationId: "507f1f77bcf86cd799439002",
        roles: ["MEMBER"],
      },
      isPending: false,
      isError: false,
    } as never);
  });

  it("renders unread badge from backend API and hides badge when unread count is 0", async () => {
    let unreadCount = 3;
    api.mockImplementation(async (path: string) => {
      if (path === "/notifications/unread-count") {
        return { count: unreadCount };
      }
      if (path.startsWith("/notifications")) {
        return { data: [], nextCursor: null };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const { client } = renderWithProviders(<NotificationDropdown />);

    await waitFor(() => {
      expect(screen.getByTestId("notification-unread-badge")).toHaveTextContent(
        "3",
      );
    });

    unreadCount = 0;
    await client.invalidateQueries({ queryKey: ["notifications"] });

    await waitFor(() => {
      expect(
        screen.queryByTestId("notification-unread-badge"),
      ).not.toBeInTheDocument();
    });
  });

  it("loads real notifications in dropdown, marks single item as read, and marks all as read with CSRF header", async () => {
    document.cookie = "continuum_csrf=test-csrf-token-123";
    const sampleNotifications = [
      {
        id: "507f1f77bcf86cd799439010",
        recipientId: "507f1f77bcf86cd799439001",
        actorId: "507f1f77bcf86cd799439099",
        organizationId: "507f1f77bcf86cd799439002",
        projectId: "507f1f77bcf86cd799439011",
        taskId: "507f1f77bcf86cd799439022",
        noteId: null,
        conversationId: null,
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        message: "You were assigned to task ATL-101: Implement Notification MVP.",
        target: {
          kind: "TASK",
          organizationId: "507f1f77bcf86cd799439002",
          projectId: "507f1f77bcf86cd799439011",
          taskId: "507f1f77bcf86cd799439022",
          noteId: null,
          conversationId: null,
          messageId: null,
          url: "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
        },
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "507f1f77bcf86cd799439012",
        recipientId: "507f1f77bcf86cd799439001",
        actorId: "507f1f77bcf86cd799439099",
        organizationId: "507f1f77bcf86cd799439002",
        projectId: null,
        taskId: null,
        noteId: null,
        conversationId: "507f1f77bcf86cd799439033",
        type: "CHAT_MENTION",
        title: "Mentioned in chat",
        message: "Alex mentioned you in #general.",
        target: {
          kind: "CHAT",
          organizationId: "507f1f77bcf86cd799439002",
          projectId: null,
          taskId: null,
          noteId: null,
          conversationId: "507f1f77bcf86cd799439033",
          messageId: "507f1f77bcf86cd799439044",
          url: "/chat?conversation=507f1f77bcf86cd799439033&message=507f1f77bcf86cd799439044",
        },
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    ];

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/notifications/unread-count") {
        return { count: 2 };
      }
      if (path.startsWith("/notifications?")) {
        return { items: sampleNotifications, nextCursor: null, unreadCount: 2 };
      }
      if (
        path === "/notifications/507f1f77bcf86cd799439010/read" &&
        init?.method === "PATCH"
      ) {
        return {
          ...sampleNotifications[0],
          readAt: new Date().toISOString(),
        };
      }
      if (path === "/notifications/read-all" && init?.method === "PATCH") {
        return { updatedCount: 2, readAt: new Date().toISOString() };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderWithProviders(<NotificationDropdown />);

    fireEvent.click(screen.getByTestId("notification-bell-button"));

    expect(
      await screen.findByText("New task assigned"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You were assigned to task ATL-101: Implement Notification MVP.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Mentioned in chat")).toBeInTheDocument();

    // Mark single notification as read
    fireEvent.click(
      screen.getByTestId(
        "notification-mark-read-507f1f77bcf86cd799439010",
      ),
    );

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        "/notifications/507f1f77bcf86cd799439010/read",
        expect.objectContaining({
          method: "PATCH",
          headers: { "X-CSRF-Token": "test-csrf-token-123" },
        }),
      );
    });

    // Mark all as read
    fireEvent.click(screen.getByTestId("notification-mark-all-read"));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        "/notifications/read-all",
        expect.objectContaining({
          method: "PATCH",
          headers: { "X-CSRF-Token": "test-csrf-token-123" },
        }),
      );
    });
  });

  it("navigates to deep-link when target resource is accessible and shows safe fallback when deleted or forbidden (both 200 available:false and HTTP 403/404)", async () => {
    const taskNotif = {
      id: "507f1f77bcf86cd799439010",
      recipientId: "507f1f77bcf86cd799439001",
      actorId: "507f1f77bcf86cd799439099",
      organizationId: "507f1f77bcf86cd799439002",
      projectId: "507f1f77bcf86cd799439011",
      taskId: "507f1f77bcf86cd799439022",
      noteId: null,
      conversationId: null,
      type: "TASK_DEADLINE_APPROACHING",
      title: "Task deadline approaching",
      message: "Task ATL-101 is due within 24 hours.",
      target: {
        kind: "TASK",
        organizationId: "507f1f77bcf86cd799439002",
        projectId: "507f1f77bcf86cd799439011",
        taskId: "507f1f77bcf86cd799439022",
        noteId: null,
        conversationId: null,
        messageId: null,
        url: "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
      },
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    const deletedNoteNotif = {
      id: "507f1f77bcf86cd799439015",
      recipientId: "507f1f77bcf86cd799439001",
      actorId: "507f1f77bcf86cd799439099",
      organizationId: "507f1f77bcf86cd799439002",
      projectId: "507f1f77bcf86cd799439011",
      taskId: null,
      noteId: "507f1f77bcf86cd799439055",
      conversationId: null,
      type: "WORK_NOTE_MENTION",
      title: "Mentioned in a work note",
      message: "You were mentioned in a work note.",
      target: {
        kind: "WORK_NOTE",
        organizationId: "507f1f77bcf86cd799439002",
        projectId: "507f1f77bcf86cd799439011",
        taskId: null,
        noteId: "507f1f77bcf86cd799439055",
        conversationId: null,
        messageId: null,
        url: "/projects/507f1f77bcf86cd799439011/work-notes?noteId=507f1f77bcf86cd799439055",
      },
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const forbiddenProjectNotif = {
      id: "507f1f77bcf86cd799439019",
      recipientId: "507f1f77bcf86cd799439001",
      actorId: "507f1f77bcf86cd799439099",
      organizationId: "507f1f77bcf86cd799439002",
      projectId: "507f1f77bcf86cd799439098",
      taskId: null,
      noteId: null,
      conversationId: null,
      type: "PROJECT_MEMBER_REMOVED",
      title: "Removed from project",
      message: "Your access to the project was revoked.",
      target: {
        kind: "PROJECT",
        organizationId: "507f1f77bcf86cd799439002",
        projectId: "507f1f77bcf86cd799439098",
        taskId: null,
        noteId: null,
        conversationId: null,
        messageId: null,
        url: "/projects/507f1f77bcf86cd799439098",
      },
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/notifications/unread-count") {
        return { count: 1 };
      }
      if (path.startsWith("/notifications?")) {
        return {
          items: [taskNotif, deletedNoteNotif, forbiddenProjectNotif],
          nextCursor: null,
          unreadCount: 1,
        };
      }
      if (
        path === "/notifications/507f1f77bcf86cd799439010/read" &&
        init?.method === "PATCH"
      ) {
        return { ...taskNotif, readAt: new Date().toISOString() };
      }
      if (path === "/notifications/507f1f77bcf86cd799439010/resolve") {
        return {
          available: true,
          reason: "OK",
          message: null,
          url: "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
        };
      }
      if (path === "/notifications/507f1f77bcf86cd799439015/resolve") {
        return {
          available: false,
          reason: "DELETED",
          message: "Content is no longer available.",
          url: null,
        };
      }
      if (path === "/notifications/507f1f77bcf86cd799439019/resolve") {
        throw new ApiError(403, "FORBIDDEN", "Forbidden");
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderWithProviders(<NotificationsWorkspace />);

    expect(
      await screen.findByText("Task deadline approaching"),
    ).toBeInTheDocument();

    // Click accessible notification -> navigates to deep-link
    fireEvent.click(
      screen.getByTestId(
        "notifications-page-item-507f1f77bcf86cd799439010",
      ),
    );

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
      );
    });

    routerPushMock.mockClear();

    // Click deleted notification -> shows safe fallback banner without navigating or crashing
    fireEvent.click(
      screen.getByTestId(
        "notifications-page-item-507f1f77bcf86cd799439015",
      ),
    );

    expect(
      await screen.findByTestId("notifications-page-unavailable-banner"),
    ).toHaveTextContent("Content is no longer available.");
    expect(routerPushMock).not.toHaveBeenCalled();

    // Dismiss and click HTTP 403 rejected notification -> also shows safe fallback without navigating
    fireEvent.click(
      screen.getByTestId(
        "notifications-page-item-507f1f77bcf86cd799439019",
      ),
    );

    expect(
      await screen.findByTestId("notifications-page-unavailable-banner"),
    ).toHaveTextContent("Content is no longer available.");
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("keeps user on list and shows retry banner when /resolve fails with 500/network error, then navigates on successful retry", async () => {
    const taskNotif = {
      id: "507f1f77bcf86cd799439088",
      recipientId: "507f1f77bcf86cd799439001",
      actorId: "507f1f77bcf86cd799439099",
      organizationId: "507f1f77bcf86cd799439002",
      projectId: "507f1f77bcf86cd799439011",
      taskId: "507f1f77bcf86cd799439022",
      noteId: null,
      conversationId: null,
      type: "TASK_ASSIGNED",
      title: "Task assigned",
      message: "You were assigned to Task Retry Verification.",
      target: {
        kind: "TASK",
        organizationId: "507f1f77bcf86cd799439002",
        projectId: "507f1f77bcf86cd799439011",
        taskId: "507f1f77bcf86cd799439022",
        noteId: null,
        conversationId: null,
        messageId: null,
        url: "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
      },
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    let shouldFailResolve = true;
    api.mockImplementation(async (path: string) => {
      if (path === "/notifications/unread-count") {
        return { count: 0 };
      }
      if (path.startsWith("/notifications?")) {
        return { items: [taskNotif], nextCursor: null, unreadCount: 0 };
      }
      if (path === "/notifications/507f1f77bcf86cd799439088/resolve") {
        if (shouldFailResolve) {
          throw new ApiError(500, "INTERNAL_ERROR", "Temporary server error");
        }
        return {
          available: true,
          reason: "OK",
          message: null,
          url: "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderWithProviders(<NotificationsWorkspace />);

    expect(await screen.findByText("Task assigned")).toBeInTheDocument();

    // First click fails with 500 -> does NOT navigate, displays retry banner
    fireEvent.click(
      screen.getByTestId("notifications-page-item-507f1f77bcf86cd799439088"),
    );

    expect(
      await screen.findByTestId("notifications-page-resolve-error-banner"),
    ).toBeInTheDocument();
    expect(routerPushMock).not.toHaveBeenCalled();

    // Click Retry -> succeeds and navigates
    shouldFailResolve = false;
    fireEvent.click(screen.getByTestId("notifications-page-resolve-retry"));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        "/projects/507f1f77bcf86cd799439011/work?taskId=507f1f77bcf86cd799439022",
      );
    });
  });

  it("displays safe state on WorkNotesWorkspace when deep-linked noteId no longer exists", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "?noteId=deleted-note-999",
      },
    });

    vi.mocked(useProjectQuery).mockReturnValue({
      data: {
        id: "project-preview-1",
        organizationId: "507f1f77bcf86cd799439002",
        name: "Project Atlas",
        code: "ATL",
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBy: "507f1f77bcf86cd799439001",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      isPending: false,
      isError: false,
    } as never);

    try {
      renderWithProviders(
        <WorkNotesWorkspace projectId="project-preview-1" />,
      );

      expect(
        await screen.findByTestId("work-note-unavailable-banner"),
      ).toHaveTextContent("Content is no longer available.");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
