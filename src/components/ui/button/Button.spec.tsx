import { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import Button from "./Button";
import CopyButton from "./CopyButton";

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("Button component (Animate UI motion & ripple)", () => {
  it("renders button with children text and data-slot attribute", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-slot", "button");
  });

  it("applies primary variant classes by default", () => {
    render(<Button>Submit</Button>);
    const button = screen.getByRole("button", { name: /submit/i });
    expect(button.className).toContain("bg-brand-500");
  });

  it("applies outline, danger, and ghost variants with size classes", () => {
    const { rerender } = render(
      <Button variant="outline" size="sm">
        Cancel
      </Button>,
    );
    const button = screen.getByRole("button", { name: /cancel/i });
    expect(button.className).toContain("ring-1");
    expect(button.className).toContain("px-4 py-3");

    rerender(
      <Button variant="danger" size="md">
        Delete
      </Button>,
    );
    expect(screen.getByRole("button", { name: /delete/i }).className).toContain(
      "bg-error-600",
    );

    rerender(<Button variant="ghost">Dismiss</Button>);
    expect(screen.getByRole("button", { name: /dismiss/i }).className).toContain(
      "bg-transparent",
    );
  });

  it("triggers onClick reliably including after pointerDown ripple creation", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Action</Button>);
    const button = screen.getByRole("button", { name: /action/i });

    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(button, { button: 0, clientX: 40, clientY: 20 });
    const rippleLayer = button.querySelector('[data-slot="button-ripples"]');
    expect(rippleLayer).not.toBeNull();
    expect(rippleLayer).toHaveAttribute("aria-hidden", "true");
    expect(rippleLayer?.className).toContain("pointer-events-none");

    fireEvent.pointerUp(button, { button: 0, clientX: 40, clientY: 20 });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not render ripples when enableRipple is false", () => {
    render(<Button enableRipple={false}>No Ripple</Button>);
    const button = screen.getByRole("button", { name: /no ripple/i });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(button, { button: 0, clientX: 20, clientY: 20 });
    expect(button.querySelector('[data-slot="button-ripples"]')).toBeNull();
  });

  it("submits parent form reliably when type='submit' and prevents submit when type='button'", () => {
    const handleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit}>
        <Button type="button">Secondary</Button>
        <Button type="submit">Save</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: /secondary/i }));
    expect(handleSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onClick when disabled or isLoading", () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
    expect(button.className).toContain("cursor-not-allowed");

    rerender(
      <Button
        onClick={handleClick}
        isLoading
        startIcon={<span data-testid="lead-icon" />}
      >
        Saving
      </Button>,
    );
    const loadingBtn = screen.getByRole("button", { name: /saving/i });
    expect(loadingBtn).toBeDisabled();
    expect(loadingBtn).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("lead-icon")).not.toBeInTheDocument();
    fireEvent.click(loadingBtn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders start and end icons and forwards HTMLButtonElement ref + ARIA props", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button
        ref={ref}
        ariaExpanded={true}
        ariaControls="panel-1"
        ariaPressed={false}
        startIcon={<span data-testid="start-icon" />}
        endIcon={<span data-testid="end-icon" />}
      >
        Icon Button
      </Button>,
    );
    expect(screen.getByTestId("start-icon")).toBeInTheDocument();
    expect(screen.getByTestId("end-icon")).toBeInTheDocument();
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
    expect(ref.current).toHaveAttribute("aria-expanded", "true");
    expect(ref.current).toHaveAttribute("aria-controls", "panel-1");
    expect(ref.current).toHaveAttribute("aria-pressed", "false");
  });
});

describe("CopyButton component (Animate UI icon morph)", () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    writeTextMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies content to clipboard, updates state/label, and reverts after timeout", async () => {
    const onCopy = vi.fn();
    renderWithIntl(
      <CopyButton
        content="https://continuum.ai/invite/abc"
        copiedDuration={1200}
        onCopy={onCopy}
      >
        Copy link
      </CopyButton>,
    );

    const button = screen.getByRole("button", { name: "Copy to clipboard" });
    expect(button).toHaveAttribute("data-copied", "false");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith("https://continuum.ai/invite/abc");
    expect(onCopy).toHaveBeenCalledWith("https://continuum.ai/invite/abc");
    expect(button).toHaveAttribute("data-copied", "true");
    expect(button).toHaveAttribute("aria-label", "Copied");

    act(() => {
      vi.advanceTimersByTime(1250);
    });

    expect(button).toHaveAttribute("data-copied", "false");
    expect(button).toHaveAttribute("aria-label", "Copy to clipboard");
  });

  it("does not copy when disabled", async () => {
    renderWithIntl(<CopyButton content="secret" disabled />);
    const button = screen.getByRole("button", { name: "Copy to clipboard" });
    expect(button).toBeDisabled();

    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeTextMock).not.toHaveBeenCalled();
  });
});
