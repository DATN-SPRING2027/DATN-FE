import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("displays the interactive 3D Robot handshake stage on submit and supports cheering while waiting", () => {
    render(<GoogleOAuthButton label="Continue with Google" />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    const form = button.closest("form")!;

    expect(
      screen.queryByTestId("auth-robot-stage-google-handshake"),
    ).not.toBeInTheDocument();

    fireEvent.submit(form);

    expect(
      screen.getByTestId("auth-robot-stage-google-handshake"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("robot-3d-stage")).toBeInTheDocument();
    expect(screen.getByTestId("auth-robot-speech-text")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("auth-robot-interactive-pod"));
    expect(screen.getByTestId("auth-robot-cheer-badge")).toHaveTextContent(
      "⚡ x1",
    );

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(
      screen.queryByTestId("auth-robot-stage-google-handshake"),
    ).not.toBeInTheDocument();
  });
});
