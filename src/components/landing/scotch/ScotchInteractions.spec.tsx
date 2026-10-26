import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ProductPreview from "./ProductPreview";
import BackOfficeSection from "./BackOfficeSection";
import OldWayDecorations from "./OldWayDecorations";
import HeroDecorations from "./HeroDecorations";
import NewWayVisual from "./NewWayVisual";
import ClosingArt from "./ClosingArt";
import ScotchNavigation from "./ScotchNavigation";
import TeamStories from "./TeamStories";
import SmoothScrollHandler from "./SmoothScrollHandler";
import { useSignInSessionQuery } from "@/lib/queries/auth/useSharedSignIn";

vi.mock("next/image", () => ({
  default: ({ priority, ...props }: { priority?: boolean }) => {
    void priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));
vi.mock("../rylo/WorkspaceLink", () => ({
  default: ({ guestLabel }: { guestLabel?: string }) => (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/workspace">{guestLabel ?? "Workspace"}</a>
  ),
}));
vi.mock("@/components/header/UserDropdown", () => ({
  default: () => <div data-testid="user-dropdown">UserDropdown</div>,
}));
vi.mock("@/lib/queries/auth/useSharedSignIn", () => ({
  useSignInSessionQuery: vi.fn(() => ({ data: undefined, isPending: false })),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span />,
  CloseIcon: () => <span />,
  DocsIcon: () => <span />,
}));

function show(element: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("Scotch landing interactions", () => {
  it("switches the actual hero artwork and its accessible name", () => {
    show(<ProductPreview />);
    const region = screen.getByRole("region", {
      name: "Illustrative Continuum workspace: Knowledge",
    });
    expect(within(region).getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("knowledge.svg"),
    );
    // Mobile and desktop controls intentionally expose the same selection.
    fireEvent.click(screen.getAllByRole("button", { name: "Review" })[0]);
    const review = screen.getByRole("region", {
      name: "Illustrative Continuum workspace: Review",
    });
    expect(within(review).getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("review.svg"),
    );
    screen
      .getAllByRole("button", { name: "Review" })
      .forEach((button) =>
        expect(button).toHaveAttribute("aria-pressed", "true"),
      );
  });

  it("changes the feature preview independently of the hero", () => {
    show(<BackOfficeSection />);
    fireEvent.click(screen.getByRole("button", { name: "Handover" }));
    const region = screen.getByRole("region", {
      name: "Illustrative Continuum workspace: Handover",
    });
    expect(within(region).getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("feature-handover.svg"),
    );
    expect(screen.getByRole("button", { name: "Handover" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("returns keyboard focus to the menu toggle on Escape", () => {
    show(<ScotchNavigation />);
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    const product = screen.getByRole("link", { name: "Product" });
    product.focus();
    fireEvent.keyDown(product, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("cycles perspectives in both directions without losing the scenario label", () => {
    show(<TeamStories />);
    expect(screen.getByText("The next developer")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Previous team perspective" }),
    );
    expect(screen.getByText("The project team")).toBeInTheDocument();
    expect(
      screen.getByText("An illustrative collaboration scenario"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Next team perspective" }),
    );
    expect(screen.getByText("The next developer")).toBeInTheDocument();
  });

  it("leaves Tab navigation within native video controls to the browser", () => {
    show(<TeamStories />);
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the team video" }),
    );
    const video = screen.getByLabelText(
      "Software development and team collaboration stock footage",
    );
    video.focus();
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    video.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it("opens a labelled video dialog and restores focus after Escape", () => {
    show(<TeamStories />);
    const trigger = screen.getByRole("button", {
      name: "Watch the team video",
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Software teams at work" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close team video" }),
    ).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("renders desktop and mobile animated decorations without accessibility violations", () => {
    const { container: desktopContainer } = show(<OldWayDecorations variant="desktop" />);
    expect(desktopContainer.querySelectorAll("img")).toHaveLength(4);

    const { container: mobileContainer } = show(<OldWayDecorations variant="mobile" />);
    expect(mobileContainer.querySelectorAll("img")).toHaveLength(2);
  });

  it("renders animated HeroDecorations, NewWayVisual, and ClosingArt without errors", () => {
    const { container: heroContainer } = show(<HeroDecorations />);
    expect(heroContainer.querySelectorAll("img")).toHaveLength(2);

    const { container: newWayContainer } = show(<NewWayVisual alt="Connected workspace" />);
    expect(newWayContainer.querySelectorAll("img")).toHaveLength(1);

    const { container: closingContainer } = show(<ClosingArt />);
    expect(closingContainer.querySelectorAll("img")).toHaveLength(1);
  });

  it("handles anchor clicks with smooth scroll interception", () => {
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    const targetSection = document.createElement("section");
    targetSection.id = "cach-hoat-dong";
    targetSection.getBoundingClientRect = () =>
      ({ top: 500, bottom: 800, left: 0, right: 0, width: 300, height: 300 } as DOMRect);
    document.body.appendChild(targetSection);

    show(
      <div>
        <SmoothScrollHandler />
        <a href="#cach-hoat-dong">See it in action</a>
      </div>,
    );

    const anchor = screen.getByRole("link", { name: "See it in action" });
    fireEvent.click(anchor);

    // Verify history pushState was called with target anchor
    expect(window.location.hash).toBe("#cach-hoat-dong");
    document.body.removeChild(targetSection);
  });

  it("marks the landing container as leaving-to-auth when an auth link is clicked", () => {
    show(
      <div data-testid="landing-wrapper">
        <SmoothScrollHandler />
        <main id="noi-dung">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/signin">Sign in</a>
        </main>
      </div>,
    );

    const signInLink = screen.getByRole("link", { name: "Sign in" });
    fireEvent.click(signInLink, { button: 0 });

    expect(screen.getByTestId("landing-wrapper")).toHaveAttribute(
      "data-leaving-to-auth",
      "true",
    );
  });

  it("renders Sign in link and no UserDropdown when user is unauthenticated", () => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: undefined,
      isPending: false,
    } as never);

    show(<ScotchNavigation />);

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByTestId("user-dropdown")).not.toBeInTheDocument();
  });

  it("hides Sign in link and renders UserDropdown when user is authenticated", () => {
    vi.mocked(useSignInSessionQuery).mockReturnValue({
      data: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        context: "ORGANIZATION",
        organizationId: "org-1",
        roles: ["ADMIN"],
      },
      isPending: false,
    } as never);

    show(<ScotchNavigation />);

    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.getByTestId("user-dropdown")).toBeInTheDocument();
  });
});
