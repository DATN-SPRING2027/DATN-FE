import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountOnboarding from "./AccountOnboarding";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
import {
  useAcceptOrganizationInvitationMutation,
  useCreateOrganizationMutation,
  useMyOrganizationInvitationsQuery,
  useOrganizationOptionsQuery,
  useSelectOrganizationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";

const replace = vi.fn();
const accept = vi.fn();
const select = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
  useLogoutMutation: vi.fn(),
}));
vi.mock("@/lib/queries/auth/useAccountOnboarding", () => ({
  useAcceptOrganizationInvitationMutation: vi.fn(),
  useCreateOrganizationMutation: vi.fn(),
  useMyOrganizationInvitationsQuery: vi.fn(),
  useOrganizationOptionsQuery: vi.fn(),
  useSelectOrganizationMutation: vi.fn(),
}));

describe("account onboarding invitations", () => {
  beforeEach(() => {
    replace.mockReset();
    accept.mockReset();
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
      data: [{
        id: "invite-1", organizationId: "org-1", organizationName: "Continuum",
        email: "invitee@example.com", roleCode: "MEMBER", status: "PENDING",
        expiresAt: "2026-10-18T10:00:00.000Z", createdAt: "2026-10-11T10:00:00.000Z",
      }],
      isLoading: false, isError: false, refetch: vi.fn(),
    } as never);
    vi.mocked(useAcceptOrganizationInvitationMutation).mockReturnValue({
      mutateAsync: accept, isPending: false, isError: false,
    } as never);
    vi.mocked(useSelectOrganizationMutation).mockReturnValue({
      mutateAsync: select, isPending: false, isError: false,
    } as never);
    vi.mocked(useCreateOrganizationMutation).mockReturnValue({
      mutateAsync: vi.fn(), isPending: false, isError: false,
    } as never);
  });

  it("accepts an email-matched invitation and selects its Organization", async () => {
    accept.mockResolvedValue({ organizationId: "org-1", organizationName: "Continuum" });
    select.mockResolvedValue({ user: { organizationId: "org-1" } });
    render(<AccountOnboarding />);

    expect(screen.getByText("Continuum")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "onboardingAcceptInvitation" }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("invite-1"));
    await waitFor(() => expect(select).toHaveBeenCalledWith("org-1"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
