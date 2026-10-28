import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError, apiClient } from "@/lib/api-client";
import messages from "@/messages/en.json";
import { usePlatformOperationsViewModel } from "./usePlatformOperationsViewModel";
import PlatformSecurityDirectory from "./PlatformSecurityDirectory";
vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const mockApi = vi.mocked(apiClient);
const session = {
  id: "81397abd-3cc9-4ee7-bc36-45c603436562",
  userId: "651a2b3c4d5e6f7a8b9c0d1e",
  context: "PLATFORM",
  organizationId: null,
  status: "ACTIVE",
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T00:00:00.000Z",
  expiresAt: "2026-11-04T00:00:00.000Z",
};
let originalModal: PropertyDescriptor | undefined;
beforeEach(() => {
  originalModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  mockApi.mockReset().mockImplementation(async (path) =>
    path.endsWith(session.id)
      ? session
      : {
          data: [session],
          pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
        },
  );
});
afterEach(() => {
  if (originalModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalModal,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});
function Content({ allowed }: { allowed: boolean }) {
  const model = usePlatformOperationsViewModel({
    section: "security",
    operatorId: session.userId,
    permissions: allowed ? ["platform.sessions.session.read"] : [],
  });
  return <PlatformSecurityDirectory model={model} />;
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function View({ allowed = true }: { allowed?: boolean }) {
    return (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          <Content allowed={allowed} />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }
  return { ...render(<View />), client, View };
}
it("opens session details in the shared modal and restores focus after Escape", async () => {
  setup();
  const trigger = await screen.findByRole("button", { name: "Details" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Session" });
  expect(dialog).toHaveAttribute("open");
  await waitFor(() =>
    expect(within(dialog).getByText(session.id)).toBeInTheDocument(),
  );
  expect(
    within(dialog).getByRole("button", { name: "Close session details" }),
  ).toHaveFocus();
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(trigger).toHaveFocus());
});
it("keeps a failed detail request inside the modal with retry", async () => {
  mockApi.mockImplementation(async (path) => {
    if (path.endsWith(session.id))
      throw new ApiError(403, "FORBIDDEN", "Denied");
    return {
      data: [session],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    };
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Details" }));
  const dialog = screen.getByRole("dialog", { name: "Session" });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument(),
  );
  expect(within(dialog).queryByText(session.id)).not.toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Close session details" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("removes an open detail modal when read permission is revoked", async () => {
  const { rerender, View } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "Details" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  rerender(<View allowed={false} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
