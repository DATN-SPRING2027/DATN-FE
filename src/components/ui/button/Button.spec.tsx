import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Button from "./Button";

describe("Button component", () => {
  it("renders button with children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("applies primary variant classes by default", () => {
    render(<Button>Submit</Button>);
    const button = screen.getByRole("button", { name: /submit/i });
    expect(button.className).toContain("bg-brand-500");
  });

  it("applies outline variant and sm size classes when specified", () => {
    render(
      <Button variant="outline" size="sm">
        Cancel
      </Button>
    );
    const button = screen.getByRole("button", { name: /cancel/i });
    expect(button.className).toContain("ring-1");
    expect(button.className).toContain("px-4 py-3");
  });

  it("triggers onClick callback when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Action</Button>);
    const button = screen.getByRole("button", { name: /action/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>
    );
    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
    expect(button.className).toContain("cursor-not-allowed");
  });

  it("renders start and end icons when provided", () => {
    render(
      <Button
        startIcon={<span data-testid="start-icon">⭐</span>}
        endIcon={<span data-testid="end-icon">➡️</span>}
      >
        Icon Button
      </Button>
    );
    expect(screen.getByTestId("start-icon")).toBeInTheDocument();
    expect(screen.getByTestId("end-icon")).toBeInTheDocument();
  });
});
