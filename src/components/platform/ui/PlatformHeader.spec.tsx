import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformHeader from "./PlatformHeader";
import PlatformSidebar from "./PlatformSidebar";
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
describe("Operator navigation", () => {
  it("marks the active route and shows grouped administration links", () => {
    render(
      <PlatformSidebar
        activeSection="dashboard"
        permissions={[
          "platform.dashboard.summary.read",
          "platform.incidents.incident.read",
          "platform.organizations.organization.read",
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "navigation.dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "navigation.incidents" }),
    ).toHaveAttribute("href", "/platform/incidents");
    expect(
      screen.getByRole("link", { name: "navigation.organizations" }),
    ).toHaveAttribute("href", "/platform/organizations");
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

describe("Platform navigation search", () => {
  it("finds a destination, shows empty results, and dismisses with Escape", () => {
    render(
      <PlatformHeader
        activeSection="dashboard"
        userName="Platform Admin"
        onSignOut={vi.fn()}
      />,
    );
    const search = screen.getByRole("textbox", { name: "jira.searchPages" });
    fireEvent.change(search, { target: { value: "users" } });
    expect(
      screen.getByRole("link", { name: "navigation.users" }),
    ).toHaveAttribute("href", "/platform/users");
    fireEvent.change(search, { target: { value: "unmatched" } });
    expect(screen.getByText("jira.noPages")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(screen.queryByText("jira.noPages")).not.toBeInTheDocument();
  });
});
