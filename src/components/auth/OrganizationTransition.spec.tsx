import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
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

function renderTransition(props: React.ComponentProps<typeof OrganizationTransition>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationTransition {...props} />
    </NextIntlClientProvider>,
  );
}

describe("OrganizationTransition — Fast CSS Workspace Handoff", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the Continuum AI logo, wordmark, and organization name while waiting for backend readiness", () => {
    mockMatchMedia(false);
    const onComplete = vi.fn();

    renderTransition({
      organizationName: "Continuum AI Labs",
      ready: false,
      onComplete,
    });

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

  it("completes in <= 300ms (160ms) once backend is ready without blocking on GSAP", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const onComplete = vi.fn();

    const { rerender } = renderTransition({
      organizationName: "North Star",
      ready: false,
      onComplete,
    });

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrganizationTransition
          organizationName="North Star"
          ready={true}
          onComplete={onComplete}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Workspace ready")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("waits cleanly when backend is slow and completes promptly once ready becomes true", () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    const onComplete = vi.fn();

    const { rerender } = renderTransition({
      organizationName: "Sunrise Institute",
      ready: false,
      onComplete,
    });

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByText("Connecting workspace")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrganizationTransition
          organizationName="Sunrise Institute"
          ready={true}
          onComplete={onComplete}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Workspace ready")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("respects prefers-reduced-motion by completing immediately when ready is true", () => {
    mockMatchMedia(true);
    const onComplete = vi.fn();

    const { rerender } = renderTransition({
      organizationName: "North Star",
      ready: false,
      onComplete,
    });
    expect(onComplete).not.toHaveBeenCalled();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrganizationTransition
          organizationName="North Star"
          ready={true}
          onComplete={onComplete}
        />
      </NextIntlClientProvider>,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
