import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountOnboarding from "./AccountOnboarding";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
import {
  useCreateOrganizationMutation,
  useMyOrganizationInvitationsQuery,
  useOrganizationOptionsQuery,
  useSelectOrganizationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";

const replace = vi.fn();
const select = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
  useLogoutMutation: vi.fn(),
}));
vi.mock("@/lib/queries/auth/useAccountOnboarding", () => ({
  useCreateOrganizationMutation: vi.fn(),
  useMyOrganizationInvitationsQuery: vi.fn(),
  useOrganizationOptionsQuery: vi.fn(),
  useSelectOrganizationMutation: vi.fn(),
}));

describe("account onboarding invitations", () => {
  beforeEach(() => {
    replace.mockReset();
    select.mockReset();
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "user-1", email: "invitee@example.com", name: "Invitee", context: "ACCOUNT" },
      isError: false,
    } as never);
    vi.mocked(useLogoutMutation).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: vi.fn(),
    } as never);
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [{
        id: "invite-1", membershipId: "member-1", organizationId: "org-1",
        organizationName: "Continuum", status: "PENDING", version: 1,
        membershipVersion: 1, expiresAt: "2026-10-18T10:00:00.000Z",
        createdAt: "2026-10-11T10:00:00.000Z",
      }], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    } as never);
    vi.mocked(useSelectOrganizationMutation).mockReturnValue({
      mutateAsync: select, isPending: false, isError: false,
    } as never);
    vi.mocked(useCreateOrganizationMutation).mockReturnValue({
      mutateAsync: vi.fn(), isPending: false, isError: false,
    } as never);
  });

  it("shows pending invitations without exposing the blocked legacy accept action", () => {
    render(<AccountOnboarding />);

    expect(screen.getByText("Continuum")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("onboardingInvitationUnavailable");
    expect(screen.queryByRole("button", { name: "onboardingAcceptInvitation" })).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });
  it("shows an explicit empty state when the recipient inbox is empty", () => {
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    } as never);
    render(<AccountOnboarding />);
    expect(screen.getByRole("status")).toHaveTextContent("onboardingNoInvitations");
  });
});
