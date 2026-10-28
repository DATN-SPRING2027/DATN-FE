import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import messages from "@/messages/en.json";
import PlatformAccountDirectory from "./PlatformAccountDirectory";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const mockApi = vi.mocked(apiClient);
const account = {
  id: "651a2b3c4d5e6f7a8b9c0d1e",
  name: "Platform Operator",
  email: "operator@example.test",
  context: "PLATFORM",
  permissions: [
    "platform.audit.read",
    ...Array.from({ length: 12 }, (_, i) => `permission.${i + 1}`),
  ],
};
beforeEach(() =>
  mockApi.mockReset().mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  }),
);
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<PlatformAccountDirectory account={account} />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    ),
  });
}
it("shows profile identity alongside searchable, paginated permissions", () => {
  setup();
  expect(
    screen.getByRole("heading", { name: account.name }),
  ).toBeInTheDocument();
  expect(screen.getByText(account.email)).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Permissions" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("11–13 of 13")).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search permissions" }),
    { target: { value: "platform.audit" } },
  );
  expect(screen.getByText("1–1 of 1")).toBeInTheDocument();
  expect(mockApi).not.toHaveBeenCalled();
});
it("loads only the current admin's activity and hides it when read permission is revoked", async () => {
  const { rerender } = setup();
  fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith(
      `/iam/platform/audit/events?page=1&pageSize=10&actorUserId=${account.id}`,
      expect.objectContaining({ cache: "no-store" }),
    ),
  );
  await screen.findByText("No activity yet");
  rerender(
    <PlatformAccountDirectory
      account={{ ...account, permissions: ["platform.users.account.read"] }}
    />,
  );
  expect(
    screen.queryByRole("tab", { name: "Activity" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Permissions" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
