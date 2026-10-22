import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ChatDialog from "./ChatDialog";

it("focuses the input, traps Tab, closes on Escape, and restores the trigger", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const close = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChatDialog title="Room settings" onClose={close} side>
        <input aria-label="Room name" />
        <button>Save</button>
      </ChatDialog>
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Room settings");
  expect(screen.getByRole("textbox", { name: "Room name" })).toHaveFocus();
  screen.getByRole("button", { name: "Save" }).focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
