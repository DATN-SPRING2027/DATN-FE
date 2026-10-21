import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { apiClient } from "@/lib/api-client";
import Security from "./Security";

vi.mock("@/lib/api-client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

it("requests a reset for the authenticated email and does not show a fake 2FA toggle", async () => {
  mockedApiClient.mockReset();
  mockedApiClient
    .mockResolvedValueOnce({
      id: "user-a",
      email: "alex@example.test",
      name: "Alex Example",
      organizationId: "org-a",
      roles: ["ADMIN"],
    })
    .mockResolvedValueOnce({ status: "accepted" });

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <Security />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  const resetButton = await screen.findByRole("button", { name: "Send reset link" });
  await waitFor(() => expect(resetButton).toBeEnabled());
  fireEvent.click(resetButton);

  await waitFor(() =>
    expect(mockedApiClient).toHaveBeenCalledWith("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: "alex@example.test" }),
    }),
  );
  expect(await screen.findByText(/reset request was accepted/i)).toBeVisible();
  expect(mockedApiClient).toHaveBeenCalledWith("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email: "alex@example.test" }),
  });
  expect(screen.getByText("Two-factor authentication (2FA)")).toBeVisible();
  expect(screen.getByText("Two-factor authentication is not available yet.")).toBeVisible();
  expect(screen.queryByRole("checkbox")).toBeNull();
});
