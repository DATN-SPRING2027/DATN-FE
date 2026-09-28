import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UserEditor from "./UserEditor";
import { ApiError } from "@/lib/api-client";
import { useUpdateUserMutation, useUserQuery } from "@/lib/queries/users/useUsers";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({ ChevronDownIcon: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/queries/users/useUsers", () => ({
  useUserQuery: vi.fn(),
  useUpdateUserMutation: vi.fn(),
}));

describe("user editor", () => {
  it("explains why a shared account cannot have its global status changed", () => {
    vi.mocked(useUserQuery).mockReturnValue({
      data: {
        id: "user-1", email: "person@example.com", fullName: "Test Person",
        avatarUrl: null, status: "ACTIVE", roleCodes: ["ADMIN"],
        lastLoginAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      },
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useUpdateUserMutation).mockReturnValue({
      error: new ApiError(409, "SHARED_ACCOUNT_STATUS_CHANGE", "Status change denied"),
      isPending: false,
    } as never);

    render(<UserEditor organizationId="org-a" userId="user-1" actorId="admin-1" onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText("sharedAccountStatus")).toBeInTheDocument();
  });
});
