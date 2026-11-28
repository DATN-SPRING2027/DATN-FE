import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import RagTraceExplorer from "./RagTraceExplorer";

function explorer() {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <RagTraceExplorer />
    </NextIntlClientProvider>
  );
}

function resultRows() {
  const body = screen
    .getByRole("table", { name: "Table view" })
    .querySelector("tbody");
  if (!body) throw new Error("Observation table body was not rendered");
  return within(body).getAllByRole("button");
}

describe("RagTraceExplorer", () => {
  it("shows root observations and opens the selected trace's evidence path", () => {
    render(explorer());

    const rows = resultRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "RAG trace" })).toBeVisible();

    fireEvent.click(rows[1]);
    expect(rows[1]).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "E-90, Citation: Citation [2]" }),
    ).toBeVisible();
  });

  it("filters all observation rows with the supported query fields", () => {
    render(explorer());
    fireEvent.click(screen.getByRole("button", { name: "All observations" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search observations" }), {
      target: { value: "name:retrieval" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const rows = resultRows();
    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect(row).toHaveTextContent("Retrieval"));

    fireEvent.change(screen.getByRole("textbox", { name: "Search observations" }), {
      target: { value: "latency:>300" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(resultRows().length).toBeGreaterThan(2);
  });

  it("switches between the table and a measured-duration chart", () => {
    render(explorer());
    fireEvent.click(screen.getByRole("button", { name: "Latency chart" }));

    expect(
      screen.getByRole("img", { name: "Latency chart for 2 sample observations" }),
    ).toBeVisible();
    expect(screen.getByText(/too small for percentile statistics/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByRole("table", { name: "Table view" })).toBeVisible();
  });

  it("saves local views and restores their query scope and time range", () => {
    window.localStorage.clear();
    render(explorer());
    fireEvent.click(screen.getByRole("button", { name: "No answer" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Time range" }), {
      target: { value: "5m" },
    });
    expect(resultRows()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(screen.getByRole("textbox", { name: "View name" }), {
      target: { value: "Latest no answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    fireEvent.click(screen.getByRole("button", { name: /^All runs/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Time range" }), {
      target: { value: "fixture" },
    });
    expect(resultRows()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Latest no answer" }));
    expect(resultRows()).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Time range" })).toHaveValue("5m");
  });

  it("sorts observations and allows the trace ID column to be hidden", () => {
    render(explorer());
    const table = () => screen.getByRole("table", { name: "Table view" });
    expect(resultRows()[0]).toHaveTextContent("req_rag_knowledge_8217");
    fireEvent.click(screen.getByRole("button", { name: /Started at/ }));
    expect(resultRows()[0].closest("tr")).toHaveTextContent("trace_rag_q8217_01");

    fireEvent.click(screen.getByRole("checkbox", { name: "Trace" }));
    expect(within(table()).queryByRole("columnheader", { name: "Trace" })).not.toBeInTheDocument();
  });

  it("makes empty query results visible and clears the active filters", () => {
    render(explorer());
    fireEvent.change(screen.getByRole("textbox", { name: "Search observations" }), {
      target: { value: "status:failed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText("No RAG trace found")).toBeVisible();
    expect(screen.queryByRole("table", { name: "Table view" })).not.toBeInTheDocument();
    expect(screen.getByText(/evaluated locally/i)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(resultRows()).toHaveLength(2);
  });

  it("compares the latest runs without treating an unrecorded checkpoint as zero", () => {
    render(explorer());

    fireEvent.click(screen.getByRole("button", { name: "Compare latest two" }));

    const comparison = screen.getByRole("region", {
      name: "What changed between runs?",
    });
    expect(
      within(comparison).getByRole("heading", {
        name: "What changed between runs?",
      }),
    ).toBeVisible();
    expect(within(comparison).getByText("Latency change")).toBeVisible();
    expect(
      within(comparison).getAllByText("Not recorded").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/missing checkpoints stay unknown/i)).toBeVisible();
  });
});
