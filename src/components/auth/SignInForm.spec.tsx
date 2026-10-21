import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "./SignInForm";
import {
  useCurrentUserQuery,
  useLoginMutation,
} from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ replace }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => null,
  EnvelopeIcon: () => null,
  GoogleIcon: () => null,
  EyeCloseIcon: () => null,
  EyeIcon: () => null,
  ChevronDownIcon: () => null,
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: vi.fn(),
  useLoginMutation: vi.fn(),
}));

describe("sign in form", () => {
  const refetch = vi.fn();
  const mutateAsync = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    refetch.mockReset();
    mutateAsync.mockReset();
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: undefined,
      isFetching: false,
      refetch,
    } as never);
    vi.mocked(useLoginMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as never);
  });

  it("supports keyboard-accessible password visibility without changing credentials", () => {
    render(<SignInForm />);
    const password = screen.getByLabelText("password");
    fireEvent.change(password, { target: { value: "local-preview-password" } });
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "showPassword" }));
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "hidePassword" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "hidePassword" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("local-preview-password");
    expect(
      screen.getByRole("checkbox", { name: "remember" }),
    ).toBeInTheDocument();
  });

  it("keeps a direct link to Admin sign-in", () => {
    render(<SignInForm />);

    expect(
      screen.getByRole("link", { name: "platformSignIn" }),
    ).toHaveAttribute("href", "/platform/signin");
  });

  it("does not offer account creation from an Organization invitation sign-in", () => {
    render(
      <SignInForm
        returnTo="/organization/invitations?invitationId=3123456789abcdef01234567"
        initialEmail="invitee@example.test"
      />,
    );

    expect(screen.queryByRole("link", { name: "signinJoin" })).toBeNull();
  });

  it("routes an authenticated organization member to Organization selection", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        context: "ORGANIZATION",
        organizationId: "org-1",
        roles: ["MEMBER"],
      },
      isSuccess: true,
      isFetching: false,
      refetch,
    } as never);

    render(<SignInForm />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/select-organization"),
    );
  });

  it("routes an authenticated account without an organization to Organization selection", async () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      data: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        context: "ACCOUNT",
      },
      isSuccess: true,
      isFetching: false,
      refetch,
    } as never);

    render(<SignInForm />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/select-organization"),
    );
  });

  it("submits credentials and verifies the cookie session through /auth/me", async () => {
    mutateAsync.mockResolvedValue({ user: { id: "user-1" } });
    refetch.mockResolvedValue({ data: { id: "user-1" } });
    render(<SignInForm />);

    expect(
      screen.getByRole("button", { name: "continueWithGoogle" }),
    ).toBeInTheDocument();
    expect(screen.getByText("alternative")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "signIn" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret",
      }),
    );
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
  });

  it("offers Google sign-in and shows the organization provisioning message", () => {
    render(<SignInForm googleStatus="organization-required" />);

    const googleButton = screen.getByRole("button", {
      name: "continueWithGoogle",
    });
    expect(googleButton.closest("form")).toHaveAttribute(
      "action",
      "/api/auth/google",
    );
    expect(screen.getByText("googleOrganizationRequired")).toBeInTheDocument();
  });

  it("offers eligible organizations by name after a verified 409 response", async () => {
    mutateAsync.mockRejectedValue(
      new ApiError(
        409,
        "ORGANIZATION_SELECTION_REQUIRED",
        "Select an organization",
        [
          { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Alpha" },
          { id: "651a2b3c4d5e6f7a8b9c0d20", name: "Beta" },
        ],
      ),
    );
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "signIn" }));

    expect(
      await screen.findByRole("option", { name: "Alpha" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("organizationId"), {
      target: { value: "651a2b3c4d5e6f7a8b9c0d20" },
    });
    mutateAsync.mockResolvedValue({ user: { id: "user-1" } });
    refetch.mockResolvedValue({ data: { id: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "signIn" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenLastCalledWith({
        email: "user@example.com",
        password: "secret",
        organizationId: "651a2b3c4d5e6f7a8b9c0d20",
      }),
    );
  });

  it.each([
    [401, "invalidCredentials"],
    [409, "organizationRequired"],
    [422, "invalidInput"],
    [429, "rateLimited"],
  ])("shows the existing alert for HTTP %i", (status, message) => {
    vi.mocked(useLoginMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: new ApiError(status, undefined, "Failed"),
    } as never);
    render(<SignInForm />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
