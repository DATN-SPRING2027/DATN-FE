import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import messages from "@/messages/en.json";
import DocumentFilePreviewModal from "./DocumentFilePreviewModal";

function renderModal(
  props: Partial<React.ComponentProps<typeof DocumentFilePreviewModal>> & {
    fileName: string;
    fetchBlob: () => Promise<Blob>;
  },
) {
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DocumentFilePreviewModal
          isOpen={true}
          onClose={onClose}
          downloadUrl="/api/backend/capture/projects/p1/documents/d1/file"
          {...props}
        />
      </NextIntlClientProvider>,
    ),
  };
}

it("renders an interactive Excel (.xlsx) spreadsheet preview with sheet tabs and tabular data", async () => {
  const workbook = XLSX.utils.book_new();
  const sheet1 = XLSX.utils.aoa_to_sheet([
    ["Task ID", "Owner", "Status"],
    ["TASK-101", "Leader FE", "Completed"],
  ]);
  const sheet2 = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["Velocity", "42"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet1, "Sprint Backlog");
  XLSX.utils.book_append_sheet(workbook, sheet2, "KPI Summary");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  renderModal({
    fileName: "sprint-report.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: buffer.byteLength,
    fetchBlob: async () =>
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
  });

  expect(await screen.findByText("Sprint Backlog")).toBeVisible();
  expect(screen.getByText("TASK-101")).toBeVisible();
  expect(screen.getByText("Leader FE")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "KPI Summary" }));
  expect(await screen.findByText("Velocity")).toBeVisible();
  expect(screen.getByText("42")).toBeVisible();
});

it("renders an interactive PowerPoint (.pptx) slide deck preview with slide navigation", async () => {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    `<p:sld><a:p><a:r><a:t>Architecture Overview</a:t></a:r></a:p><a:p><a:r><a:t>Zero-trust BFF gateway</a:t></a:r></a:p></p:sld>`,
  );
  zip.file(
    "ppt/slides/slide2.xml",
    `<p:sld><a:p><a:r><a:t>Release Milestones</a:t></a:r></a:p><a:p><a:r><a:t>Q4 Production Rollout</a:t></a:r></a:p></p:sld>`,
  );
  const content = await zip.generateAsync({ type: "arraybuffer" });

  renderModal({
    fileName: "architecture-deck.pptx",
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    fileSize: content.byteLength,
    fetchBlob: async () =>
      new Blob([content], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
  });

  expect(await screen.findByText("Slide 1 of 2")).toBeVisible();
  expect(screen.getByText("Zero-trust BFF gateway")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
  expect(await screen.findByText("Slide 2 of 2")).toBeVisible();
  expect(screen.getByText("Q4 Production Rollout")).toBeVisible();
});

it("renders text/markdown files and closes on Escape without propagating to parent dialogs", async () => {
  const onClose = vi.fn();
  const parentEscape = vi.fn();
  document.addEventListener("keydown", parentEscape);

  try {
    renderModal({
      onClose,
      fileName: "implementation-notes.md",
      contentType: "text/markdown",
      fileSize: 64,
      fetchBlob: async () =>
        new Blob(["# API Contract\nAll endpoints verified."], {
          type: "text/markdown",
        }),
    });

    await waitFor(() =>
      expect(screen.getByText(/# API Contract/)).toBeVisible(),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(parentEscape).not.toHaveBeenCalled();
  } finally {
    document.removeEventListener("keydown", parentEscape);
  }
});
