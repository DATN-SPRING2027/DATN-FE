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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError, apiClient } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { chatKeys } from "@/lib/queries/chat/useChat";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import ContinuumAiCompanion from "@/components/ai-companion/ContinuumAiCompanion";
import { useChatNavigation } from "@/stores/chat-navigation";
import { useFloatingChatStore } from "@/stores/floating-chat";
import { clearAssistantStateTombstones } from "../assistant-utils";
import { resetChatWsCooldown } from "./chat-shared-helpers";
import FloatingChatDock from "./FloatingChatDock";

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

const routeState = vi.hoisted(() => ({
  pathname: "/projects/507f1f77bcf86cd799439011/work",
}));
const routerPushMock = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => routeState.pathname,
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
  }),
  Link: ({
    href,
    children,
    onClick,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
}));

vi.mock("@/components/ai-companion/WorkReportReminderNotice", () => ({
  default: () => null,
}));
vi.mock("@/components/ai-companion/CompanionProjectPicker", () => ({
  default: () => null,
}));

const sidebarState = vi.hoisted(() => ({
  isHelpOpen: false,
}));

vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({
    ...sidebarState,
    isExpanded: true,
    isHovered: false,
    isMobileOpen: false,
  }),
  useOptionalSidebar: () => sidebarState,
}));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.onopen?.();
      this.onmessage?.({ data: JSON.stringify({ event: "connected" }) });
    });
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 3;
  }
}

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

