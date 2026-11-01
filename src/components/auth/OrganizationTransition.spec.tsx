import { act, render, screen } from "@testing-library/react";
import { gsap } from "gsap";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrganizationTransition from "./OrganizationTransition";

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce")
        ? reducedMotion
        : !reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("OrganizationTransition — Continuum AI Neural Signature", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Continuum AI logo, wordmark, and organization name while waiting for backend readiness", () => {
    mockMatchMedia(false);
    const onComplete = vi.fn();

    render(
      <OrganizationTransition
        organizationName="Continuum AI Labs"
        ready={false}
        onComplete={onComplete}
      />,
    );

    const status = screen.getByRole("status", {
      name: "Opening Continuum AI Labs workspace",
    });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("heading", { name: "Continuum AI" }),
    ).toBeInTheDocument();
    expect(screen.getByText("YOUR KNOWLEDGE, CONNECTED")).toBeInTheDocument();
    expect(screen.getByText("Connecting workspace")).toBeInTheDocument();
    expect(screen.getByText("Continuum AI Labs")).toBeInTheDocument();

    const logo = status.querySelector("img.cnt-logo");
    expect(logo).toHaveAttribute("src", "/continuum-ai-logo.png");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("plays the ~2.7s GSAP sequence when backend finishes early and calls onComplete once", () => {
    mockMatchMedia(false);
    const onComplete = vi.fn();
    const baseTime = gsap.globalTimeline.time();

    const { rerender } = render(
      <OrganizationTransition
        organizationName="North Star"
        ready={false}
        onComplete={onComplete}
      />,
    );

    // Backend resolves at 0.50s while Phase 1 is still playing
    act(() => {
      gsap.updateRoot(baseTime + 0.5);
    });
    rerender(
      <OrganizationTransition
        organizationName="North Star"
        ready={true}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByText("Workspace ready")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    // Advance past intro (2.22s) -> triggers setIntroDone(true) and mounts Phase 4 exit timeline
    act(() => {
      gsap.updateRoot(baseTime + 2.25);
    });
    expect(onComplete).not.toHaveBeenCalled();

    // Advance past Phase 4 exit (2.25s + 0.50s = 2.75s)
    act(() => {
      gsap.updateRoot(baseTime + 2.75);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("holds on the finished brand screen when backend is slow (4s) and navigates only after ready becomes true", () => {
    mockMatchMedia(false);
    const onComplete = vi.fn();
    const baseTime = gsap.globalTimeline.time();

    const { rerender } = render(
      <OrganizationTransition
        organizationName="Sunrise Institute"
        ready={false}
        onComplete={onComplete}
      />,
    );

    // Advance to 4.0s while backend is still pending
    act(() => {
      gsap.updateRoot(baseTime + 4.0);
    });
    expect(screen.getByText("Connecting workspace")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    // Backend finishes at 4.0s -> triggers Phase 4 exit (0.48s)
    rerender(
      <OrganizationTransition
        organizationName="Sunrise Institute"
        ready={true}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByText("Workspace ready")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      gsap.updateRoot(baseTime + 4.55);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("respects prefers-reduced-motion by skipping animations and completing as soon as ready is true", () => {
    mockMatchMedia(true);
    const onComplete = vi.fn();

    const { rerender } = render(
      <OrganizationTransition
        organizationName="North Star"
        ready={false}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).not.toHaveBeenCalled();

    rerender(
      <OrganizationTransition
        organizationName="North Star"
        ready={true}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
