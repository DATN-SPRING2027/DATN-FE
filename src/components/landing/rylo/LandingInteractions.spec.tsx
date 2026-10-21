import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { useSignInSessionQuery } from "@/lib/queries/auth/useSharedSignIn";
import KnowledgeJourney from "./KnowledgeJourney";
import LandingNavigation from "./LandingNavigation";
import WorkspaceLink from "./WorkspaceLink";

vi.mock("@/lib/queries/auth/useSharedSignIn", () => ({
  useSignInSessionQuery: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));
vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span />,
  DocsIcon: () => <span />,
  CheckCircleIcon: () => <span />,
  HandShakeIcon: () => <span />,
  CloseIcon: () => <span />,
  PlusIcon: () => <span />,
}));

function renderLanding(element: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(useSignInSessionQuery).mockReturnValue({
    data: undefined,
    isPending: false,
  } as never);
});

describe("Rylo-inspired landing interactions", () => {
  it("switches the illustrative journey and exposes the selected stage", () => {
    renderLanding(<KnowledgeJourney />);
    expect(
      screen.getByRole("heading", { name: "Why was this approach chosen?" }),
    ).toBeInTheDocument();
    const verify = screen.getByRole("button", { name: /Check the evidence/ });
    fireEvent.click(verify);
    expect(verify).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: "Evidence you can check." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Why was this approach chosen?" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hand over with/ }));
    expect(
      screen.getByRole("heading", {
        name: "The next person understands why.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Illustrative knowledge workflow" }),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("closes navigation with Escape and returns focus to its toggle", () => {
    renderLanding(<LandingNavigation />);
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const solution = screen.getByRole("link", { name: "Solutions" });
    solution.focus();
    fireEvent.keyDown(solution, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    fireEvent.click(solution);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(solution).toHaveAttribute("href", "#giai-phap");
  });

  it("keeps a sign-in recovery path when the session cannot be loaded", () => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as never);
    renderLanding(<WorkspaceLink />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin",
    );
  });

  it.each([
    ["ACCOUNT", "/onboarding"],
    ["ORGANIZATION", "/dashboard"],
  ])("routes a signed-in %s user to %s", (context, href) => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: { context } as never,
      isPending: false,
    } as never);
    renderLanding(<WorkspaceLink />);
    expect(
      screen.getByRole("link", { name: "Open your workspace" }),
    ).toHaveAttribute("href", href);
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a Platform operator session and routes its action to the console", () => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: {
        id: "operator-1",
        email: "operator@example.test",
        name: "Operator",
        context: "PLATFORM",
        permissions: [],
      },
      isPending: false,
    } as never);
    renderLanding(<WorkspaceLink guestLabel="Get started" hideIcon />);
    expect(
      screen.getByRole("link", { name: "Open your workspace" }),
    ).toHaveAttribute("href", "/platform");
    expect(
      screen.queryByRole("link", { name: "Get started" }),
    ).not.toBeInTheDocument();
  });

  it("announces session loading before showing an account action", () => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: undefined,
      isPending: true,
    } as never);
    renderLanding(<WorkspaceLink />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
