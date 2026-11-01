import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AccountOnboarding from "./AccountOnboarding";
import { useCurrentUserQuery, useLogoutMutation } from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";
import { clearOrganizationInvitationAcceptanceKey } from "@/lib/queries/organization-memberships/organization-invitation-acceptance-idempotency";
import {
  useAcceptOrganizationInvitationMutation,
  useCreateOrganizationMutation,
  useMyOrganizationInvitationsQuery,
  useOrganizationOptionsQuery,
  useSelectOrganizationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";

const replace = vi.fn();
const select = vi.fn();
const createOrganization = vi.fn();
const accept = vi.fn();
const refetchOrganizations = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
}));
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span aria-hidden="true" />,
  GroupIcon: () => <span aria-hidden="true" />,
  LogOutIcon: () => <span aria-hidden="true" />,
  PlusIcon: () => <span aria-hidden="true" />,
}));
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
  checkOrganizationSlugAvailability: vi.fn(),
}));

describe("account onboarding invitations", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearOrganizationInvitationAcceptanceKey("organizationInvitationAccept:951a2b3c4d5e6f7a8b9c0d1e:4");
    replace.mockReset();
    select.mockReset();
    createOrganization.mockReset();
    accept.mockReset().mockResolvedValue({});
    refetchOrganizations.mockReset().mockResolvedValue({});
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "user-1", email: "invitee@example.com", name: "Invitee", context: "ACCOUNT" },
      isError: false,
    } as never);
    vi.mocked(useLogoutMutation).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [], isLoading: false, isError: false, isSuccess: true, refetch: refetchOrganizations,
    } as never);
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [{
        id: "951a2b3c4d5e6f7a8b9c0d1e", organizationId: "851a2b3c4d5e6f7a8b9c0d1f",
        organizationName: "Continuum", status: "PENDING", version: 4,
        invitedEmail: "invitee@example.com", expiresAt: "2026-10-28T10:00:00.000Z",
        createdAt: "2026-10-11T10:00:00.000Z",
      }], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn().mockResolvedValue({}),
    } as never);
    vi.mocked(useAcceptOrganizationInvitationMutation).mockReturnValue({
      mutateAsync: accept,
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
    vi.mocked(useSelectOrganizationMutation).mockReturnValue({
      mutateAsync: select, isPending: false, isError: false,
    } as never);
    vi.mocked(useCreateOrganizationMutation).mockReturnValue({
      mutateAsync: createOrganization, isPending: false, isError: false,
    } as never);
  });

  it("shows the pending state and a direct accept action in the authenticated recipient inbox", () => {
    render(<AccountOnboarding />);

    expect(screen.getByText("Continuum")).toBeInTheDocument();
    expect(screen.getByText("onboardingInvitationPending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "onboardingAcceptInvitation" })).toBeEnabled();
    expect(select).not.toHaveBeenCalled();
  });

  it("accepts the listed invitation through the shared operation and refreshes without creating an organization session", async () => {
    const refetchInvitations = vi.fn();
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [{
        id: "951a2b3c4d5e6f7a8b9c0d1e", organizationId: "851a2b3c4d5e6f7a8b9c0d1f",
        organizationName: "Continuum", status: "PENDING", version: 4,
        invitedEmail: "invitee@example.com", expiresAt: "2026-10-28T10:00:00.000Z",
        createdAt: "2026-10-11T10:00:00.000Z",
      }], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: refetchInvitations.mockResolvedValue({}),
    } as never);
    render(<AccountOnboarding />);

    fireEvent.click(screen.getByRole("button", { name: "onboardingAcceptInvitation" }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith({
      invitationId: "951a2b3c4d5e6f7a8b9c0d1e",
      organizationId: "851a2b3c4d5e6f7a8b9c0d1f",
      expectedInvitationVersion: 4,
      idempotencyKey: expect.stringMatching(/^[A-Za-z0-9._:-]{16,128}$/),
    }));
    await waitFor(() => expect(refetchInvitations).toHaveBeenCalled());
    await waitFor(() => expect(refetchOrganizations).toHaveBeenCalled());
    expect(select).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("reuses the same idempotency key after an uncertain acceptance response", async () => {
    accept.mockRejectedValueOnce(new TypeError("network connection interrupted"));
    const refetchInvitations = vi.fn();
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [{
        id: "951a2b3c4d5e6f7a8b9c0d1e", organizationId: "851a2b3c4d5e6f7a8b9c0d1f",
        organizationName: "Continuum", status: "PENDING", version: 4,
        invitedEmail: "invitee@example.com", expiresAt: "2026-10-28T10:00:00.000Z",
        createdAt: "2026-10-11T10:00:00.000Z",
      }], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: refetchInvitations.mockResolvedValue({}),
    } as never);
    render(<AccountOnboarding />);
    const button = screen.getByRole("button", { name: "onboardingAcceptInvitation" });

    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("onboardingInvitationAcceptError");
    fireEvent.click(button);

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(2));
    expect(accept.mock.calls[1][0].idempotencyKey).toBe(accept.mock.calls[0][0].idempotencyKey);
  });

  it("keeps the readiness 503 visible and does not claim that acceptance succeeded", async () => {
    accept.mockRejectedValueOnce(new ApiError(503, "IAM_MEMBERSHIP_DEPENDENCY_UNAVAILABLE", "Unavailable"));
    render(<AccountOnboarding />);

    fireEvent.click(screen.getByRole("button", { name: "onboardingAcceptInvitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("onboardingInvitationUnavailable");
    expect(select).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not offer acceptance for a non-pending invitation", () => {
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [{
        id: "951a2b3c4d5e6f7a8b9c0d1e", organizationId: "851a2b3c4d5e6f7a8b9c0d1f",
        organizationName: "Continuum", status: "ACCEPTED", version: 5,
        invitedEmail: "invitee@example.com", expiresAt: "2026-10-28T10:00:00.000Z",
        createdAt: "2026-10-11T10:00:00.000Z",
      }], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn().mockResolvedValue({}),
    } as never);

    render(<AccountOnboarding />);

    expect(screen.queryByRole("button", { name: "onboardingAcceptInvitation" })).not.toBeInTheDocument();
    expect(screen.getByText("onboardingInvitationNotPending")).toBeInTheDocument();
  });

  it("shows an explicit empty state when the recipient inbox is empty", () => {
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn().mockResolvedValue({}),
    } as never);
    render(<AccountOnboarding />);
    expect(screen.getByText("onboardingNoInvitations")).toBeInTheDocument();
  });

  it("shows an error alert instead of the empty message when refetching an empty inbox fails", () => {
    vi.mocked(useMyOrganizationInvitationsQuery).mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
      isLoading: false,
      isError: true,
      refetch: vi.fn().mockResolvedValue({}),
    } as never);

    render(<AccountOnboarding />);

    expect(screen.getByText("onboardingInvitationError")).toBeInTheDocument();
    expect(screen.queryByText("onboardingNoInvitations")).not.toBeInTheDocument();
  });

  it("enters the dashboard after an account user selects an organization", async () => {
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [{ id: "org-1", name: "North Star" }],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn().mockResolvedValue({}),
    } as never);
    select.mockResolvedValue({ user: { organizationId: "org-1" } });

    render(<AccountOnboarding />);
    fireEvent.click(screen.getByRole("button", { name: /North Star/ }));

    await waitFor(() => expect(select).toHaveBeenCalledWith("org-1"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("offers organization creation when none are available and opens the form on demand", () => {
    render(<AccountOnboarding />);

    expect(screen.getByText("onboardingNoOrganization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "onboardingCreateStartAction" })).toBeInTheDocument();
    expect(screen.queryByLabelText("onboardingName")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "onboardingCreateStartAction" }));

    expect(screen.getByLabelText("onboardingName")).toBeInTheDocument();
    expect(screen.getByLabelText("onboardingSlug")).toBeInTheDocument();
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
      refetch: vi.fn().mockResolvedValue({}),
    } as never);
    select.mockResolvedValue({ user: { organizationId: "org-2" } });

    render(<AccountOnboarding />);

    expect(useOrganizationOptionsQuery).toHaveBeenCalledWith(true);
    expect(screen.getByText("North Star")).toBeInTheDocument();
    expect(screen.getByText("onboardingCurrentOrganization")).toBeInTheDocument();
    expect(screen.getByText("Sunrise Institute")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "onboardingCreateAdditionalAction" })).toBeInTheDocument();
    expect(screen.queryByText("onboardingInvited")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "onboardingCreateAdditionalAction" }));
    expect(screen.getByLabelText("onboardingName")).toBeInTheDocument();
    expect(screen.getByLabelText("onboardingSlug")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Sunrise Institute/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "onboardingBackToOrganizations" }));
    expect(screen.queryByLabelText("onboardingName")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sunrise Institute/ }));

    await waitFor(() => expect(select).toHaveBeenCalledWith("org-2"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("marks only the selected organization button as aria-busy while selection is pending", async () => {
    let resolveSelect!: (value: { user: { organizationId: string } }) => void;
    select.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSelect = resolve;
        }),
    );
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
      refetch: vi.fn().mockResolvedValue({}),
    } as never);

    render(<AccountOnboarding />);

    const northStarButton = screen.getByRole("button", { name: /North Star/ });
    const sunriseButton = screen.getByRole("button", { name: /Sunrise Institute/ });

    fireEvent.click(sunriseButton);

    expect(sunriseButton).toHaveAttribute("aria-busy", "true");
    expect(northStarButton).toHaveAttribute("aria-busy", "false");

    resolveSelect({ user: { organizationId: "org-2" } });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("lets a member create another organization and enters it", async () => {
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
      refetch: vi.fn().mockResolvedValue({}),
    } as never);
    createOrganization.mockResolvedValue({ id: "org-created", name: "New Organization" });
    select.mockResolvedValue({ user: { organizationId: "org-created" } });

    render(<AccountOnboarding />);

    fireEvent.click(screen.getByRole("button", { name: "onboardingCreateAdditionalAction" }));
    fireEvent.change(screen.getByLabelText("onboardingName"), { target: { value: "New Organization" } });
    fireEvent.change(screen.getByLabelText("onboardingSlug"), { target: { value: "new-organization" } });
    const form = screen.getByLabelText("onboardingName").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith({
      name: "New Organization",
      slug: "new-organization",
    }));
    await waitFor(() => expect(select).toHaveBeenCalledWith("org-created"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("disables organization actions while creating another organization", () => {
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
      refetch: vi.fn().mockResolvedValue({}),
    } as never);
    vi.mocked(useCreateOrganizationMutation).mockReturnValue({
      mutateAsync: createOrganization, isPending: true, isError: false,
    } as never);

    render(<AccountOnboarding />);

    expect(screen.getByRole("button", { name: "onboardingCreateAdditionalAction" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /North Star/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /North Star/ })).toHaveAttribute("aria-busy", "false");
  });

  it("displays the Neural Signature transition immediately, blocks duplicate clicks, and dismisses the overlay on API failure", async () => {
    let rejectSelect!: (reason?: unknown) => void;
    select.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSelect = reject;
        }),
    );
    vi.mocked(useOrganizationOptionsQuery).mockReturnValue({
      data: [{ id: "org-1", name: "Continuum AI Labs" }],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn().mockResolvedValue({}),
    } as never);

    render(<AccountOnboarding />);
    const orgButton = screen.getByRole("button", { name: /Continuum AI Labs/ });

    fireEvent.click(orgButton);
    fireEvent.click(orgButton);

    expect(select).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("organization-neural-transition"),
    ).toBeInTheDocument();

    rejectSelect(new ApiError(500, "INTERNAL_ERROR", "Switch failed"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("organization-neural-transition"),
      ).not.toBeInTheDocument(),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("creates an organization, selects it, then enters its workspace", async () => {
    createOrganization.mockResolvedValue({ id: "org-created", name: "New Organization" });
    select.mockResolvedValue({ user: { organizationId: "org-created" } });
    render(<AccountOnboarding />);

    fireEvent.click(screen.getByRole("button", { name: "onboardingCreateStartAction" }));
    fireEvent.change(screen.getByLabelText("onboardingName"), { target: { value: "New Organization" } });
    fireEvent.change(screen.getByLabelText("onboardingSlug"), { target: { value: "new-organization" } });
    const form = screen.getByLabelText("onboardingName").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(createOrganization).toHaveBeenCalledWith({
      name: "New Organization",
      slug: "new-organization",
    }));
    await waitFor(() => expect(select).toHaveBeenCalledWith("org-created"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});
