import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GoogleOAuthButton from "./GoogleOAuthButton";

vi.mock("@/icons", () => ({ GoogleIcon: () => null }));

describe("GoogleOAuthButton", () => {
  it("navigates the browser to the FE OAuth BFF route", () => {
    render(<GoogleOAuthButton label="Continue with Google" />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button.closest("form")).toHaveAttribute(
      "action",
      "/api/auth/google",
    );
    expect(button.closest("form")).toHaveAttribute("method", "get");
  });
});
