import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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
vi.mock("@/icons", () => ({
  CheckCircleIcon: () => null,
  CheckLineIcon: () => null,
  ChevronLeftIcon: () => null,
  EnvelopeIcon: () => null,
  EyeCloseIcon: () => null,
  EyeIcon: () => null,
  LockIcon: () => null,
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCompletePasswordResetMutation: vi.fn(),
  useRequestPasswordResetMutation: vi.fn(),
}));

function renderWithResetToken(token: string) {
  window.history.replaceState(null, "", `/reset-password#token=${token}`);
  return render(<PasswordResetForm />);
}

describe("PasswordResetForm", () => {
  const requestMutation = vi.fn();
  const confirmMutation = vi.fn();

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
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
    renderWithResetToken("a".repeat(43));
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

  it("clears and recalculates the mismatch warning while passwords are edited", () => {
    renderWithResetToken("a".repeat(43));
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

    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "A-long-password-123" },
    });
    expect(screen.queryByText("passwordMismatch")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "A-different-password" },
    });
    expect(screen.getByText("passwordMismatch")).toBeInTheDocument();
  });

  it("reads the token from the URL fragment and clears it before submission", async () => {
    const token = "a".repeat(43);
    window.history.replaceState(null, "", `/reset-password#token=${token}`);
    const replaceState = vi.spyOn(window.history, "replaceState");
    confirmMutation.mockResolvedValue(undefined);
    render(<PasswordResetForm />);

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/reset-password",
    );
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");

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
        token,
        password: "A-long-password-123",
      }),
    );
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(screen.getByText("resetPasswordSuccessMessage")).toBeInTheDocument();
  });

  it("does not accept reset tokens from a query string", () => {
    const token = "a".repeat(43);
    window.history.replaceState(null, "", `/reset-password?token=${token}`);
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(<PasswordResetForm />);

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/reset-password",
    );
    expect(screen.getByText("forgotPasswordTitle")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(confirmMutation).not.toHaveBeenCalled();
  });

  it("keeps the reset token when React replays the mount effect", () => {
    window.history.replaceState(
      null,
      "",
      `/reset-password#token=${"a".repeat(43)}`,
    );
    render(
      <StrictMode>
        <PasswordResetForm />
      </StrictMode>,
    );

    expect(screen.getByLabelText("newPassword")).toBeInTheDocument();
  });

  it("uses one generic message for expired or already used reset links", () => {
    vi.mocked(useCompletePasswordResetMutation).mockReturnValue({
      mutateAsync: confirmMutation,
      isPending: false,
      error: new ApiError(400, "PASSWORD_RESET_TOKEN_INVALID", "expired"),
    } as never);
    renderWithResetToken("a".repeat(43));

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
    renderWithResetToken("a".repeat(43));

    expect(screen.getByText("passwordLengthError")).toBeInTheDocument();
  });

  it("blocks passwords that exceed bcrypt's UTF-8 byte limit", () => {
    renderWithResetToken("a".repeat(43));
    const password = "é".repeat(37);
    fireEvent.change(screen.getByLabelText("newPassword"), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: password },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "resetPasswordAction" }),
    );

    expect(screen.getByText("passwordLengthError")).toBeInTheDocument();
    expect(confirmMutation).not.toHaveBeenCalled();
  });
});
