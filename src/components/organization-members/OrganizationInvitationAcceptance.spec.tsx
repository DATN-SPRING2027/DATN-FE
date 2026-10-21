import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import OrganizationInvitationAcceptance from "./OrganizationInvitationAcceptance";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  resolve: vi.fn(),
  get: vi.fn(),
  accept: vi.fn(),
  currentUser: vi.fn(),
  logout: vi.fn(),
  createIdempotencyKey: vi.fn(),
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
  createIdempotencyKey: mocks.createIdempotencyKey,
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
  mocks.createIdempotencyKey.mockReturnValue("0123456789abcdef");
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
    expect(screen.queryByRole("link", { name: "createAccount" })).toBeNull();
    expect(screen.getByText("invitationSignInRequired")).toBeVisible();
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
      0,
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

  it("reuses the same idempotency key after an uncertain request and page reload", async () => {
    mocks.currentUser.mockReturnValue({
      data: { id: "6123456789abcdef01234567", email: "invitee@example.test" },
      isFetching: false,
      isError: false,
    });
    mocks.createIdempotencyKey
      .mockReturnValueOnce("0123456789abcdef")
      .mockReturnValueOnce("1123456789abcdef");
    mocks.accept
      .mockRejectedValueOnce(new TypeError("network connection interrupted"))
      .mockResolvedValueOnce({
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
    window.history.replaceState(null, "", `/organization/invitations?invitationId=${invitationId}`);

    const firstRender = render(<OrganizationInvitationAcceptance />);
    fireEvent.click(await screen.findByRole("button", { name: "invitationAccept" }));
    expect(await screen.findByText("invitationServerError")).toBeVisible();
    expect(mocks.accept).toHaveBeenCalledWith(
      invitationId,
      organizationId,
      0,
      invitation.version,
      "0123456789abcdef",
    );

    firstRender.unmount();
    render(<OrganizationInvitationAcceptance />);
    fireEvent.click(await screen.findByRole("button", { name: "invitationAccept" }));

    await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(2));
    expect(mocks.accept).toHaveBeenLastCalledWith(
      invitationId,
      organizationId,
      0,
      invitation.version,
      "0123456789abcdef",
    );
    expect(mocks.createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it("shows a stale conflict and refreshes current invitation version only after a user action", async () => {
    mocks.currentUser.mockReturnValue({
      data: { id: "6123456789abcdef01234567", email: "invitee@example.test" },
      isFetching: false,
      isError: false,
    });
    const refreshedInvitation = { ...invitation, version: 4 };
    mocks.get.mockResolvedValueOnce(invitation).mockResolvedValueOnce(refreshedInvitation);
    mocks.accept.mockRejectedValueOnce(new ApiError(409, "INVITATION_VERSION_CONFLICT", "stale"));
    window.history.replaceState(null, "", `/organization/invitations?invitationId=${invitationId}`);

    render(<OrganizationInvitationAcceptance />);
    fireEvent.click(await screen.findByRole("button", { name: "invitationAccept" }));
    expect(await screen.findByText("invitationStale")).toBeVisible();
    expect(mocks.accept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "invitationRefresh" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("invitationStale")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "invitationAccept" }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(2));
    expect(mocks.accept).toHaveBeenLastCalledWith(
      invitationId,
      organizationId,
      0,
      refreshedInvitation.version,
      "0123456789abcdef",
    );
  });
});
