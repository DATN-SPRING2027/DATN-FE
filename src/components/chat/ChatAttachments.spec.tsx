import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatApi, type ChatAttachment } from "@/lib/queries/chat/useChat";
import messages from "@/messages/en.json";
import ChatAttachments from "./ChatAttachments";

vi.mock("@/lib/queries/chat/useChat", () => ({
  chatApi: {
    attachmentDownloadUrl: vi.fn(),
  },
}));

describe("ChatAttachments — Image Lightbox and Document Attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const imageAttachment: ChatAttachment = {
    id: "att-img-1",
    name: "screenshot.png",
    contentType: "image/png",
    size: 204800,
    kind: "IMAGE",
  };

  const docAttachment: ChatAttachment = {
    id: "att-doc-1",
    name: "report.pdf",
    contentType: "application/pdf",
    size: 1572864,
    kind: "DOCUMENT",
  };

  it("renders loading state then image button, and opens/closes lightbox on click", async () => {
    vi.mocked(chatApi.attachmentDownloadUrl).mockResolvedValueOnce({
      url: "blob:mock-image-url",
      expiresInSeconds: 300,
    });

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatAttachments
          conversationId="conv-1"
          attachments={[imageAttachment]}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Loading attachment…")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "View image screenshot.png" }),
      ).toBeInTheDocument();
    });

    const trigger = screen.getByRole("button", {
      name: "View image screenshot.png",
    });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "screenshot.png" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("(200 KB)")).toBeInTheDocument();

    const downloadLink = screen.getByRole("link", { name: "Download image" });
    expect(downloadLink).toHaveAttribute("href", "blob:mock-image-url");
    expect(downloadLink).toHaveAttribute("download", "screenshot.png");

    const zoomButton = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoomButton);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close preview" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the lightbox when Escape is pressed", async () => {
    vi.mocked(chatApi.attachmentDownloadUrl).mockResolvedValueOnce({
      url: "blob:mock-image-url",
      expiresInSeconds: 300,
    });

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatAttachments
          conversationId="conv-1"
          attachments={[imageAttachment]}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "View image screenshot.png" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "View image screenshot.png" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders non-image document attachment with download attribute", async () => {
    vi.mocked(chatApi.attachmentDownloadUrl).mockResolvedValueOnce({
      url: "blob:mock-doc-url",
      expiresInSeconds: 300,
    });

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatAttachments conversationId="conv-1" attachments={[docAttachment]} />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });

    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "blob:mock-doc-url");
    expect(link).toHaveAttribute("download", "report.pdf");
  });

  it("handles download URL failure gracefully", async () => {
    vi.mocked(chatApi.attachmentDownloadUrl).mockRejectedValueOnce(
      new Error("Forbidden"),
    );

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ChatAttachments
          conversationId="conv-1"
          attachments={[imageAttachment]}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Attachment unavailable")).toBeInTheDocument();
    });
  });
});