describe("FloatingChatDock — Facebook-style Mini Chat, Chat Heads & Companion Coexistence", () => {
  const actorId = "507f1f77bcf86cd799439001";
  const orgId = "507f1f77bcf86cd799439002";
  const convId = "507f1f77bcf86cd799439033";

  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    });
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    sidebarState.isHelpOpen = false;
    useFloatingChatStore.getState().reset();
    useChatNavigation.getState().clear();
    resetChatWsCooldown();
    clearAssistantStateTombstones();
    api.mockReset();
    routerPushMock.mockReset();
    routeState.pathname = "/projects/507f1f77bcf86cd799439011/work";

    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: actorId,
        email: "phuc@example.com",
        name: "Phuc Nguyen",
        context: "ORGANIZATION",
        organizationId: orgId,
        roles: ["MEMBER"],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  afterEach(() => {
    clearAssistantStateTombstones();
    vi.unstubAllGlobals();
  });

  it("shows unread count on the bottom-right FAB, opens a mini chat window, sends a message, minimizes to a chat head, and shifts the 3D AI companion beside it", async () => {
    const sampleConversation = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-02T09:00:00.000Z",
      lastMessagePreview: "Ready to review PR #124?",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 2,
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    const messagesList = [
      {
        id: "507f1f77bcf86cd799439044",
        conversationId: convId,
        senderId: "507f1f77bcf86cd799439099",
        senderName: "Lan Tran",
        senderAvatarUrl: null,
        content: "Ready to review PR #124?",
        createdAt: "2026-11-02T09:00:00.000Z",
        editedAt: null,
        deletedAt: null,
        replyToMessageId: null,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
    ];

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-1", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return { data: [sampleConversation], nextCursor: null };
      }
      if (path.startsWith("/chat/candidates")) {
        return {
          data: [
            {
              id: "507f1f77bcf86cd799439088",
              fullName: "Minh Le",
              email: "minh@example.com",
              avatarUrl: null,
              isOnline: true,
            },
          ],
        };
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        return { data: messagesList, nextCursor: null };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        if (init?.method === "PUT") return { ok: true };
        return { content: "", mentionUserIds: [] };
      }
      if (
        path === `/chat/conversations/${convId}/delivered` ||
        path === `/chat/conversations/${convId}/read`
      ) {
        return { ok: true };
      }
      if (
        path === `/chat/conversations/${convId}/messages` &&
        init?.method === "POST"
      ) {
        const body = JSON.parse(String(init.body)) as { content: string };
        const created = {
          id: "507f1f77bcf86cd799439055",
          conversationId: convId,
          senderId: actorId,
          senderName: "Phuc Nguyen",
          senderAvatarUrl: null,
          content: body.content,
          createdAt: "2026-11-02T09:02:00.000Z",
          editedAt: null,
          deletedAt: null,
          replyToMessageId: null,
          replyTo: null,
          attachments: [],
          reactions: [],
        };
        messagesList.push(created);
        return created;
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    renderWithProviders(
      <>
        <FloatingChatDock />
        <ContinuumAiCompanion locale="en" />
      </>,
    );

    // 1. Bottom-right FAB shows unread count, and 3D AI companion sits offset beside it
    expect(
      await screen.findByTestId("floating-chat-total-unread"),
    ).toHaveTextContent("2");
    const aiDock = screen.getByTestId("ai-companion-floating-dock");
    expect(aiDock.className).toContain("sm:end-24");

    // 2. Click FAB -> opens conversation launcher popover
    fireEvent.click(screen.getByTestId("floating-chat-fab"));
    const popover = await screen.findByTestId("floating-chat-launcher-popover");
    expect(within(popover).getByText("Lan Tran")).toBeInTheDocument();
    expect(await within(popover).findByText("Minh Le")).toBeInTheDocument();

    // 3. Select conversation -> opens MiniChatWindow & shifts AI companion further left
    fireEvent.click(screen.getByTestId(`floating-launcher-conv-${convId}`));
    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    expect(
      await within(miniWindow).findByText("Ready to review PR #124?"),
    ).toBeInTheDocument();
    expect(aiDock.className).toContain("sm:end-108");

    // 4. Avatar + Name region links directly to full /chat tab (no dropdown), and Back (<) returns to conversation list
    const openFullLink = within(miniWindow).getByTestId(
      `mini-chat-open-full-${convId}`,
    );
    expect(openFullLink).toHaveAttribute(
      "href",
      `/chat?conversation=${convId}`,
    );
    fireEvent.click(openFullLink);
    expect(useChatNavigation.getState().target).toBeNull();

    fireEvent.click(within(miniWindow).getByTestId(`mini-chat-back-${convId}`));
    expect(
      screen.queryByTestId(`mini-chat-window-${convId}`),
    ).not.toBeInTheDocument();
    const reopenedPopover = await screen.findByTestId(
      "floating-chat-launcher-popover",
    );
    fireEvent.click(
      within(reopenedPopover).getByTestId(`floating-launcher-conv-${convId}`),
    );
    const activeWindow = await screen.findByTestId(
      `mini-chat-window-${convId}`,
    );

    // 5. Send a message right inside MiniChatWindow
    const textarea = await within(activeWindow).findByPlaceholderText(
      "Write a message…",
    );
    fireEvent.change(textarea, { target: { value: "Looks great, merging!" } });
    fireEvent.click(
      within(activeWindow).getByRole("button", { name: "Send message" }),
    );

    expect(
      await within(activeWindow).findByText("Looks great, merging!"),
    ).toBeInTheDocument();

    // 6. Minimize window via horizontal (—) button -> turns into a circular Chat Head on the right rail
    fireEvent.click(
      within(activeWindow).getByRole("button", { name: "Minimize to chat head" }),
    );
    expect(
      screen.queryByTestId(`mini-chat-window-${convId}`),
    ).not.toBeInTheDocument();
    const head = screen.getByTestId(`floating-chat-head-${convId}`);
    expect(head).toBeInTheDocument();
    expect(aiDock.className).toContain("sm:end-24");

    const restoreButton = within(head).getByRole("button", {
      name: "Restore chat with Lan Tran",
    });
    const closeHeadButton = within(head).getByRole("button", {
      name: "Dismiss chat head for Lan Tran",
    });
    restoreButton.focus();
    expect(restoreButton).toHaveFocus();
    expect(closeHeadButton).toHaveClass(
      "group-focus-within:visible",
      "group-focus-within:opacity-100",
    );

    // 7. Click Chat Head -> restores MiniChatWindow, then Close (×) dismisses it completely
    fireEvent.click(restoreButton);
    const restoredWindow = await screen.findByTestId(
      `mini-chat-window-${convId}`,
    );
    expect(restoredWindow).toBeInTheDocument();
    fireEvent.click(
      within(restoredWindow).getByRole("button", {
        name: "Close chat window with Lan Tran",
      }),
    );
    expect(
      screen.queryByTestId(`mini-chat-window-${convId}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`floating-chat-head-${convId}`),
    ).not.toBeInTheDocument();
  });

  it("opens the floating mini chat window in-place when clicking a CHAT notification from another workspace page", async () => {
    const chatNotif = {
      id: "507f1f77bcf86cd799439012",
      recipientId: actorId,
      actorId: "507f1f77bcf86cd799439099",
      organizationId: orgId,
      projectId: null,
      taskId: null,
      noteId: null,
      conversationId: convId,
      type: "CHAT_MENTION",
      title: "Mentioned in chat",
      message: "Lan mentioned you in a conversation.",
      target: {
        kind: "CHAT" as const,
        organizationId: orgId,
        projectId: null,
        taskId: null,
        noteId: null,
        conversationId: convId,
        messageId: "507f1f77bcf86cd799439044",
        url: `/chat?conversation=${convId}&message=507f1f77bcf86cd799439044`,
      },
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/notifications/unread-count") return { count: 1 };
      if (path.startsWith("/notifications?")) {
        return { items: [chatNotif], nextCursor: null, unreadCount: 1 };
      }
      if (
        path === `/notifications/${chatNotif.id}/read` &&
        init?.method === "PATCH"
      ) {
        return { ...chatNotif, readAt: new Date().toISOString() };
      }
      if (path === `/notifications/${chatNotif.id}/resolve`) {
        return {
          available: true,
          reason: "OK",
          message: null,
          target: chatNotif.target,
          url: chatNotif.target.url,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderWithProviders(<NotificationDropdown />);

    fireEvent.click(screen.getByTestId("notification-bell-button"));
    const itemBtn = await screen.findByTestId(
      `notification-item-${chatNotif.id}`,
    );

    await act(async () => {
      fireEvent.click(itemBtn);
    });

    await waitFor(() => {
      expect(useFloatingChatStore.getState().openWindowsByOrg[orgId]).toEqual([
        convId,
      ]);
    });
    expect(
      useFloatingChatStore.getState().highlightedMessageByConv[convId],
    ).toBe("507f1f77bcf86cd799439044");
    expect(
      useFloatingChatStore.getState().contextMessageByConv[convId],
    ).toBe("507f1f77bcf86cd799439044");
    // Stays on current Kanban page instead of pushing to /chat!
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("shares a single WebSocket between FloatingChatDock and NotificationDropdown without duplicate ws-ticket calls", async () => {
    let wsTicketCalls = 0;
    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        wsTicketCalls += 1;
        return { ticket: `ws-ticket-${wsTicketCalls}`, expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return { data: [], nextCursor: null };
      }
      if (path === "/notifications/unread-count") {
        return { count: 0 };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderWithProviders(
      <>
        <NotificationDropdown />
        <FloatingChatDock />
      </>,
    );

    await waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
    expect(wsTicketCalls).toBe(1);
  });

  it("keeps historical message context visible after the 3.2s highlight ring fades and forwards context when opening full chat", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const olderMsgId = "507f1f77bcf86cd799439077";
    const sampleConversation = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-02T09:00:00.000Z",
      lastMessagePreview: "Latest message",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    try {
      api.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path === "/chat/ws-ticket" && init?.method === "POST") {
          return { ticket: "ws-ticket-ctx", expiresInSeconds: 60 };
        }
        if (path.startsWith("/chat/conversations?")) {
          return { data: [sampleConversation], nextCursor: null };
        }
        if (path === `/chat/conversations/${convId}/messages?limit=50`) {
          return {
            data: [
              {
                id: "507f1f77bcf86cd799439090",
                conversationId: convId,
                senderId: "507f1f77bcf86cd799439099",
                senderName: "Lan Tran",
                senderAvatarUrl: null,
                content: "Latest message",
                createdAt: "2026-11-02T09:00:00.000Z",
                editedAt: null,
                deletedAt: null,
                replyToMessageId: null,
                replyTo: null,
                attachments: [],
                reactions: [],
              },
            ],
            nextCursor: "cursor-1",
          };
        }
        if (
          path ===
          `/chat/conversations/${convId}/messages?limit=50&aroundMessageId=${olderMsgId}`
        ) {
          return {
            data: [
              {
                id: olderMsgId,
                conversationId: convId,
                senderId: "507f1f77bcf86cd799439099",
                senderName: "Lan Tran",
                senderAvatarUrl: null,
                content: "Pinned older spec decision",
                createdAt: "2026-10-01T09:00:00.000Z",
                editedAt: null,
                deletedAt: null,
                replyToMessageId: null,
                replyTo: null,
                attachments: [],
                reactions: [],
              },
            ],
            nextCursor: null,
          };
        }
        if (path === `/chat/conversations/${convId}/draft`) {
          return { content: "", mentionUserIds: [] };
        }
        if (
          path === `/chat/conversations/${convId}/delivered` ||
          path === `/chat/conversations/${convId}/read`
        ) {
          return { ok: true };
        }
        throw new Error(`Unexpected path: ${path}`);
      });

      useFloatingChatStore.getState().openConversation(orgId, convId, {
        messageId: olderMsgId,
      });

      renderWithProviders(<FloatingChatDock />);

      const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
      expect(
        await within(miniWindow).findByText("Pinned older spec decision"),
      ).toBeInTheDocument();
      expect(
        within(miniWindow).getByTestId(`mini-chat-context-banner-${convId}`),
      ).toBeInTheDocument();

      // Advance past the 3200ms highlight timer: highlight fades, but context stays mounted!
      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      expect(
        useFloatingChatStore.getState().highlightedMessageByConv[convId],
      ).toBeUndefined();
      expect(
        within(miniWindow).getByText("Pinned older spec decision"),
      ).toBeInTheDocument();
      expect(
        within(miniWindow).getByTestId(`mini-chat-context-banner-${convId}`),
      ).toBeInTheDocument();

      const openFullLink = within(miniWindow).getByTestId(
        `mini-chat-open-full-${convId}`,
      );
      expect(openFullLink).toHaveAttribute(
        "href",
        `/chat?conversation=${convId}&message=${olderMsgId}`,
      );
      fireEvent.click(openFullLink);
      expect(useChatNavigation.getState().target).toEqual({
        conversationId: convId,
        messageId: olderMsgId,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps open windows on <1024px viewports, hides mobile FAB rail when a window is open, and resets AI companion offset on org switch", async () => {
    const conv2Id = "507f1f77bcf86cd799439034";
    const org2Id = "507f1f77bcf86cd799439098";

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 800,
    });

    const makeConv = (id: string, peerName: string, peerId: string) => ({
      id,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-02T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: peerId,
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: peerId,
          displayName: peerName,
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    });

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-mobile", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return {
          data: [
            makeConv(convId, "Lan Tran", "507f1f77bcf86cd799439099"),
            makeConv(conv2Id, "Minh Le", "507f1f77bcf86cd799439088"),
          ],
          nextCursor: null,
        };
      }
      if (path.endsWith("/messages?limit=50")) {
        return { data: [], nextCursor: null };
      }
      if (path.endsWith("/draft")) {
        return { content: "", mentionUserIds: [] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    useFloatingChatStore.getState().openConversation(orgId, conv2Id);

    const view = renderWithProviders(
      <>
        <FloatingChatDock />
        <ContinuumAiCompanion locale="en" />
      </>,
    );

    // On 800px (<1024px), only 1 window stays mounted; the older one overflows into a chat head!
    expect(
      await screen.findByTestId(`mini-chat-window-${conv2Id}`),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByTestId(`mini-chat-window-${convId}`),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`floating-chat-head-${convId}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("floating-chat-heads-rail").className,
    ).toContain("hidden sm:flex");

    const aiDock = screen.getByTestId("ai-companion-floating-dock");
    expect(aiDock.className).toContain("sm:end-108");

    // Switch organization -> activeOrgId syncs to org2Id (0 open windows), so AI companion resets to sm:end-24!
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: actorId,
        email: "phuc@example.com",
        name: "Phuc Nguyen",
        context: "ORGANIZATION",
        organizationId: org2Id,
        roles: ["MEMBER"],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    } as never);

    view.rerender(
      <QueryClientProvider client={view.client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <FloatingChatDock />
          <ContinuumAiCompanion locale="en" />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(aiDock.className).toContain("sm:end-24");
    });
  });

  it("preserves unsent draft text immediately when minimizing a mini chat window before debounce completes and restoring it", async () => {
    let serverDraft = "";
    const sampleConv = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-02T09:00:00.000Z",
      lastMessagePreview: "Hello",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-draft", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return { data: [sampleConv], nextCursor: null };
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        return { data: [], nextCursor: null };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body ?? "{}")) as {
            content?: string;
          };
          serverDraft = body.content ?? "";
          return { content: serverDraft, mentionUserIds: [] };
        }
        return { content: serverDraft, mentionUserIds: [] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    renderWithProviders(<FloatingChatDock />);

    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    const input = await within(miniWindow).findByPlaceholderText(
      "Write a message…",
    );
    await waitFor(() => expect(input).not.toBeDisabled());

    fireEvent.change(input, {
      target: { value: "Unsent draft before 500ms debounce" },
    });

    // Immediately minimize before the 500ms autosave timer fires
    fireEvent.click(
      within(miniWindow).getByRole("button", {
        name: "Minimize to chat head",
      }),
    );

    const head = await screen.findByTestId(`floating-chat-head-${convId}`);
    fireEvent.click(
      within(head).getByRole("button", { name: "Restore chat with Lan Tran" }),
    );

    const restoredWindow = await screen.findByTestId(
      `mini-chat-window-${convId}`,
    );
    const restoredInput = await within(restoredWindow).findByPlaceholderText(
      "Write a message…",
    );
    await waitFor(() => {
      expect(restoredInput).toHaveValue("Unsent draft before 500ms debounce");
    });
  });

  it("hides minimized heads while launcher is open, prevents presence.watch loops on snapshot, and avoids false empty search flashes", async () => {
    const candidateId = "507f1f77bcf86cd799439088";
    const peerId = "507f1f77bcf86cd799439099";
    let resolveCandidateSearch: ((value: unknown) => void) | null = null;

    const sampleConv = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-02T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: peerId,
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: peerId,
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: false,
        },
      ],
    };

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-presence", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        if (path.includes("search=Member")) {
          return { data: [], nextCursor: null };
        }
        return { data: [sampleConv], nextCursor: null };
      }
      if (path.startsWith("/chat/candidates")) {
        if (path.includes("search=Member")) {
          return await new Promise((resolve) => {
            resolveCandidateSearch = resolve;
          });
        }
        return {
          data: [
            {
              id: candidateId,
              fullName: "Pham Anh Member 1",
              email: "member1@continuum.ai",
              avatarUrl: null,
              isOnline: false,
            },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    useFloatingChatStore.getState().minimizeWindow(orgId, convId);

    renderWithProviders(
      <>
        <FloatingChatDock />
        <ContinuumAiCompanion locale="en" />
      </>,
    );

    expect(
      await screen.findByTestId(`floating-chat-head-${convId}`),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
    const socket = FakeWebSocket.instances[0]!;

    await waitFor(() => {
      const watchFrames = socket.sent.filter((frame) =>
        frame.includes('"presence.watch"'),
      );
      expect(watchFrames).toHaveLength(1);
    });

    // Server sends presence.snapshot -> must NOT re-trigger presence.watch in a loop!
    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "presence.snapshot",
          data: { data: [{ userId: peerId, isOnline: true }] },
        }),
      });
    });
    expect(
      socket.sent.filter((frame) => frame.includes('"presence.watch"')),
    ).toHaveLength(1);

    // Open Launcher -> minimized chat head hides cleanly and AI Companion shifts to sm:end-96
    fireEvent.click(screen.getByTestId("floating-chat-fab"));
    const launcher = await screen.findByTestId(
      "floating-chat-launcher-popover",
    );
    expect(
      screen.queryByTestId(`floating-chat-head-${convId}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("ai-companion-floating-dock").className,
    ).toContain("sm:end-96");

    // Once Launcher fetches candidates, candidateId is added to presence.watch!
    await waitFor(() => {
      const watchFrames = socket.sent.filter((frame) =>
        frame.includes('"presence.watch"'),
      );
      expect(watchFrames.at(-1)).toContain(candidateId);
    });

    // Typing "Member" shows Loading… while candidate search is pending instead of "No conversations match your search."
    const searchInput = within(launcher).getByRole("textbox", {
      name: "Search conversations",
    });
    fireEvent.change(searchInput, { target: { value: "Member" } });

    await waitFor(() => {
      expect(resolveCandidateSearch).not.toBeNull();
    });
    expect(
      within(launcher).queryByText("No conversations match your search."),
    ).not.toBeInTheDocument();
    expect(within(launcher).getByText("Loading…")).toBeInTheDocument();

    await act(async () => {
      resolveCandidateSearch?.({
        data: [
          {
            id: candidateId,
            fullName: "Pham Anh Member 1",
            email: "member1@continuum.ai",
            avatarUrl: null,
            isOnline: true,
          },
        ],
      });
    });

    expect(
      await within(launcher).findByText("Pham Anh Member 1"),
    ).toBeInTheDocument();
  });

  it("surfaces overflow open windows as chat heads when Help drawer is open and swaps visible window when clicked", async () => {
    const conv1 = convId;
    const conv2 = "507f1f77bcf86cd799439022";
    const sampleConvs = [
      {
        id: conv1,
        type: "DIRECT" as const,
        title: null,
        createdBy: actorId,
        lastMessageAt: "2026-11-02T09:00:00.000Z",
        lastMessagePreview: "Hi 1",
        lastMessageSenderId: "507f1f77bcf86cd799439099",
        lastReadMessageId: null,
        lastReadAt: null,
        unreadCount: 0,
        members: [
          {
            userId: actorId,
            displayName: "Phuc Nguyen",
            avatarUrl: null,
            role: "MEMBER" as const,
            lastReadMessageId: null,
            lastReadAt: null,
            lastDeliveredMessageId: null,
            lastDeliveredAt: null,
            isOnline: true,
          },
          {
            userId: "507f1f77bcf86cd799439099",
            displayName: "Lan Tran",
            avatarUrl: null,
            role: "MEMBER" as const,
            lastReadMessageId: null,
            lastReadAt: null,
            lastDeliveredMessageId: null,
            lastDeliveredAt: null,
            isOnline: true,
          },
        ],
      },
      {
        id: conv2,
        type: "DIRECT" as const,
        title: null,
        createdBy: actorId,
        lastMessageAt: "2026-11-02T10:00:00.000Z",
        lastMessagePreview: "Hi 2",
        lastMessageSenderId: "507f1f77bcf86cd799439088",
        lastReadMessageId: null,
        lastReadAt: null,
        unreadCount: 0,
        members: [
          {
            userId: actorId,
            displayName: "Phuc Nguyen",
            avatarUrl: null,
            role: "MEMBER" as const,
            lastReadMessageId: null,
            lastReadAt: null,
            lastDeliveredMessageId: null,
            lastDeliveredAt: null,
            isOnline: true,
          },
          {
            userId: "507f1f77bcf86cd799439088",
            displayName: "Bao Pham",
            avatarUrl: null,
            role: "MEMBER" as const,
            lastReadMessageId: null,
            lastReadAt: null,
            lastDeliveredMessageId: null,
            lastDeliveredAt: null,
            isOnline: true,
          },
        ],
      },
    ];

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-help", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return { data: sampleConvs, nextCursor: null };
      }
      if (path.includes("/messages?limit=50")) {
        return { data: [], nextCursor: null };
      }
      if (path.includes("/draft")) {
        return { content: "", mentionUserIds: [] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    sidebarState.isHelpOpen = true;
    useFloatingChatStore.getState().openConversation(orgId, conv1);
    useFloatingChatStore.getState().openConversation(orgId, conv2);

    renderWithProviders(<FloatingChatDock />);

    // conv2 was opened most recently, so visible window is conv2
    expect(
      await screen.findByTestId(`mini-chat-window-${conv2}`),
    ).toBeInTheDocument();
    // conv1 is the overflow open window, rendered as a minimized chat head!
    expect(
      await screen.findByTestId(`floating-chat-head-${conv1}`),
    ).toBeInTheDocument();

    // Clicking conv1 chat head swaps it to the visible mini window and makes conv2 the chat head
    const head1 = screen.getByTestId(`floating-chat-head-${conv1}`);
    fireEvent.click(
      within(head1).getByRole("button", { name: "Restore chat with Lan Tran" }),
    );

    expect(
      await screen.findByTestId(`mini-chat-window-${conv1}`),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(`floating-chat-head-${conv2}`),
    ).toBeInTheDocument();
  });

  it("supports @continuumAI mention, WS assistant.status, source mutation invalidation, off-page jump, and reconnect reconciliation in MiniChatWindow", async () => {
    const sampleConv = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-28T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      capabilities: { dmAssistantEnabled: true },
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    const triggerId = "507f1f77bcf86cd799439061";
    const aiReplyId = "507f1f77bcf86cd799439062";
    const oldSourceId = "507f1f77bcf86cd799439063";
    let sentBody: Record<string, unknown> | null = null;
    let messagesFetchCount = 0;

    let serverMessages: Record<string, unknown>[] = [
      {
        id: triggerId,
        conversationId: convId,
        senderId: actorId,
        senderName: "Phuc Nguyen",
        senderAvatarUrl: null,
        content: "@continuumAI Tóm tắt quyết định hôm qua",
        createdAt: "2026-11-28T09:00:00.000Z",
        assistantState: {
          jobId: "job-mini-1",
          status: "PENDING",
          failureCode: null,
          responseMessageId: null,
          updatedAt: "2026-11-28T09:00:00.000Z",
        },
        editedAt: null,
        deletedAt: null,
        replyToMessageId: null,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
    ];

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-mini-ai", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return {
          data: [sampleConv],
          nextCursor: null,
          capabilities: { dmAssistantEnabled: true },
        };
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        messagesFetchCount += 1;
        return { data: serverMessages, nextCursor: null };
      }
      if (
        path ===
        `/chat/conversations/${convId}/messages?limit=50&aroundMessageId=${oldSourceId}`
      ) {
        return {
          data: [
            {
              id: oldSourceId,
              conversationId: convId,
              senderId: "507f1f77bcf86cd799439099",
              senderName: "Lan Tran",
              senderAvatarUrl: null,
              content: "Chốt dời release sang thứ Hai và cập nhật changelog.",
              createdAt: "2026-11-20T09:00:00.000Z",
              editedAt: null,
              deletedAt: null,
              replyToMessageId: null,
              replyTo: null,
              attachments: [],
              reactions: [],
            },
          ],
          nextCursor: null,
        };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        if (init?.method === "PUT") return { ok: true };
        return { content: "", mentionUserIds: [], assistantMention: false };
      }
      if (
        path === `/chat/conversations/${convId}/delivered` ||
        path === `/chat/conversations/${convId}/read`
      ) {
        return { ok: true };
      }
      if (
        path === `/chat/conversations/${convId}/messages` &&
        init?.method === "POST"
      ) {
        sentBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return {
          id: "507f1f77bcf86cd799439069",
          conversationId: convId,
          senderId: actorId,
          senderName: "Phuc Nguyen",
          senderAvatarUrl: null,
          content: sentBody.content,
          createdAt: "2026-11-28T09:05:00.000Z",
          editedAt: null,
          deletedAt: null,
          replyToMessageId: null,
          replyTo: null,
          attachments: [],
          reactions: [],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    renderWithProviders(<FloatingChatDock />);

    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    expect(
      await within(miniWindow).findByTestId("assistant-trigger-status-pending"),
    ).toBeInTheDocument();

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]!;

    // 1. WS assistant.status updates trigger to PROCESSING then COMPLETED (fetching AI answer)
    serverMessages = [
      {
        ...serverMessages[0]!,
        assistantState: {
          jobId: "job-mini-1",
          status: "COMPLETED",
          failureCode: null,
          responseMessageId: aiReplyId,
          updatedAt: "2026-11-28T09:00:05.000Z",
        },
      },
      {
        id: aiReplyId,
        conversationId: convId,
        senderId: "assistant:continuum_ai",
        senderName: "Continuum AI",
        senderAvatarUrl: null,
        authorType: "ASSISTANT",
        triggerMessageId: triggerId,
        assistantStatus: "COMPLETED",
        assistantFailureCode: null,
        assistantMeta: {
          handle: "continuumAI",
          queryMode: "TIME_WINDOW",
          partialCoverage: false,
          coverageNote: null,
          sourceState: "FRESH",
        },
        sourceReferences: [
          {
            refId: "M1",
            messageId: oldSourceId,
            senderName: "Lan Tran",
            createdAt: "2026-11-20T09:00:00.000Z",
            quoteSnippet: "Chốt dời release sang thứ Hai.",
            status: "ACTIVE",
          },
        ],
        content: "Hai người đã chốt dời release sang thứ Hai [M1].",
        createdAt: "2026-11-28T09:00:05.000Z",
        editedAt: null,
        deletedAt: null,
        replyToMessageId: triggerId,
        replyTo: null,
        attachments: [],
        reactions: [],
      },
    ];

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "assistant.status",
          data: {
            conversationId: convId,
            triggerMessageId: triggerId,
            jobId: "job-mini-1",
            status: "COMPLETED",
            failureCode: null,
            responseMessageId: aiReplyId,
            updatedAt: "2026-11-28T09:00:05.000Z",
          },
        }),
      });
    });

    expect(
      await within(miniWindow).findByTestId("assistant-message-card"),
    ).toBeInTheDocument();

    // 2. Opening the evidence dropdown & clicking off-page source chip opens aroundMessageId context inside MiniChatWindow
    fireEvent.click(
      within(miniWindow).getByTestId("assistant-sources-toggle"),
    );
    fireEvent.click(
      within(miniWindow).getByTestId("assistant-source-chip-M1"),
    );
    expect(
      await within(miniWindow).findByTestId(
        `mini-chat-context-banner-${convId}`,
      ),
    ).toBeInTheDocument();
    expect(
      await within(miniWindow).findByText(
        "Chốt dời release sang thứ Hai và cập nhật changelog.",
      ),
    ).toBeInTheDocument();

    // Exit context & simulate WS message.deleted -> source badge updates to "Source deleted" and chip disables!
    fireEvent.click(
      within(miniWindow).getByRole("button", {
        name: "Back to latest messages",
      }),
    );
    serverMessages = [
      serverMessages[0]!,
      {
        ...serverMessages[1]!,
        assistantMeta: {
          handle: "continuumAI",
          queryMode: "TIME_WINDOW",
          partialCoverage: false,
          coverageNote: null,
          sourceState: "HAS_DELETED",
        },
        sourceReferences: [
          {
            refId: "M1",
            messageId: oldSourceId,
            senderName: "Lan Tran",
            createdAt: "2026-11-20T09:00:00.000Z",
            quoteSnippet: "",
            status: "DELETED",
          },
        ],
      },
    ];

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "message.deleted",
          data: {
            id: oldSourceId,
            conversationId: convId,
            senderId: "507f1f77bcf86cd799439099",
            senderName: "Lan Tran",
            senderAvatarUrl: null,
            content: "",
            createdAt: "2026-11-20T09:00:00.000Z",
            editedAt: null,
            deletedAt: "2026-11-28T09:01:00.000Z",
            replyToMessageId: null,
            replyTo: null,
            attachments: [],
            reactions: [],
          },
        }),
      });
    });

    expect(
      await within(miniWindow).findByTestId("assistant-source-deleted-badge"),
    ).toBeInTheDocument();
    const deletedToggle = within(miniWindow).getByTestId(
      "assistant-sources-toggle",
    );
    if (deletedToggle.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(deletedToggle);
    }
    expect(
      within(miniWindow).getByTestId("assistant-source-chip-M1"),
    ).toBeDisabled();

    // 3. Reconnecting WS invalidates open mini chat messages for reconciliation
    const fetchesBeforeReconnect = messagesFetchCount;
    await act(async () => {
      socket.onmessage?.({ data: JSON.stringify({ event: "connected" }) });
    });
    await waitFor(() =>
      expect(messagesFetchCount).toBeGreaterThan(fetchesBeforeReconnect),
    );

    // 4. Selecting @continuumAI in MiniChatWindow composer sends structured assistantMention
    const input = await within(miniWindow).findByPlaceholderText(
      "Write a message…",
    );
    fireEvent.change(input, { target: { value: "@cont" } });
    fireEvent.click(
      within(miniWindow).getByTestId("mention-option-continuum-ai"),
    );
    fireEvent.change(input, {
      target: { value: "@continuumAI Ai phụ trách PAY-123?" },
    });
    fireEvent.click(
      within(miniWindow).getByRole("button", { name: "Send message" }),
    );
    await waitFor(() =>
      expect(sentBody).toMatchObject({
        content: "@continuumAI Ai phụ trách PAY-123?",
        assistantMention: {
          handle: "continuumAI",
          query: "Ai phụ trách PAY-123?",
          timezone: expect.any(String),
        },
      }),
    );
  });

  it("enforces monotonic assistantState against late WS PENDING and terminal WS events arriving before POST resolves in MiniChatWindow", async () => {
    const sampleConv = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-28T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      capabilities: { dmAssistantEnabled: true },
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    const triggerId = "507f1f77bcf86cd799439161";
    const aiReplyId = "507f1f77bcf86cd799439162";
    const raceTriggerId = "507f1f77bcf86cd799439163";
    let resolvePost!: (value: unknown) => void;

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-mini-mono", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return {
          data: [sampleConv],
          nextCursor: null,
          capabilities: { dmAssistantEnabled: true },
        };
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        return {
          data: [
            {
              id: triggerId,
              conversationId: convId,
              senderId: actorId,
              senderName: "Phuc Nguyen",
              senderAvatarUrl: null,
              content: "@continuumAI Status",
              createdAt: "2026-11-28T09:00:00.000Z",
              assistantState: {
                jobId: "job-mini-mono-1",
                status: "PROCESSING",
                failureCode: null,
                responseMessageId: null,
                updatedAt: "2026-11-28T09:00:01.000Z",
              },
              editedAt: null,
              deletedAt: null,
              replyToMessageId: null,
              replyTo: null,
              attachments: [],
              reactions: [],
            },
            {
              id: aiReplyId,
              conversationId: convId,
              senderId: "assistant:continuum_ai",
              senderName: "Continuum AI",
              senderAvatarUrl: null,
              authorType: "ASSISTANT",
              triggerMessageId: triggerId,
              assistantStatus: "COMPLETED",
              assistantFailureCode: null,
              assistantMeta: {
                handle: "continuumAI",
                queryMode: "KEYWORD",
                partialCoverage: false,
                coverageNote: null,
                sourceState: "FRESH",
              },
              sourceReferences: [],
              content: "Done.",
              createdAt: "2026-11-28T09:00:05.000Z",
              editedAt: null,
              deletedAt: null,
              replyToMessageId: triggerId,
              replyTo: null,
              attachments: [],
              reactions: [],
            },
          ],
          nextCursor: null,
        };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        if (init?.method === "PUT") return { ok: true };
        return { content: "", mentionUserIds: [], assistantMention: false };
      }
      if (
        path === `/chat/conversations/${convId}/delivered` ||
        path === `/chat/conversations/${convId}/read`
      ) {
        return { ok: true };
      }
      if (
        path === `/chat/conversations/${convId}/messages` &&
        init?.method === "POST"
      ) {
        return await new Promise((resolve) => {
          resolvePost = resolve;
        });
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    renderWithProviders(<FloatingChatDock />);

    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    expect(
      await within(miniWindow).findByTestId(
        "assistant-trigger-status-processing",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]!;

    // (a) WS COMPLETED -> late out-of-order WS PENDING stays COMPLETED
    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "assistant.status",
          data: {
            conversationId: convId,
            triggerMessageId: triggerId,
            jobId: "job-mini-mono-1",
            status: "COMPLETED",
            failureCode: null,
            responseMessageId: aiReplyId,
            updatedAt: "2026-11-28T09:00:05.000Z",
          },
        }),
      });
    });
    await waitFor(() =>
      expect(
        within(miniWindow).queryByTestId("assistant-trigger-status-processing"),
      ).not.toBeInTheDocument(),
    );

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "assistant.status",
          data: {
            conversationId: convId,
            triggerMessageId: triggerId,
            jobId: "job-mini-mono-1",
            status: "PENDING",
            failureCode: null,
            responseMessageId: null,
            updatedAt: "2026-11-28T09:00:00.000Z",
          },
        }),
      });
    });
    expect(
      within(miniWindow).queryByTestId("assistant-trigger-status-pending"),
    ).not.toBeInTheDocument();

    // (b) WS CANCELLED arriving BEFORE POST /messages resolves keeps trigger terminal
    fireEvent.click(
      await within(miniWindow).findByTestId("chat-composer-ai-trigger"),
    );
    const input = within(miniWindow).getByPlaceholderText("Write a message…");
    fireEvent.change(input, {
      target: { value: "@continuumAI Mini race check" },
    });
    fireEvent.click(
      within(miniWindow).getByRole("button", { name: "Send message" }),
    );
    await waitFor(() => expect(resolvePost).toBeDefined());

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "assistant.status",
          data: {
            conversationId: convId,
            triggerMessageId: raceTriggerId,
            jobId: "job-mini-race",
            status: "CANCELLED",
            failureCode: "SOURCE_CHANGED",
            responseMessageId: null,
            updatedAt: "2026-11-28T09:02:04.000Z",
          },
        }),
      });
    });

    await act(async () => {
      resolvePost({
        id: raceTriggerId,
        conversationId: convId,
        senderId: actorId,
        senderName: "Phuc Nguyen",
        senderAvatarUrl: null,
        content: "@continuumAI Mini race check",
        createdAt: "2026-11-28T09:02:00.000Z",
        assistantState: {
          jobId: "job-mini-race",
          status: "PENDING",
          failureCode: null,
          responseMessageId: null,
          updatedAt: "2026-11-28T09:02:00.000Z",
        },
        editedAt: null,
        deletedAt: null,
        replyToMessageId: null,
        replyTo: null,
        attachments: [],
        reactions: [],
      });
    });

    expect(
      await within(miniWindow).findByTestId(
        "assistant-trigger-status-cancelled-source_changed",
      ),
    ).toBeInTheDocument();
    expect(
      within(miniWindow).queryByTestId("assistant-trigger-status-pending"),
    ).not.toBeInTheDocument();
  });

  it("reuses retry clientMessageId across network errors, ignores unrelated composer reply draft, and invalidates capabilities on CHAT_AI_NOT_ENABLED in MiniChatWindow", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    let dmAssistantEnabled = true;
    const makeSampleConv = () => ({
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-28T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      capabilities: { dmAssistantEnabled },
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    });

    const unrelatedPeerMsgId = "507f1f77bcf86cd799439201";
    const failedTriggerId = "507f1f77bcf86cd799439202";
    const sentPayloads: Array<{
      clientMessageId: string;
      replyToMessageId?: string;
    }> = [];
    let postCallCount = 0;
    let convFetchCount = 0;

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-mini-retry", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        convFetchCount += 1;
        return {
          data: [makeSampleConv()],
          nextCursor: null,
          capabilities: { dmAssistantEnabled },
        };
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        return {
          data: [
            {
              id: unrelatedPeerMsgId,
              conversationId: convId,
              senderId: "507f1f77bcf86cd799439099",
              senderName: "Lan Tran",
              senderAvatarUrl: null,
              content: "Unrelated peer message for composer reply",
              createdAt: "2026-11-28T09:00:00.000Z",
              editedAt: null,
              deletedAt: null,
              replyToMessageId: null,
              replyTo: null,
              attachments: [],
              reactions: [],
            },
            {
              id: failedTriggerId,
              conversationId: convId,
              senderId: actorId,
              senderName: "Phuc Nguyen",
              senderAvatarUrl: null,
              content: "@continuumAI Summarize decisions",
              createdAt: "2026-11-28T09:01:00.000Z",
              assistantMention: {
                handle: "continuumAI",
                query: "Summarize decisions",
                timezone: "Asia/Ho_Chi_Minh",
              },
              assistantState: {
                jobId: "job-mini-fail",
                status: "FAILED",
                failureCode: "SERVICE_UNAVAILABLE",
                responseMessageId: null,
                updatedAt: "2026-11-28T09:01:05.000Z",
              },
              editedAt: null,
              deletedAt: null,
              replyToMessageId: null,
              replyTo: null,
              attachments: [],
              reactions: [],
            },
          ],
          nextCursor: null,
        };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        if (init?.method === "PUT") return { ok: true };
        return { content: "", mentionUserIds: [], assistantMention: false };
      }
      if (
        path === `/chat/conversations/${convId}/delivered` ||
        path === `/chat/conversations/${convId}/read`
      ) {
        return { ok: true };
      }
      if (
        path === `/chat/conversations/${convId}/messages` &&
        init?.method === "POST"
      ) {
        postCallCount += 1;
        const body = JSON.parse(String(init.body)) as {
          clientMessageId: string;
          replyToMessageId?: string;
        };
        sentPayloads.push({
          clientMessageId: body.clientMessageId,
          replyToMessageId: body.replyToMessageId,
        });
        if (postCallCount === 1) {
          throw new Error("Network failure");
        }
        if (postCallCount === 2) {
          return {
            id: "507f1f77bcf86cd799439209",
            conversationId: convId,
            senderId: actorId,
            senderName: "Phuc Nguyen",
            senderAvatarUrl: null,
            content: "@continuumAI Summarize decisions",
            createdAt: "2026-11-28T09:02:00.000Z",
            assistantState: {
              jobId: "job-mini-retried",
              status: "PENDING",
              failureCode: null,
              responseMessageId: null,
              updatedAt: "2026-11-28T09:02:00.000Z",
            },
            editedAt: null,
            deletedAt: null,
            replyToMessageId: null,
            replyTo: null,
            attachments: [],
            reactions: [],
          };
        }
        dmAssistantEnabled = false;
        throw new ApiError(403, "CHAT_AI_NOT_ENABLED", "Disabled");
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    renderWithProviders(<FloatingChatDock />);

    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    expect(
      await within(miniWindow).findByText(
        "Unrelated peer message for composer reply",
      ),
    ).toBeInTheDocument();

    // Start replying to the unrelated peer message in the draft composer
    const peerBubble = miniWindow.querySelector(
      `[data-message-id="${unrelatedPeerMsgId}"]`,
    ) as HTMLElement;
    fireEvent.click(
      within(peerBubble).getByRole("button", { name: "Message actions" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
    expect(
      await within(miniWindow).findByText("Replying to Lan Tran"),
    ).toBeInTheDocument();

    // Retry failed AI trigger -> 1st fails (network), 2nd succeeds with IDENTICAL clientMessageId and NO draft replyToMessageId!
    const retryBtn = within(miniWindow).getByRole("button", {
      name: messages.chat.assistantRetryAction,
    });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(sentPayloads).toHaveLength(1));

    fireEvent.click(retryBtn);
    await waitFor(() => expect(sentPayloads).toHaveLength(2));
    expect(sentPayloads[1]!.clientMessageId).toBe(
      sentPayloads[0]!.clientMessageId,
    );
    expect(sentPayloads[0]!.replyToMessageId).toBeUndefined();
    expect(sentPayloads[1]!.replyToMessageId).toBeUndefined();
    // Unrelated composer reply banner stays intact!
    expect(
      within(miniWindow).getByText("Replying to Lan Tran"),
    ).toBeInTheDocument();

    // CHAT_AI_NOT_ENABLED on a subsequent assistant send immediately invalidates conversations and hides @continuumAI
    const fetchesBeforeDisabled = convFetchCount;
    fireEvent.click(
      within(miniWindow).getByTestId("chat-composer-ai-trigger"),
    );
    const input = within(miniWindow).getByPlaceholderText("Write a message…");
    fireEvent.change(input, {
      target: { value: "@continuumAI Still enabled?" },
    });
    fireEvent.click(
      within(miniWindow).getByRole("button", { name: "Send message" }),
    );

    await waitFor(() =>
      expect(convFetchCount).toBeGreaterThan(fetchesBeforeDisabled),
    );
    await waitFor(() =>
      expect(
        within(miniWindow).queryByTestId("chat-composer-ai-trigger"),
      ).not.toBeInTheDocument(),
    );

    consoleErrorSpy.mockRestore();
  });

  it("does not resurrect deleted trigger or overwrite newer edit when late POST resolves in MiniChatWindow", async () => {
    const sampleConv = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-28T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      capabilities: { dmAssistantEnabled: true },
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    const deleteRaceId = "507f1f77bcf86cd799439301";
    const editRaceId = "507f1f77bcf86cd799439302";
    let serverMessages: Record<string, unknown>[] = [];
    const pendingPosts: Array<(value: unknown) => void> = [];

    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-mini-race-del-edit", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        return {
          data: [sampleConv],
          nextCursor: null,
          capabilities: { dmAssistantEnabled: true },
        };
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        return { data: serverMessages, nextCursor: null };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        if (init?.method === "PUT") return { ok: true };
        return { content: "", mentionUserIds: [], assistantMention: false };
      }
      if (
        path === `/chat/conversations/${convId}/delivered` ||
        path === `/chat/conversations/${convId}/read`
      ) {
        return { ok: true };
      }
      if (
        path === `/chat/conversations/${convId}/messages` &&
        init?.method === "POST"
      ) {
        return await new Promise((resolve) => {
          pendingPosts.push(resolve);
        });
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    useFloatingChatStore.getState().openConversation(orgId, convId);
    const { client } = renderWithProviders(<FloatingChatDock />);

    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    const input = await within(miniWindow).findByPlaceholderText(
      "Write a message…",
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]!;

    // (a) WS message.deleted arrives before late POST resolves
    fireEvent.change(input, {
      target: { value: "@continuumAI Mini delete race" },
    });
    fireEvent.click(
      within(miniWindow).getByRole("button", { name: "Send message" }),
    );
    await waitFor(() => expect(pendingPosts).toHaveLength(1));

    const deletedPayload = {
      id: deleteRaceId,
      conversationId: convId,
      senderId: actorId,
      senderName: "Phuc Nguyen",
      senderAvatarUrl: null,
      content: "",
      createdAt: "2026-11-28T09:02:00.000Z",
      editedAt: null,
      deletedAt: "2026-11-28T09:02:03.000Z",
      replyToMessageId: null,
      replyTo: null,
      attachments: [],
      reactions: [],
    };
    serverMessages = [deletedPayload];

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "message.deleted",
          data: deletedPayload,
        }),
      });
    });

    await act(async () => {
      pendingPosts[0]!({
        id: deleteRaceId,
        conversationId: convId,
        senderId: actorId,
        senderName: "Phuc Nguyen",
        senderAvatarUrl: null,
        content: "@continuumAI Mini delete race",
        createdAt: "2026-11-28T09:02:00.000Z",
        assistantState: {
          jobId: "job-mini-del",
          status: "PENDING",
          failureCode: null,
          responseMessageId: null,
          updatedAt: "2026-11-28T09:02:00.000Z",
        },
        editedAt: null,
        deletedAt: null,
        replyToMessageId: null,
        replyTo: null,
        attachments: [],
        reactions: [],
      });
    });

    expect(
      await within(miniWindow).findByText(messages.chat.messageDeleted),
    ).toBeInTheDocument();
    expect(
      within(miniWindow).queryByText("@continuumAI Mini delete race"),
    ).not.toBeInTheDocument();
    expect(
      within(miniWindow).queryByTestId("assistant-trigger-status-pending"),
    ).not.toBeInTheDocument();
    const cachedDel = (
      client.getQueryData<{ data: Array<Record<string, unknown>> }>(
        chatKeys.messages(orgId, convId),
      )?.data ?? []
    ).find((m) => m.id === deleteRaceId);
    expect(cachedDel?.deletedAt).toBe("2026-11-28T09:02:03.000Z");
    expect(cachedDel?.content).toBe("");
    expect(cachedDel?.assistantState).toBeUndefined();

    // (b) WS message.updated arrives before late POST resolves
    fireEvent.change(input, {
      target: { value: "@continuumAI Mini edit original" },
    });
    fireEvent.click(
      within(miniWindow).getByRole("button", { name: "Send message" }),
    );
    await waitFor(() => expect(pendingPosts).toHaveLength(2));

    const editedPayload = {
      id: editRaceId,
      conversationId: convId,
      senderId: actorId,
      senderName: "Phuc Nguyen",
      senderAvatarUrl: null,
      content: "Mini edited content before POST resolved",
      createdAt: "2026-11-28T09:03:00.000Z",
      contentVersion: 2,
      isEdited: true,
      editedAt: "2026-11-28T09:03:04.000Z",
      deletedAt: null,
      replyToMessageId: null,
      replyTo: null,
      attachments: [],
      reactions: [],
    };
    serverMessages = [deletedPayload, editedPayload];

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          event: "message.updated",
          data: editedPayload,
        }),
      });
    });

    await act(async () => {
      pendingPosts[1]!({
        id: editRaceId,
        conversationId: convId,
        senderId: actorId,
        senderName: "Phuc Nguyen",
        senderAvatarUrl: null,
        content: "@continuumAI Mini edit original",
        createdAt: "2026-11-28T09:03:00.000Z",
        contentVersion: 1,
        isEdited: false,
        editedAt: null,
        deletedAt: null,
        replyToMessageId: null,
        replyTo: null,
        attachments: [],
        reactions: [],
      });
    });

    expect(
      await within(miniWindow).findByText(
        "Mini edited content before POST resolved",
      ),
    ).toBeInTheDocument();
    expect(
      within(miniWindow).queryByText("@continuumAI Mini edit original"),
    ).not.toBeInTheDocument();
    const cachedEdited = (
      client.getQueryData<{ data: Array<Record<string, unknown>> }>(
        chatKeys.messages(orgId, convId),
      )?.data ?? []
    ).find((m) => m.id === editRaceId);
    expect(cachedEdited?.content).toBe(
      "Mini edited content before POST resolved",
    );
    expect(cachedEdited?.editedAt).toBe("2026-11-28T09:03:04.000Z");
    expect(cachedEdited?.contentVersion).toBe(2);
    expect(cachedEdited?.isEdited).toBe(true);
  });

  it("does not let stale disabled cached conversation detail dmAssistantEnabled=true override a fresher list dmAssistantEnabled=false in MiniChatWindow", async () => {
    const staleDetailConv = {
      id: convId,
      type: "DIRECT" as const,
      title: null,
      createdBy: actorId,
      lastMessageAt: "2026-11-28T09:00:00.000Z",
      lastMessagePreview: "Hi",
      lastMessageSenderId: "507f1f77bcf86cd799439099",
      lastReadMessageId: null,
      lastReadAt: null,
      unreadCount: 0,
      capabilities: { dmAssistantEnabled: true },
      members: [
        {
          userId: actorId,
          displayName: "Phuc Nguyen",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
        {
          userId: "507f1f77bcf86cd799439099",
          displayName: "Lan Tran",
          avatarUrl: null,
          role: "MEMBER" as const,
          lastReadMessageId: null,
          lastReadAt: null,
          lastDeliveredMessageId: null,
          lastDeliveredAt: null,
          isOnline: true,
        },
      ],
    };

    const freshListConv = {
      ...staleDetailConv,
      capabilities: { dmAssistantEnabled: false },
    };

    let detailFetchCount = 0;
    let listFetchCount = 0;
    api.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/chat/ws-ticket" && init?.method === "POST") {
        return { ticket: "ws-ticket-cap-stale-detail", expiresInSeconds: 60 };
      }
      if (path.startsWith("/chat/conversations?")) {
        listFetchCount += 1;
        return {
          data: [freshListConv],
          nextCursor: null,
          capabilities: { dmAssistantEnabled: false },
        };
      }
      if (path === `/chat/conversations/${convId}`) {
        detailFetchCount += 1;
        return staleDetailConv;
      }
      if (path === `/chat/conversations/${convId}/messages?limit=50`) {
        return { data: [], nextCursor: null };
      }
      if (path === `/chat/conversations/${convId}/draft`) {
        return { content: "", mentionUserIds: [], assistantMention: false };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Pre-populate stale cached detail from an earlier Full Chat visit with dmAssistantEnabled: true
    client.setQueryData(chatKeys.conversation(orgId, convId), staleDetailConv, {
      updatedAt: Date.now() - 60_000,
    });

    render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <FloatingChatDock />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    // Wait for list query to populate conversationMap before opening MiniChatWindow so detailQuery stays disabled
    await waitFor(() => expect(listFetchCount).toBeGreaterThanOrEqual(1));
    await act(async () => {
      useFloatingChatStore.getState().openConversation(orgId, convId);
    });

    const miniWindow = await screen.findByTestId(`mini-chat-window-${convId}`);
    await within(miniWindow).findByPlaceholderText("Write a message…");
    expect(detailFetchCount).toBe(0);
    // Fresh list says dmAssistantEnabled: false while detail query is disabled & stale -> @continuumAI trigger stays hidden!
    expect(
      within(miniWindow).queryByTestId("chat-composer-ai-trigger"),
    ).not.toBeInTheDocument();
    client.clear();
  });
});
