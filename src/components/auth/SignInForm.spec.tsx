import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "./SignInForm";
import { useCurrentUserQuery, useLoginMutation } from "@/lib/queries/auth/useAuth";
import { ApiError } from "@/lib/api-client";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({
  ChevronLeftIcon: () => null,
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
    vi.mocked(useCurrentUserQuery).mockReturnValue({ data: undefined, isFetching: false, refetch } as never);
    vi.mocked(useLoginMutation).mockReturnValue({ mutateAsync, isPending: false, error: null } as never);
  });

  it("submits credentials and verifies the cookie session through /auth/me", async () => {
    mutateAsync.mockResolvedValue({ user: { id: "user-1" } });
    refetch.mockResolvedValue({ data: { id: "user-1" } });
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ email: "user@example.com", password: "secret" }));
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
  });

  it("offers eligible organizations by name after a verified 409 response", async () => {
    mutateAsync.mockRejectedValue(new ApiError(409, "ORGANIZATION_SELECTION_REQUIRED", "Select an organization", [
      { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Alpha" },
      { id: "651a2b3c4d5e6f7a8b9c0d20", name: "Beta" },
    ]));
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("organizationId"), { target: { value: "651a2b3c4d5e6f7a8b9c0d20" } });
    mutateAsync.mockResolvedValue({ user: { id: "user-1" } });
    refetch.mockResolvedValue({ data: { id: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      email: "user@example.com", password: "secret", organizationId: "651a2b3c4d5e6f7a8b9c0d20",
    }));
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
