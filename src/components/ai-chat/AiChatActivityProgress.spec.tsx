import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import AiChatActivityProgress, {
  type AiChatActivityProgressProps,
} from "./AiChatActivityProgress";

const defaults: AiChatActivityProgressProps = {
  isStreaming: true,
  hasContent: false,
  status: "ok",
  steps: [],
  startedAt: Date.parse("2026-10-30T05:00:00Z"),
};

function ui(props = defaults, locale = "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : en}
    >
      <AiChatActivityProgress {...props} />
    </NextIntlClientProvider>
  );
}

describe("AI Chat activity progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(defaults.startedAt!);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens during a run and reveals a public status progressively without claiming a retrieval", () => {
    render(ui());
    expect(screen.getByRole("button", { name: /Thinking/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preparing a response to your question.",
    );
    const animated = screen.getByTestId("activity-animated-text");
    expect(animated.textContent!.length).toBeLessThan(
      "Preparing a response to your question.".length,
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(animated).toHaveTextContent(
      "Preparing a response to your question.",
    );
    expect(screen.getByRole("button", { name: /Thinking/ })).toHaveTextContent(
      "2s",
    );
    expect(
      screen.queryByText("Searching project documents"),
    ).not.toBeInTheDocument();
  });

  it("updates from real steps and switches to writing when answer content arrives", () => {
    const { rerender } = render(ui());
    const steps = [
      {
        kind: "tool" as const,
        label: "Search project documents",
        durationMs: 180,
        count: 3,
      },
    ];
    rerender(ui({ ...defaults, steps }));
    expect(screen.getByText("Search project documents")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Received the tool results. Preparing the answer.",
    );
    rerender(ui({ ...defaults, steps, hasContent: true }));
    expect(screen.getByRole("status")).toHaveTextContent("Writing the answer.");
  });

  it("supports collapse and keeps completed timing stable across rerenders", () => {
    const { rerender } = render(ui());
    fireEvent.click(screen.getByRole("button", { name: /Thinking/ }));
    expect(screen.getByRole("button", { name: /Thinking/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    rerender(
      ui({
        ...defaults,
        isStreaming: false,
        hasContent: true,
        finishedAt: defaults.startedAt! + 3100,
      }),
    );
    expect(screen.getByRole("button", { name: /Processed/ })).toHaveTextContent(
      "3s",
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("button", { name: /Processed/ })).toHaveTextContent(
      "3s",
    );
  });

  it.each(["failed", "cancelled"] as const)(
    "stops animation for %s and preserves the activity history",
    (status) => {
      const { rerender } = render(
        ui({
          ...defaults,
          isStreaming: false,
          status,
          defaultExpanded: true,
          steps: [{ kind: "tool", label: "Search documents", durationMs: 50 }],
        }),
      );
      expect(screen.getByText("Search documents")).toBeVisible();
      expect(
        screen.queryByTestId("activity-animated-text"),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveTextContent(
        status === "failed" ? "Failed" : "Stopped",
      );
      rerender(
        ui({
          ...defaults,
          isStreaming: false,
          status,
          defaultExpanded: true,
          steps: [],
        }),
      );
      expect(
        screen.queryByText("The response is ready."),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          status === "failed"
            ? "The response could not be completed. You can try again."
            : "Response generation was stopped.",
        ),
      ).toBeVisible();
    },
  );

  it("localizes the status and does not reveal a thinking payload", () => {
    render(
      ui(
        {
          ...defaults,
          steps: [
            { kind: "thinking", label: "PRIVATE_REASONING", durationMs: 1 },
          ],
        },
        "vi",
      ),
    );
    expect(screen.getByRole("button")).toHaveTextContent("Đang suy nghĩ");
    expect(screen.queryByText("PRIVATE_REASONING")).not.toBeInTheDocument();
  });

  it("respects reduced motion without starting the typewriter interval", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(ui());
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preparing a response to your question.",
    );
    expect(screen.getByTestId("activity-animated-text")).toHaveClass(
      "motion-reduce:hidden",
    );
  });

  it("limits busy state to the active response and cleans up timers on unmount", () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AiChatActivityProgress {...defaults} />
        <AiChatActivityProgress
          {...defaults}
          isStreaming={false}
          finishedAt={defaults.startedAt! + 1000}
        />
      </NextIntlClientProvider>,
    );
    const regions = screen.getAllByRole("region", { name: "AI activity" });
    expect(regions[0]).toHaveAttribute("aria-busy", "true");
    expect(regions[1]).toHaveAttribute("aria-busy", "false");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("wraps long activity labels and keeps historical answers free from invented timing", () => {
    render(
      ui({
        ...defaults,
        isStreaming: false,
        startedAt: undefined,
        defaultExpanded: true,
        steps: [{ kind: "tool", label: "x".repeat(500), durationMs: 42 }],
      }),
    );
    expect(screen.getByText("x".repeat(500))).toHaveClass("break-words");
    expect(screen.getByRole("button")).toHaveTextContent("Activity");
    expect(screen.getByRole("button")).not.toHaveTextContent(/\d+s/);
  });
});
