import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AccountOnboarding from "./AccountOnboarding";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
import {
  useMyOrganizationInvitationsQuery,
  useOrganizationOptionsQuery,
  useSelectOrganizationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";

const replace = vi.fn();
const select = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useRouter: () => ({ replace }),
}));
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span aria-hidden="true" />,
  GroupIcon: () => <span aria-hidden="true" />,
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
  useLogoutMutation: vi.fn(),
}));
vi.mock("@/lib/queries/auth/useAccountOnboarding", () => ({
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
      data: [], isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
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
  });

  it("shows pending invitations without exposing the blocked legacy accept action", () => {
    render(<AccountOnboarding />);

    expect(screen.getByText("Continuum")).toBeInTheDocument();
    expect(screen.getByText("onboardingInvitationUnavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "onboardingAcceptInvitation" })).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });
  it("shows an explicit empty state when the recipient inbox is empty", () => {
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    } as never);
    render(<AccountOnboarding />);
    expect(screen.getByText("onboardingNoInvitations")).toBeInTheDocument();
  });

  it("enters the dashboard after an account user selects an organization", async () => {
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [{ id: "org-1", name: "North Star" }],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as never);
    select.mockResolvedValue({ user: { organizationId: "org-1" } });

    render(<AccountOnboarding />);
    fireEvent.click(screen.getByRole("button", { name: /North Star/ }));

    await waitFor(() => expect(select).toHaveBeenCalledWith("org-1"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("does not offer self-service Organization creation to an account without membership", () => {
    render(<AccountOnboarding />);

    expect(screen.getByText("onboardingNoOrganization")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "onboardingCreateStartAction" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("onboardingName")).not.toBeInTheDocument();
  });

  it("lists and selects organizations for an already organization-scoped user", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: "user-1", email: "member@example.com", name: "Member", context: "ORGANIZATION",
        organizationId: "org-1", roles: ["MEMBER"],
      },
      isError: false,
    } as never);
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [
        { id: "org-1", name: "North Star" },
        { id: "org-2", name: "Sunrise Institute" },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as never);
    select.mockResolvedValue({ user: { organizationId: "org-2" } });

    render(<AccountOnboarding />);

    expect(useOrganizationOptionsQuery).toHaveBeenCalledWith(true);
    expect(screen.getByText("North Star")).toBeInTheDocument();
    expect(screen.getByText("Sunrise Institute")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "onboardingCreateAdditionalAction" })).not.toBeInTheDocument();
    expect(screen.queryByText("onboardingInvited")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sunrise Institute/ }));

    await waitFor(() => expect(select).toHaveBeenCalledWith("org-2"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("does not offer creation when an organization-scoped user switches context", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: "user-1", email: "member@example.com", name: "Member", context: "ORGANIZATION",
        organizationId: "org-1", roles: ["MEMBER"],
      },
      isError: false,
    } as never);
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [{ id: "org-1", name: "North Star" }],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as never);

    render(<AccountOnboarding />);

    expect(screen.getByRole("button", { name: /North Star/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "onboardingCreateAdditionalAction" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("onboardingName")).not.toBeInTheDocument();
  });
});
