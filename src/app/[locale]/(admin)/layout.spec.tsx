import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "./layout";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";

const replace = vi.fn();
const path = vi.hoisted(() => ({ value: "/dashboard" }));
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({
    isExpanded: true,
    isHovered: false,
    isMobileOpen: false,
  }),
}));
vi.mock("@/layout/AppHeader", () => ({ default: () => <div>header</div> }));
vi.mock("@/layout/AppSidebar", () => ({ default: () => <div>sidebar</div> }));
vi.mock("@/layout/Backdrop", () => ({ default: () => null }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => path.value,
  useRouter: () => ({ replace }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/auth/useAuth", () => ({ useCurrentUserQuery: vi.fn() }));

describe("protected dashboard layout", () => {
  beforeEach(() => {
    replace.mockReset();
    path.value = "/dashboard";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fits the Chat shell to the visible viewport when a mobile keyboard reduces available height", () => {
    path.value = "/chat";
    const viewport = Object.assign(new EventTarget(), { height: 650 });
    vi.stubGlobal("visualViewport", viewport);
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "user", organizationId: "organization" },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);
    render(
      <AdminLayout>
        <div>Chat content</div>
      </AdminLayout>,
    );
    const shell = screen.getByText("Chat content").closest(".h-dvh");
    expect(shell).toHaveStyle({ height: "650px" });
    act(() => {
      viewport.height = 430;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(shell).toHaveStyle({ height: "430px" });
  });

  it("replays the chat content entrance when navigating between chat routes", () => {
    path.value = "/chat";
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "user", organizationId: "organization" },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    const onMount = vi.fn();
    function ChatContent() {
      useEffect(() => {
        onMount();
      }, []);
      return <div>Chat content</div>;
    }

    const { rerender } = render(
      <AdminLayout>
        <ChatContent />
      </AdminLayout>,
    );
    const header = screen.getByText("header");
    const sidebar = screen.getByText("sidebar");

    expect(screen.getByText("Chat content").parentElement).toHaveClass(
      "continuum-page-enter",
    );
    expect(onMount).toHaveBeenCalledTimes(1);

    path.value = "/ai-chat";
    rerender(
      <AdminLayout>
        <ChatContent />
      </AdminLayout>,
    );

    expect(onMount).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Chat content").parentElement).toHaveClass(
      "continuum-page-enter",
    );
    expect(screen.getByText("header")).toBe(header);
    expect(screen.getByText("sidebar")).toBe(sidebar);
  });

  it("keeps the error card and Trying again button when an explicit retry becomes pending", async () => {
    let finish!: () => void;
    const refetch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      error: new ApiError(403, "AUTH_CSRF_INVALID", "Failed"),
      refetch,
    } as never);
    const view = render(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );
    fireEvent.click(screen.getByRole("button", { name: "tryAgain" }));
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: true,
      error: null,
      refetch,
    } as never);
    view.rerender(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );
    expect(screen.getByText("sessionUnavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "retryingSession" }),
    ).toBeDisabled();
    expect(screen.queryByText("checkingSession")).not.toBeInTheDocument();
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "user" },
      isError: false,
      isFetching: false,
      error: null,
      refetch,
    } as never);
    await act(async () => {
      finish();
    });
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows session verification while initially recovering and hides protected content", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: true,
    } as never);
    render(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("checkingSession");
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("disables explicit retry while a recovery request is in flight", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: true,
      error: new ApiError(
        503,
        "SESSION_RECOVERY_FAILED",
        "Offline",
        undefined,
        true,
      ),
      refetch: vi.fn(),
    } as never);
    render(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );
    expect(
      screen.getByRole("button", { name: "retryingSession" }),
    ).toBeDisabled();
  });

  it("keeps authenticated content mounted during a background session refresh", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "current-user" },
      error: null,
      isError: false,
      isFetching: true,
    } as never);

    render(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("hides stale dashboard data and redirects once /auth/me returns 401", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: { id: "stale-user" },
      error: new ApiError(401, "AUTHENTICATION_FAILED", "Expired"),
      isError: true,
      isFetching: false,
    } as never);

    render(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
  });

  it("routes an authenticated Account without membership to onboarding", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: "new-user",
        email: "new@example.test",
        name: "New User",
        context: "ACCOUNT",
      },
      error: null,
      isError: false,
      isFetching: false,
    } as never);
    render(
      <AdminLayout>
        <div>Organization data</div>
      </AdminLayout>,
    );
    expect(screen.queryByText("Organization data")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("shows a retry alert for a server error without redirecting", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      error: new ApiError(503, undefined, "Unavailable"),
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(
      <AdminLayout>
        <div>Protected content</div>
      </AdminLayout>,
    );

    expect(screen.getByText("sessionUnavailable")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([403, 500, 503])(
    "shows recovery failure %s and only retries when the user asks",
    async (status) => {
      const refetch = vi.fn();
      vi.mocked(useCurrentUserQuery).mockReturnValue({
        data: { id: "stale-user" },
        error: new ApiError(
          status,
          "AUTH_REFRESH_FAILED",
          "Failed",
          undefined,
          true,
        ),
        isError: true,
        refetch,
      } as never);
      render(
        <AdminLayout>
          <div>Protected content</div>
        </AdminLayout>,
      );
      expect(screen.getByText("sessionUnavailableMessage")).toBeInTheDocument();
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
      expect(refetch).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "tryAgain" }));
      });
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(replace).not.toHaveBeenCalled();
    },
  );
});
