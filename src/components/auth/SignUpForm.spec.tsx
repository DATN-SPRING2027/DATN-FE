import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { useRequestEmailRegistrationMutation } from "@/lib/queries/auth/useAuth";
import SignUpForm from "./SignUpForm";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    onClick,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/icons", () => ({
  ArrowRightIcon: () => null,
  ChevronLeftIcon: () => null,
  EnvelopeIcon: () => null,
  GoogleIcon: () => null,
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useRequestEmailRegistrationMutation: vi.fn(),
}));

function renderSignUp(initialEmail?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SignUpForm initialEmail={initialEmail} />
    </NextIntlClientProvider>,
  );
}

describe("SignUpForm legal consent & registration", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    mutateAsync.mockReset();
    vi.mocked(useRequestEmailRegistrationMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as never);
  });

  it("renders links to /terms and /privacy without toggling the consent checkbox on link click", () => {
    renderSignUp();

    const termsLink = screen.getByRole("link", { name: "Terms and Conditions" });
    const privacyLink = screen.getByRole("link", { name: "Privacy Policy" });
    const checkbox = screen.getByRole("checkbox");

    expect(termsLink).toHaveAttribute("href", "/terms");
    expect(termsLink).toHaveAttribute("target", "_blank");
    expect(privacyLink).toHaveAttribute("href", "/privacy");
    expect(privacyLink).toHaveAttribute("target", "_blank");

    fireEvent.click(termsLink);
    expect(checkbox).not.toBeChecked();
  });

  it("blocks form submission until the user explicitly accepts the Terms and Privacy Policy", async () => {
    mutateAsync.mockResolvedValue({ accepted: true });
    renderSignUp();

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "  Tran Kim Thang  " },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  kimthang.work@gmail.com  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent(
      "Please accept the Terms and Conditions and Privacy Policy to create your account.",
    );

    fireEvent.click(checkbox);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        fullName: "Tran Kim Thang",
        email: "kimthang.work@gmail.com",
      });
    });
  });
});
