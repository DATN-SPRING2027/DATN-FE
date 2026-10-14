import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrganizationInvitationManager from "./OrganizationInvitationManager";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

describe("OrganizationInvitationManager navigation", () => {
  it("points administrators to the contract-backed member management page", () => {
    render(<OrganizationInvitationManager />);

    expect(
      screen.getByRole("link", { name: "manageOrganizationMemberships" }),
    ).toHaveAttribute("href", "/organization/members");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
