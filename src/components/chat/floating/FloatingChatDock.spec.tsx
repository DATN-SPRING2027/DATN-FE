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
import { apiClient } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import ContinuumAiCompanion from "@/components/ai-companion/ContinuumAiCompanion";
import { useFloatingChatStore } from "@/stores/floating-chat";
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
    <a href={href} onClick={onClick} {...rest}>
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
    useFloatingChatStore.getState().reset();
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

    // 7. Click Chat Head -> restores MiniChatWindow, then Close (×) dismisses it completely
    fireEvent.click(
      within(head).getByRole("button", { name: "Restore chat with Lan Tran" }),
    );
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
    // Stays on current Kanban page instead of pushing to /chat!
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});

