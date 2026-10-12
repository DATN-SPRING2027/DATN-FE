import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationInvitationManager from "./OrganizationInvitationManager";
import {
  useCreateOrganizationInvitationMutation,
  useOrganizationInvitationsQuery,
  useRevokeOrganizationInvitationMutation,
} from "@/lib/queries/auth/useAccountOnboarding";

const create = vi.fn();
const revoke = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({ ChevronDownIcon: () => null }));
vi.mock("@/lib/queries/auth/useAccountOnboarding", () => ({
  useCreateOrganizationInvitationMutation: vi.fn(),
  useOrganizationInvitationsQuery: vi.fn(),
  useRevokeOrganizationInvitationMutation: vi.fn(),
}));

describe("OrganizationInvitationManager", () => {
  beforeEach(() => {
    create.mockReset();
    revoke.mockReset();
    vi.mocked(useOrganizationInvitationsQuery).mockReturnValue({
      data: [{
        id: "invite-1", organizationId: "org-1", organizationName: "Continuum",
        email: "person@example.com", roleCode: "MEMBER", status: "PENDING",
        expiresAt: "2026-10-18T10:00:00.000Z", createdAt: "2026-10-11T10:00:00.000Z",
      }],
      isLoading: false, isError: false,
    } as never);
    vi.mocked(useCreateOrganizationInvitationMutation).mockReturnValue({
      mutateAsync: create, isPending: false, isError: false,
    } as never);
    vi.mocked(useRevokeOrganizationInvitationMutation).mockReturnValue({
      mutateAsync: revoke, isPending: false, isError: false,
    } as never);
  });

  it("creates an email-bound invitation and lists its pending state", async () => {
    create.mockResolvedValue({ email: "person@example.com" });
    render(<OrganizationInvitationManager organizationId="org-1" />);

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "Person@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "inviteAction" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({
      organizationId: "org-1",
      email: "Person@Example.com",
      roleCode: "MEMBER",
    }));
    expect(screen.getByText("person@example.com")).toBeInTheDocument();
  });

  it("lets an administrator revoke a pending invitation", async () => {
    revoke.mockResolvedValue(undefined);
    render(<OrganizationInvitationManager organizationId="org-1" />);

    fireEvent.click(screen.getByRole("button", { name: "revokeInvitation" }));

    await waitFor(() => expect(revoke).toHaveBeenCalledWith({
      organizationId: "org-1",
      invitationId: "invite-1",
    }));
  });
});
