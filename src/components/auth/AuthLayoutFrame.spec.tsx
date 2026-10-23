import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import AuthLayoutFrame from "./AuthLayoutFrame";

let pathname = "/signin";
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));
vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));
vi.mock("@/components/common/ThemeTogglerTwo", () => ({
  default: () => <button>Theme</button>,
}));
vi.mock("./LegacyAuthLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="legacy-auth">{children}</div>
  ),
}));
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span />,
  CheckCircleIcon: () => <span />,
}));

function renderLayout() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthLayoutFrame>
        <main>Account content</main>
      </AuthLayoutFrame>
    </NextIntlClientProvider>,
  );
}

describe("Authentication presentation routes", () => {
  it.each([
    "/signin",
    "/signup",
    "/reset-password",
    "/select-organization",
    "/onboarding",
  ])("uses the scrollable organic layout on %s", (route) => {
    pathname = route;
    const { container } = renderLayout();
    expect(container.querySelector("[data-auth-route]")).toHaveAttribute(
      "data-auth-route",
      route,
    );
    expect(
      screen.getByRole("region", { name: "Account and workspace setup" }),
    ).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("main")).toHaveTextContent("Account content");
    expect(screen.queryByTestId("legacy-auth")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Home$/ })).toHaveAttribute(
      "href",
      "/",
    );
    if (route === "/signin")
      expect(
        screen.getByRole("link", { name: "Create account" }),
      ).toHaveAttribute("href", "/signup");
    else
      expect(
        screen.queryByRole("link", { name: "Create account" }),
      ).not.toBeInTheDocument();
  });

  it.each(["/other-auth-route"])(
    "preserves the existing layout on %s",
    (route) => {
      pathname = route;
      renderLayout();
      expect(screen.getByTestId("legacy-auth")).toHaveTextContent(
        "Account content",
      );
      expect(
        screen.queryByRole("region", { name: "Account and workspace setup" }),
      ).not.toBeInTheDocument();
    },
  );
});
