import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import RagTraceDetailView from "./RagTraceDetailView";
import { answeredTrace, trimmedTrace } from "./ragTrace.testFixtures";
import type { RagTraceDetail } from "./ragTrace.types";

function traceView(detail: RagTraceDetail, locale: "en" | "vi" = "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? vi : en}
      timeZone="UTC"
    >
      <RagTraceDetailView detail={detail} />
    </NextIntlClientProvider>
  );
}

describe("RagTraceDetailView", () => {
  it("shows removed evidence with the recorded reason and distinguishes missing capture", () => {
    render(traceView(trimmedTrace));

    const removed = screen.getByRole("button", {
      name: "E-17, Packaging: Removed",
    });
    fireEvent.click(removed);
    expect(removed).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("complementary", { name: "Packaging" }),
    ).toHaveTextContent("Exceeded the tool evidence budget");

    const missingCitation = screen.getByRole("button", {
      name: "E-17, Citation: Not recorded",
    });
    expect(missingCitation).toBeEnabled();
    fireEvent.click(missingCitation);
    expect(
      screen.getByRole("complementary", { name: "Citation" }),
    ).toHaveTextContent("This checkpoint was not recorded.");
    expect(
      screen.getByText(/final citation checkpoint was not recorded/i),
    ).toBeVisible();
  });

  it("follows a citation and updates the evidence inspector", () => {
    render(traceView(answeredTrace));
    const citation = screen.getByRole("button", {
      name: "E-90, Citation: Citation [2]",
    });

    fireEvent.click(citation);
    expect(citation).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("complementary", { name: "Citation" }),
    ).toHaveTextContent("[2]");
  });

  it("jumps back to the recorded retrieval span and restores keyboard focus", () => {
    render(traceView(trimmedTrace));
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect retrieval step" }),
    );

    const retrieval = within(
      screen.getByRole("list", { name: "Tree" }),
    ).getByRole("button", { name: /^Retrieval · Completed/ });
    expect(retrieval).toHaveFocus();
    expect(retrieval).toHaveAttribute("aria-pressed", "true");
  });

  it("plots nested spans using measured offsets rather than sequence order", () => {
    render(traceView(trimmedTrace));
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    const timeline = within(screen.getByRole("list", { name: "Timeline" }));
    const retrieval = timeline.getByRole("button", {
      name: /^Retrieval · Completed/,
    });
    const ranking = timeline.getByRole("button", {
      name: /^Ranking · Completed/,
    });

    expect(within(retrieval).getByRole("img")).toHaveStyle({
      insetInlineStart: "10%",
      inlineSize: "40%",
    });
    expect(within(ranking).getByRole("img")).toHaveStyle({
      insetInlineStart: "20%",
      inlineSize: "10%",
    });
    expect(
      timeline.getAllByRole("button").map((node) => node.dataset.kind),
    ).toEqual([
      "request",
      "routing",
      "retrieval",
      "ranking",
      "evidence_pack",
      "model_input",
      "generation",
    ]);
  });

  it("switches trace visualizations and shows only recorded fields in JSON", () => {
    render(traceView(trimmedTrace));

    expect(screen.getByRole("list", { name: "Tree" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    expect(
      screen.getByRole("list", {
        name: "Span relationships derived from parent span IDs",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(
      screen.getByRole("list", { name: "Chronological event log" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByText(/No observation payload was captured/i)).toBeVisible();
    expect(screen.getByText(/"spanId": "pack"/)).toBeVisible();
  });

  it("does not infer evidence removal from an incomplete capture", () => {
    const detail: RagTraceDetail = {
      ...trimmedTrace,
      trace: {
        ...trimmedTrace.trace,
        runtimeState: "interrupted",
        answerStatus: null,
        durationMs: null,
      },
      spans: trimmedTrace.spans.map((span) => ({
        ...span,
        startOffsetMs: null,
        durationMs: null,
      })),
      checkpoints: [
        {
          spanId: "retrieve",
          stage: "retrieval_selected",
          coverage: "complete",
          items: [{ unitRef: "E-10", disposition: "present" }],
        },
        {
          spanId: "pack",
          stage: "tool_pack",
          coverage: "truncated",
          items: [],
        },
      ],
    };
    render(traceView(detail));

    expect(screen.getByText("Interrupted")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "E-10, Packaging: Capture incomplete",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "E-10, Model input: Not recorded" }),
    ).toBeDisabled();
    expect(screen.queryByText(/was removed/i)).not.toBeInTheDocument();
  });

  it("resets the selected evidence when the trace changes", () => {
    const rendered = render(traceView(trimmedTrace));
    fireEvent.click(
      screen.getByRole("button", { name: "E-42, Model input: Removed" }),
    );
    expect(screen.getByRole("button", { name: "E-42" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    rendered.rerender(traceView(answeredTrace));
    expect(
      screen.queryByRole("button", { name: "E-42" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "E-90, Citation: Citation [2]" }),
    ).toBeVisible();
  });

  it("renders Vietnamese labels and empty states", () => {
    const detail: RagTraceDetail = {
      ...trimmedTrace,
      spans: [],
      checkpoints: [],
    };
    render(traceView(detail, "vi"));

    expect(screen.getByRole("heading", { name: "Dấu vết RAG" })).toBeVisible();
    expect(
      screen.getByText("Lượt truy vết này chưa ghi đoạn bằng chứng nào."),
    ).toBeVisible();
    expect(
      screen.getByText("Lượt truy vết này chưa ghi bước nào."),
    ).toBeVisible();
  });
});

  it("zooms, pans and fits the timeline around the selected recorded span", () => {
    render(traceView(trimmedTrace));
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("2×")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zoom to selected step" }));
    expect(screen.getByText("4×")).toBeVisible();
    expect(screen.getByRole("button", { name: "Move timeline later" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Fit trace" }));
    expect(screen.getByText("1×")).toBeVisible();
  });
