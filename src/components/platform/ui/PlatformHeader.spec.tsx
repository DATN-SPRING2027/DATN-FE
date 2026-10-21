import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformHeader from "./PlatformHeader";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/common/BrandLogo", () => ({ default: () => null }));
vi.mock("@/components/common/ThemeToggleButton", () => ({
  ThemeToggleButton: () => null,
}));
vi.mock("@/icons", () => ({ ChevronDownIcon: () => null }));
describe("Operator top navigation", () => {
  it("marks the active route and exposes supplementary routes through More", () => {
    render(
      <PlatformHeader
        activeSection="dashboard"
        onSignOut={vi.fn()}
        userName="Operator"
        userEmail="operator@example.test"
      />,
    );
    expect(
      screen.getByRole("link", { name: "navigation.dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    const summary = screen.getByText("operatorDesign.more");
    fireEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(
      screen.getByRole("link", { name: "navigation.incidents" }),
    ).toHaveAttribute("href", "/platform/incidents");
    fireEvent.keyDown(summary, { key: "Escape" });
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });
  it("uses the session identity and keeps sign-out functional", () => {
    const signOut = vi.fn();
    render(
      <PlatformHeader
        activeSection="dashboard"
        onSignOut={signOut}
        userName="Actual Operator"
        userEmail="actual@example.test"
      />,
    );
    fireEvent.click(screen.getByLabelText("operatorDesign.account"));
    expect(screen.getByText("actual@example.test")).toBeInTheDocument();
    expect(
      screen.queryByText("operator@continuum.test"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "signOut" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
