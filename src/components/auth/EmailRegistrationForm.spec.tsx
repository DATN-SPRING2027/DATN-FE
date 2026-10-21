import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmailRegistrationForm from "./EmailRegistrationForm";

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useVerifyEmailRegistrationMutation: () => ({
    mutateAsync: mocks.verify,
    isPending: false,
    error: undefined,
  }),
}));

const invitationId = "3123456789abcdef01234567";
const token = "a".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue(undefined);
  window.sessionStorage.clear();
  window.history.replaceState(
    null,
    "",
    `/verify-email?returnToInvitationId=${invitationId}#token=${token}`,
  );
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
});

describe("EmailRegistrationForm", () => {
  it("does not resume an Organization invitation from a legacy registration URL", async () => {
    render(<EmailRegistrationForm />);

    expect(await screen.findByLabelText("newPassword")).toBeVisible();
    expect(window.location.href).not.toContain(token);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");

    fireEvent.change(screen.getByLabelText("newPassword"), {
      target: { value: "a-long-password-123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "a-long-password-123" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "emailRegistrationSetPasswordAction",
      }),
    );

    expect(mocks.verify).toHaveBeenCalledWith({
      token,
      password: "a-long-password-123",
    });
    const signIn = await screen.findByRole("link", { name: "backToSignIn" });
    await waitFor(() =>
      expect(signIn).toHaveAttribute(
        "href",
        "/signin",
      ),
    );
    expect(window.location.href).not.toContain(token);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem("organizationInvitationReturnTo")).toBeNull();
  });
});
