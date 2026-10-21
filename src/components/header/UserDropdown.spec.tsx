import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import { AppProviders } from "@/lib/providers/AppProviders";
import UserDropdown from "./UserDropdown";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }), usePathname: () => "/",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({ ChevronDownIcon: () => null }));
vi.mock("@/i18n/languages", () => ({
  getLanguage: () => ({ FlagIcon: () => null, name: "English" }), languages: [],
}));

describe("logout feedback", () => {
  beforeEach(() => { vi.restoreAllMocks(); replace.mockReset(); });
  afterEach(() => { onlineManager.setOnline(true); vi.useRealTimers(); });

  it("uses the authenticated directory avatar instead of a template image", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/auth/me")) return new Response('{"id":"user","name":"User Example","email":"user@example.test","organizationId":"org-a","roles":["ADMIN"]}');
      if (String(url).endsWith("/iam/users/user")) return new Response('{"id":"user","fullName":"User Example","avatarUrl":"https://cdn.example.test/avatar.png"}');
      throw new Error(`Unexpected request: ${String(url)}`);
    });
    render(<AppProviders><UserDropdown /></AppProviders>);
    await waitFor(() => expect(document.querySelector('img[src="https://cdn.example.test/avatar.png"]')).not.toBeNull());
    expect(document.querySelector('img[src="/images/user/owner.png"]')).toBeNull();
  });

  it("ends a stalled logout after ten seconds and enables retry", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url, options) => {
      if (String(url).endsWith("/auth/me")) return new Response('{"id":"user","name":"User"}');
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
      });
    });
    render(<AppProviders><UserDropdown /></AppProviders>);
    await waitFor(() => expect(screen.getByText("User")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /User/ }));
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "signOut" })); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("button", { name: "signingOut" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });
    expect(screen.getByText("signOutErrorMessage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "signOut" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("reports logout failure immediately when the query manager is offline instead of pausing", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/auth/me")) return new Response('{"id":"user","name":"User"}');
      throw new TypeError("Offline");
    });
    render(<AppProviders><UserDropdown /></AppProviders>);
    await waitFor(() => expect(screen.getByText("User")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /User/ }));
    onlineManager.setOnline(false);
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    await waitFor(() => expect(screen.getByText("signOutErrorMessage")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "signOut" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("navigates to sign-in only after logout succeeds", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) =>
      new Response(String(url).endsWith("/auth/me")
        ? '{"id":"user","name":"User","email":"user@example.test"}'
        : '{"status":"logged_out"}'),
    );
    render(<AppProviders><UserDropdown /></AppProviders>);
    await waitFor(() => expect(screen.getByText("User")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /User/ }));
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
    expect(screen.queryByText("signOutErrorMessage")).not.toBeInTheDocument();
  });

  it("shows logout network failure and keeps an explicit retry available", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/auth/me")) return new Response('{"id":"user","name":"User","email":"user@example.test"}');
      throw new TypeError("Offline");
    });
    render(<AppProviders><UserDropdown /></AppProviders>);
    await waitFor(() => expect(screen.getByText("User")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /User/ }));
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    await waitFor(() => expect(screen.getByText("signOutErrorMessage")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "signOut" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(1);
  });

  it.each([401, 500])("keeps logout failure %s visible without recovery or redirect", async (status) => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url) =>
      String(url).endsWith("/auth/me")
        ? new Response('{"id":"user","name":"User","email":"user@example.test"}')
        : new Response('{"message":"Logout failed"}', { status }),
    );
    render(<AppProviders><UserDropdown /></AppProviders>);
    await waitFor(() => expect(screen.getByText("User")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /User/ }));
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    await waitFor(() => expect(screen.getByText("signOutErrorMessage")).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/refresh"))).toBe(false);
    expect(screen.getByRole("button", { name: "signOut" })).toBeEnabled();
  });
});
