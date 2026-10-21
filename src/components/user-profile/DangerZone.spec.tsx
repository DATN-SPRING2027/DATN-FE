import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import DangerZone from "./DangerZone";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));

function renderDangerZone() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <DangerZone />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("DangerZone", () => {
  beforeEach(() => { vi.restoreAllMocks(); replace.mockReset(); });

  it("signs out only the current session and offers no unsupported deletion action", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response('{"status":"logged_out"}', { status: 200 }));
    renderDangerZone();

    expect(screen.getByText("Sign out this device")).toBeVisible();
    expect(screen.getByText("Account deletion is not available here. Contact support for help with account access.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(["/api/v1/auth/logout"]);
  });

  it("shows a retryable error and does not navigate when logout fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response('{"message":"Logout failed"}', { status: 500 }));
    renderDangerZone();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn’t confirm sign out.");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
