import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ProjectVisibilityNotification from "./ProjectVisibilityNotification";

it("shows a corner success toast and dismisses it after four seconds", async () => {
  vi.useFakeTimers();
  try {
    render(<ProjectVisibilityNotification message="Project is now public." />);
    expect(screen.getByRole("status")).toHaveClass("fixed", "end-4", "top-5");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
