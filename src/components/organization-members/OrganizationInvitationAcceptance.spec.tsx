import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationInvitationAcceptance from "./OrganizationInvitationAcceptance";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  resolve: vi.fn(),
  get: vi.fn(),
  accept: vi.fn(),
  currentUser: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: mocks.currentUser,
  useLogoutMutation: mocks.logout,
}));
vi.mock("@/lib/queries/organization-memberships/organization-invitations", () => ({
  acceptOrganizationInvitation: mocks.accept,
  getOrganizationInvitation: mocks.get,
  invitationReturnTo: (id: string) => `/organization/invitations?invitationId=${id}`,
  resolveOrganizationInvitation: mocks.resolve,
}));
vi.mock("@/lib/queries/organization-memberships/organization-memberships.service", () => ({
  createIdempotencyKey: () => "0123456789abcdef",
}));

const invitationId = "3123456789abcdef01234567";
const organizationId = "0123456789abcdef01234567";
const invitation = {
  id: invitationId,
  organizationId,
  status: "PENDING",
  version: 3,
  expiresAt: "2026-10-27T00:00:00.000Z",
  createdAt: "2026-10-20T00:00:00.000Z",
  invitedEmail: "invitee@example.test",
  organizationName: "Continuum",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue(invitation);
  mocks.get.mockResolvedValue(invitation);
  mocks.accept.mockResolvedValue({
    operationId: "4123456789abcdef01234567",
    membership: {
      id: "5123456789abcdef01234567",
      organizationId,
      userId: "6123456789abcdef01234567",
      status: "ACTIVE",
      version: 1,
    },
    invitation: { id: invitationId, status: "ACCEPTED", version: 4, expiresAt: invitation.expiresAt },
  });
  mocks.logout.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Organization invitation acceptance", () => {
  it("reads the fragment once, removes it from history, and keeps only the ID in auth continuation", async () => {
    mocks.currentUser.mockReturnValue({ data: undefined, isFetching: false, isError: true });
    window.history.replaceState(null, "", `/organization/invitations#${"a".repeat(43)}`);
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<OrganizationInvitationAcceptance />);

    expect(await screen.findByText("invitationFor")).toBeVisible();
    expect(mocks.resolve).toHaveBeenCalledWith("a".repeat(43));
    expect(mocks.get).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/organization/invitations",
    );
    expect(window.location.href).not.toContain("a".repeat(43));
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(screen.getByRole("link", { name: "signIn" })).toHaveAttribute(
      "href",
      `/signin?returnTo=${encodeURIComponent(`/organization/invitations?invitationId=${invitationId}`)}`,
    );
    expect(screen.getByRole("link", { name: "createAccount" }).getAttribute("href"))
      .toContain(`email=${encodeURIComponent(invitation.invitedEmail)}`);
  });

  it("loads the non-secret invitation ID after authentication and accepts with the server-bound account", async () => {
    mocks.currentUser.mockReturnValue({
      data: { id: "6123456789abcdef01234567", email: "invitee@example.test" },
      isFetching: false,
      isError: false,
    });
    window.history.replaceState(
      null,
      "",
      `/organization/invitations?invitationId=${invitationId}`,
    );

    render(<OrganizationInvitationAcceptance />);

    fireEvent.click(await screen.findByRole("button", { name: "invitationAccept" }));

    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith(
      invitationId,
      organizationId,
      invitation.version,
      "0123456789abcdef",
    ));
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/onboarding");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("blocks an authenticated account with a different email before submitting acceptance", async () => {
    mocks.currentUser.mockReturnValue({
      data: { id: "6123456789abcdef01234567", email: "other@example.test" },
      isFetching: false,
      isError: false,
    });
    window.history.replaceState(
      null,
      "",
      `/organization/invitations?invitationId=${invitationId}`,
    );

    render(<OrganizationInvitationAcceptance />);

    expect(await screen.findByRole("alert")).toHaveTextContent("invitationWrongEmail");
    expect(mocks.accept).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "invitationAccept" })).toBeNull();
  });
});
