import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import TeamPreview from "./TeamPreview";
import type { PreviewScenario } from "./team-preview.model";

function element(scenario: PreviewScenario = "success") {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <TeamPreview scenario={scenario} />
    </NextIntlClientProvider>
  );
}
function fillCreate() {
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Research" },
  });
  fireEvent.change(screen.getByLabelText("Code"), {
    target: { value: "RESEARCH" },
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("shows fixture rows with only View and Delete row actions", () => {
  render(element());
  expect(screen.getByRole("table")).toHaveTextContent("Product Engineering");
  expect(
    screen.queryByText("Product delivery and engineering."),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Fixture preview only\. Development API integration/),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Actions for Product Engineering"));
  expect(
    screen.getByRole("button", { name: "View Product Engineering" }),
  ).toHaveTextContent("View");
  expect(
    screen.getByRole("button", { name: "Delete Product Engineering" }),
  ).toHaveTextContent("Delete");
  expect(
    screen.queryByRole("button", { name: /archive|restore|edit/i }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/archivedReason/)).not.toBeInTheDocument();
});

it("opens detail and updates the in-memory fixture through the edit dialog", () => {
  render(element());
  fireEvent.click(screen.getByLabelText("Actions for Product Engineering"));
  expect(
    screen.queryByRole("button", { name: "Edit team" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete Product Engineering" }),
  ).toHaveTextContent("Delete");
  fireEvent.click(
    screen.getByRole("button", { name: "View Product Engineering" }),
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName(
    "Product Engineering",
  );
  expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Edit team" }));
  expect(screen.getByLabelText("Code")).toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Updated preview" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "Preview saved for Updated preview.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("table")).toHaveTextContent("Updated preview");
});

it("previews create without transport or browser persistence", () => {
  const fetch = vi.fn(() => {
    throw new Error("Unexpected transport");
  });
  vi.stubGlobal("fetch", fetch);
  const storage = vi.spyOn(Storage.prototype, "setItem");
  render(element());
  fillCreate();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "Preview saved for Research.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("table")).toHaveTextContent("Research");
  expect(fetch).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
});

it("focuses and connects required demo-field errors", () => {
  render(element());
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  const name = screen.getByLabelText("Name");
  expect(name).toHaveFocus();
  expect(name).toHaveAttribute("aria-invalid", "true");
  expect(name).toHaveAccessibleDescription(messages.teamPreview.required);
  expect(screen.getByRole("alert")).toBeVisible();
});

it("shows empty state and allows only a fixture create preview", () => {
  render(element("empty"));
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.teamPreview.empty,
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create team" })).toBeEnabled();
});

it("hides all data and commands in the denied state", () => {
  render(element("denied"));
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.teamPreview.denied,
  );
  expect(screen.queryByText("Product Engineering")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create team" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Try preview again" }),
  ).not.toBeInTheDocument();
});

it("shows loading without stale data or commands", () => {
  render(element("loading"));
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.teamPreview.loading,
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create team" }),
  ).not.toBeInTheDocument();
});

it("recovers from the simulated list connection failure using fixtures", () => {
  render(element("network"));
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.teamPreview.network,
  );
  fireEvent.click(screen.getByRole("button", { name: "Try preview again" }));
  expect(screen.getByRole("table")).toBeVisible();
});

it.each(["validation", "save-denied", "save-network"] as const)(
  "preserves the draft on simulated %s",
  (scenario) => {
    render(element(scenario));
    fillCreate();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Research");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    if (scenario === "validation")
      expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(
        messages.teamPreview.validation,
      );
  },
);

it("disables duplicate submissions and fields while the preview is pending", () => {
  render(element("save-pending"));
  fillCreate();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    screen.getByRole("button", { name: messages.teamPreview.pending }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.teamPreview.pendingHint,
  );
});

it("discards an open draft when the scenario changes to denied", () => {
  const { rerender } = render(element());
  fillCreate();
  rerender(element("denied"));
  expect(screen.queryByDisplayValue("Research")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.teamPreview.denied,
  );
});

it("renders entered markup as text rather than HTML", () => {
  render(element());
  fillCreate();
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: '<img src=x onerror="alert(1)">' },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    '<img src=x onerror="alert(1)">',
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("deletes only the selected fixture after confirmation", () => {
  render(element());
  fireEvent.click(screen.getByLabelText("Actions for Product Engineering"));
  fireEvent.click(
    screen.getByRole("button", { name: "Delete Product Engineering" }),
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Delete team");
  expect(
    screen.getByText("Delete Product Engineering from this preview?"),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("table")).not.toHaveTextContent(
    "Product Engineering",
  );
  expect(screen.getByRole("table")).toHaveTextContent("Platform");
});
