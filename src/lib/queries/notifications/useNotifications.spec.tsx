import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chatApi } from "@/lib/queries/chat/useChat";
import {
  useNotificationRealtimeSubscription,
  unreadNotificationPollingInterval,
} from "./useNotifications";

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;

  readyState = FakeWebSocket.CONNECTING;
  onopen: WebSocket["onopen"] = null;
  onclose: WebSocket["onclose"] = null;
  onmessage: WebSocket["onmessage"] = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    sockets.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.call(this as unknown as WebSocket, new Event("open"));
  }

  close() {
    this.readyState = 3;
    this.onclose?.call(
      this as unknown as WebSocket,
      new CloseEvent("close"),
    );
  }
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <StrictMode>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </StrictMode>
    );
  };
}

beforeEach(() => {
  sockets.length = 0;
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shares one ticket request across Strict Mode effect replay", async () => {
  let resolveTicket!: (value: {
    ticket: string;
    expiresInSeconds: number;
  }) => void;
  const ticket = new Promise<{ ticket: string; expiresInSeconds: number }>(
    (resolve) => {
      resolveTicket = resolve;
    },
  );
  const request = vi
    .spyOn(chatApi, "wsTicket")
    .mockReturnValue(ticket);
  const client = new QueryClient();

  const { result, unmount } = renderHook(
    () => useNotificationRealtimeSubscription("user-1", "org-1"),
    { wrapper: createWrapper(client) },
  );

  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveTicket({ ticket: "one-use-ticket", expiresInSeconds: 60 });
  });
  await waitFor(() => expect(sockets).toHaveLength(1));
  act(() => sockets[0].open());
  expect(result.current).toBe(true);

  unmount();
  client.clear();
});

it("disables unread polling while realtime is connected", () => {
  expect(unreadNotificationPollingInterval(true)).toBe(false);
});

it("keeps polling as a fallback while realtime is unavailable", () => {
  expect(unreadNotificationPollingInterval(false)).toBe(30_000);
});
