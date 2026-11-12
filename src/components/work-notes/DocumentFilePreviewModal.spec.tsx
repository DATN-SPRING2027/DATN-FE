import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import JSZip from "jszip";
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

it.each([
  [
    "sprint-report.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ["legacy-report.xls", "application/vnd.ms-excel"],
  ["ledger.ods", "application/vnd.oasis.opendocument.spreadsheet"],
])(
  "does not fetch or parse untrusted workbook preview: %s",
  async (fileName, contentType) => {
    const fetchBlob = vi.fn(async () => new Blob(["not parsed"]));

    renderModal({ fileName, contentType, fetchBlob });

    expect(
      await screen.findByText(
        "For security, Excel and OpenDocument spreadsheet previews are disabled. Use Download to open the original file in your trusted spreadsheet application.",
      ),
    ).toBeVisible();
    expect(fetchBlob).not.toHaveBeenCalled();
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(2);
  },
);

it.each(["text/csv", "application/vnd.ms-excel"])(
  "keeps CSV preview available with content type %s and parses quoted delimiters safely",
  async (contentType) => {
    renderModal({
      fileName: "sprint-report.csv",
      contentType,
      fetchBlob: async () =>
        new Blob(['Task,Owner\r\nTASK-101,"Leader, FE"\r\n']),
    });

    expect(await screen.findByText("TASK-101")).toBeVisible();
    expect(screen.getByText("Leader, FE")).toBeVisible();
  },
);

it("skips fetching a CSV when its supplied size exceeds the preview limit", async () => {
  const fetchBlob = vi.fn(async () => new Blob(["not parsed"]));

  renderModal({
    fileName: "large-report.csv",
    fileSize: 5 * 1024 * 1024 + 1,
    fetchBlob,
  });

  expect(
    await screen.findByText(/CSV and TSV previews are limited to 5 MB/),
  ).toBeVisible();
  expect(fetchBlob).not.toHaveBeenCalled();
});

it("checks the fetched CSV size before decoding when no file size is supplied", async () => {
  const fetchBlob = vi.fn(
    async () => new Blob(["x".repeat(5 * 1024 * 1024 + 1)]),
  );

  renderModal({ fileName: "large-report.csv", fetchBlob });

  expect(
    await screen.findByText(/CSV and TSV previews are limited to 5 MB/),
  ).toBeVisible();
  expect(fetchBlob).toHaveBeenCalledTimes(1);
});

it.each([
  ["column", `col,${"x,".repeat(499)}x`],
  ["row", "x\n".repeat(10_001)],
  [
    "cell",
    Array.from({ length: 401 }, () => Array(500).fill("x").join(",")).join(
      "\n",
    ),
  ],
])("rejects CSV preview above the %s limit", async (_limit, text) => {
  renderModal({
    fileName: "large-table.csv",
    fetchBlob: async () => new Blob([text]),
  });

  expect(
    await screen.findByText(/CSV and TSV previews are limited to 5 MB/),
  ).toBeVisible();
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
