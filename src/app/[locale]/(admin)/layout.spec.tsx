import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "./layout";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";

const replace = vi.fn();
vi.mock("@/context/SidebarContext", () => ({ useSidebar: () => ({ isExpanded: true, isHovered: false, isMobileOpen: false }) }));
vi.mock("@/layout/AppHeader", () => ({ default: () => <div>header</div> }));
vi.mock("@/layout/AppSidebar", () => ({ default: () => <div>sidebar</div> }));
vi.mock("@/layout/Backdrop", () => ({ default: () => null }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/auth/useAuth", () => ({ useCurrentUserQuery: vi.fn() }));

describe("protected dashboard layout", () => {
  beforeEach(() => replace.mockReset());

  it("keeps authenticated content mounted during a background session refresh", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "current-user" },
      error: null,
      isError: false,
      isFetching: true,
    } as never);

    render(<AdminLayout><div>Protected content</div></AdminLayout>);

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("hides stale dashboard data and redirects once /auth/me returns 401", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "stale-user" },
      error: new ApiError(401, "AUTHENTICATION_FAILED", "Expired"),
      isError: true,
      isFetching: false,
    } as never);

    render(<AdminLayout><div>Protected content</div></AdminLayout>);

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
  });

  it("shows a retry alert for a server error without redirecting", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      error: new ApiError(503, undefined, "Unavailable"),
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<AdminLayout><div>Protected content</div></AdminLayout>);

    expect(screen.getByText("sessionUnavailable")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
