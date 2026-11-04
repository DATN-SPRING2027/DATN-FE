import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ChatComposer from "./ChatComposer";

vi.mock("@/icons", () => ({
  PaperPlaneIcon: () => null,
  PlusIcon: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends only explicitly selected mention IDs and removes them when the text is removed", async () => {
  const onSend = vi.fn().mockResolvedValue(false);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer
        isSending={false}
        onSend={onSend}
        onTyping={vi.fn()}
        members={[{ userId: "member-id", displayName: "Member" }]}
      />
    </NextIntlClientProvider>,
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Hi @me" } });
  fireEvent.click(screen.getByRole("button", { name: "Member" }));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(onSend).toHaveBeenCalledWith(
      "Hi @Member",
      expect.any(String),
      [],
      ["member-id"],
    ),
  );
  fireEvent.change(input, { target: { value: "Plain message" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(onSend).toHaveBeenLastCalledWith(
      "Plain message",
      expect.any(String),
      [],
      [],
    ),
  );
});

it("previews a selected image and revokes its object URL when removed", () => {
  const createObjectURL = vi.fn(() => "blob:chat-preview");
  const revokeObjectURL = vi.fn();
  class TestURL extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  const onSend = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("URL", TestURL);

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer isSending={false} onSend={onSend} onTyping={vi.fn()} />
    </NextIntlClientProvider>,
  );
  const file = new File(["image"], "photo.png", { type: "image/png" });
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Chat attachment input was not rendered.");
  fireEvent.change(input, { target: { files: [file] } });

  expect(document.querySelector("img")).toHaveAttribute(
    "src",
    "blob:chat-preview",
  );
  expect(createObjectURL).toHaveBeenCalledWith(file);
  fireEvent.click(screen.getByRole("button", { name: "Remove photo.png" }));
  expect(document.querySelector("img")).not.toBeInTheDocument();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:chat-preview");
});

it("attaches an image pasted from clipboard into the textarea and sends it", async () => {
  const createObjectURL = vi.fn(() => "blob:pasted-preview");
  const revokeObjectURL = vi.fn();
  class TestURL extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  const onSend = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("URL", TestURL);

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer isSending={false} onSend={onSend} onTyping={vi.fn()} />
    </NextIntlClientProvider>,
  );
  const textarea = screen.getByRole("textbox");
  const pastedFile = new File(["pasted image bytes"], "screenshot.png", {
    type: "image/png",
  });

  fireEvent.paste(textarea, {
    clipboardData: {
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => pastedFile,
        },
      ],
      files: [pastedFile],
    },
  });

  expect(document.querySelector("img")).toHaveAttribute(
    "src",
    "blob:pasted-preview",
  );
  expect(createObjectURL).toHaveBeenCalledWith(pastedFile);

  fireEvent.change(textarea, { target: { value: "Look at this screenshot" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));

  await waitFor(() =>
    expect(onSend).toHaveBeenCalledWith(
      "Look at this screenshot",
      expect.any(String),
      [pastedFile],
      [],
    ),
  );
});


it("attaches a non-image document without converting it to image/png or generating broken img preview", async () => {
  const createObjectURL = vi.fn(() => "blob:doc-preview");
  class TestURL extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = vi.fn();
  }
  const onSend = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("URL", TestURL);

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer isSending={false} onSend={onSend} onTyping={vi.fn()} />
    </NextIntlClientProvider>,
  );

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  // Non-image file with empty type (common on Windows)
  const docFile = new File(["test data content"], "notes.txt", { type: "" });
  fireEvent.change(input, { target: { files: [docFile] } });

  // Must NOT render img tag or call createObjectURL
  expect(document.querySelector("img")).not.toBeInTheDocument();
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(screen.getByText("notes.txt")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Send message" }));

  await waitFor(() =>
    expect(onSend).toHaveBeenCalledWith(
      "",
      expect.any(String),
      [
        expect.objectContaining({
          name: "notes.txt",
          type: "application/octet-stream",
        }),
      ],
      [],
    ),
  );
});
