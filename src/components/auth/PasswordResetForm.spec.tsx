import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  useCompletePasswordResetMutation,
  useRequestPasswordResetMutation,
} from "@/lib/queries/auth/useAuth";
import PasswordResetForm from "./PasswordResetForm";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCompletePasswordResetMutation: vi.fn(),
  useRequestPasswordResetMutation: vi.fn(),
}));

describe("PasswordResetForm", () => {
  const requestMutation = vi.fn();
  const confirmMutation = vi.fn();

  beforeEach(() => {
    requestMutation.mockReset();
    confirmMutation.mockReset();
    vi.mocked(useRequestPasswordResetMutation).mockReturnValue({
      mutateAsync: requestMutation,
      isPending: false,
      error: null,
    } as never);
    vi.mocked(useCompletePasswordResetMutation).mockReturnValue({
      mutateAsync: confirmMutation,
      isPending: false,
      error: null,
    } as never);
  });

  it("submits email and shows the same generic confirmation", async () => {
    requestMutation.mockResolvedValue({ status: "accepted" });
    render(<PasswordResetForm />);

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "sendResetLink" }));

    await waitFor(() =>
      expect(requestMutation).toHaveBeenCalledWith({
        email: "person@example.com",
      }),
    );
    expect(screen.getByText("resetRequestAcceptedMessage")).toBeInTheDocument();
  });

  it("does not submit mismatched passwords", () => {
    render(<PasswordResetForm token={"a".repeat(43)} />);
    fireEvent.change(screen.getByLabelText("newPassword"), {
      target: { value: "A-long-password-123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "A-different-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "resetPasswordAction" }),
    );

    expect(screen.getByText("passwordMismatch")).toBeInTheDocument();
    expect(confirmMutation).not.toHaveBeenCalled();
  });

  it("submits a matching password and replaces the token-bearing address", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    confirmMutation.mockResolvedValue(undefined);
    render(<PasswordResetForm token={"a".repeat(43)} />);
    fireEvent.change(screen.getByLabelText("newPassword"), {
      target: { value: "A-long-password-123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "A-long-password-123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "resetPasswordAction" }),
    );

    await waitFor(() =>
      expect(confirmMutation).toHaveBeenCalledWith({
        token: "a".repeat(43),
        password: "A-long-password-123",
      }),
    );
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      window.location.pathname,
    );
    expect(screen.getByText("resetPasswordSuccessMessage")).toBeInTheDocument();
  });

  it("uses one generic message for expired or already used reset links", () => {
    vi.mocked(useCompletePasswordResetMutation).mockReturnValue({
      mutateAsync: confirmMutation,
      isPending: false,
      error: new ApiError(400, "PASSWORD_RESET_TOKEN_INVALID", "expired"),
    } as never);
    render(<PasswordResetForm token={"a".repeat(43)} />);

    expect(screen.getByText("resetPasswordInvalidMessage")).toBeInTheDocument();
  });

  it("explains when the password exceeds the supported length limit", () => {
    vi.mocked(useCompletePasswordResetMutation).mockReturnValue({
      mutateAsync: confirmMutation,
      isPending: false,
      error: new ApiError(
        422,
        "PASSWORD_RESET_PASSWORD_INVALID",
        "unsupported password length",
      ),
    } as never);
    render(<PasswordResetForm token={"a".repeat(43)} />);

    expect(screen.getByText("passwordLengthError")).toBeInTheDocument();
  });
});
