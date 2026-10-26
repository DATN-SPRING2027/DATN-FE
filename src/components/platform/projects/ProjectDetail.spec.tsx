import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";
import ProjectDetail from "./ProjectDetail";

it("opens project details in a modal and restores focus to the trigger on close", () => {
  const originalShow = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  const originalClose = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "close",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const model = {
    selectedId: "project-1",
    setSelectedId: vi.fn(),
    selectedProject: { isPending: true, data: undefined },
  } as unknown as PlatformOperationsViewModel;
  try {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectDetail model={model} />
      </NextIntlClientProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Project detail" });
    expect(dialog).toHaveAttribute("open");
    fireEvent(dialog, new Event("cancel", { bubbles: true }));
    expect(model.setSelectedId).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(model.setSelectedId).toHaveBeenCalledTimes(2);
    unmount();
    expect(trigger).toHaveFocus();
  } finally {
    cleanup();
    trigger.remove();
    if (originalShow)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "showModal",
        originalShow,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (originalClose)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "close",
        originalClose,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  }
});
