import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ChatComposer from "./ChatComposer";

vi.mock("@/icons", () => ({
  CloseLineIcon: () => null,
  PaperPlaneIcon: () => null,
  PlusIcon: () => null,
  ShootingStarIcon: () => null,
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

it("supports @continuumAI keyboard selection, Vietnamese IME composition guard, validation, and retry idempotency in enabled DIRECT chats", async () => {
  const onSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer
        dmAssistantEnabled
        isSending={false}
        onSend={onSend}
        onTyping={vi.fn()}
        members={[{ userId: "member-id", displayName: "Lan Tran" }]}
      />
    </NextIntlClientProvider>,
  );

  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "@" } });

  const listbox = screen.getByRole("listbox", { name: "Mention suggestions" });
  expect(listbox).toBeInTheDocument();
  const options = screen.getAllByRole("option");
  expect(options[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByTestId("mention-option-continuum-ai")).toBeInTheDocument();

  // Vietnamese IME composition must NOT select the mention or submit on Enter!
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("@");
  expect(onSend).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);

  // Keyboard navigation down -> up -> Enter selects @continuumAI
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(input).toHaveValue("@continuumAI ");
  expect(screen.getByTestId("chat-composer-ai-active-pill")).toBeInTheDocument();

  // Submitting empty query after @continuumAI shows validation error and blocks send
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(
    await screen.findByText("Enter a question after @continuumAI before sending."),
  ).toBeInTheDocument();
  expect(onSend).not.toHaveBeenCalled();

  // Enter a Vietnamese diacritics question and test retry clientMessageId stability
  fireEvent.change(input, {
    target: { value: "@continuumAI Hôm qua hai người chốt gì?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  const firstClientMessageId = onSend.mock.calls[0]?.[1];
  expect(onSend).toHaveBeenLastCalledWith(
    "@continuumAI Hôm qua hai người chốt gì?",
    firstClientMessageId,
    [],
    [],
    {
      handle: "continuumAI",
      query: "Hôm qua hai người chốt gì?",
      timezone: expect.any(String),
    },
  );

  // Retry after first failed send preserves exact clientMessageId
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
  expect(onSend.mock.calls[1]?.[1]).toBe(firstClientMessageId);
  await waitFor(() => expect(input).toHaveValue(""));
});

it("never exposes @continuumAI when capability is disabled and does not trigger assistant on manually typed handle", async () => {
  const onSend = vi.fn().mockResolvedValue(true);
  const { rerender } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer
        dmAssistantEnabled={false}
        isSending={false}
        onSend={onSend}
        onTyping={vi.fn()}
        members={[{ userId: "member-id", displayName: "Lan Tran" }]}
      />
    </NextIntlClientProvider>,
  );

  expect(
    screen.queryByTestId("chat-composer-ai-trigger"),
  ).not.toBeInTheDocument();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "@" } });
  expect(
    screen.queryByTestId("mention-option-continuum-ai"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lan Tran" })).toBeInTheDocument();

  // Even when enabled, manually typing @continuumAI without selecting does not attach structured assistantMention
  rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer
        dmAssistantEnabled
        isSending={false}
        onSend={onSend}
        onTyping={vi.fn()}
        members={[{ userId: "member-id", displayName: "Lan Tran" }]}
      />
    </NextIntlClientProvider>,
  );

  fireEvent.change(input, {
    target: { value: "@continuumAI manual text without selecting" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() =>
    expect(onSend).toHaveBeenCalledWith(
      "@continuumAI manual text without selecting",
      expect.any(String),
      [],
      [],
    ),
  );
});

it("filters the current user out of mention suggestions while keeping @continuumAI and peer members", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatComposer
        dmAssistantEnabled
        currentUserId="self-id"
        isSending={false}
        onSend={vi.fn().mockResolvedValue(true)}
        onTyping={vi.fn()}
        members={[
          { userId: "self-id", displayName: "Pham Anh Self" },
          { userId: "peer-id", displayName: "Vo Khoa Peer" },
        ]}
      />
    </NextIntlClientProvider>,
  );

  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "@" } });

  expect(screen.getByTestId("mention-option-continuum-ai")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Vo Khoa Peer" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Pham Anh Self" }),
  ).not.toBeInTheDocument();
});
