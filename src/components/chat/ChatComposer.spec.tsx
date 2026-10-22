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
