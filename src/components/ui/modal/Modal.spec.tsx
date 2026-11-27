import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import viMessages from "@/messages/vi.json";
import { Modal, MODAL_BACKDROP_CLASS } from "./index";

describe("Modal", () => {
  it("renders balanced moderate-blur backdrop, overscroll containment, explicit stacking layers, and an accessible close button", () => {
    const onClose = vi.fn();

    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen onClose={onClose} closeLabel="Close dialog">
          <p>Modal content</p>
        </Modal>
      </NextIntlClientProvider>,
    );

    const backdrop = screen.getByTestId("modal-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop.className).toContain(MODAL_BACKDROP_CLASS);
    expect(backdrop.className).toContain("bg-gray-950/40");
    expect(backdrop.className).toContain("backdrop-blur-[3px]");
    expect(backdrop.className).toContain("dark:bg-gray-950/60");
    expect(backdrop.className).not.toContain("backdrop-blur-[32px]");
    expect(backdrop.className).not.toContain("bg-gray-400/50");
    expect(backdrop.className).toContain("z-0");

    const closeBtn = screen.getByRole("button", { name: "Close dialog" });
    expect(closeBtn).toHaveAttribute("type", "button");

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and backdrop click", () => {
    const onClose = vi.fn();

    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen onClose={onClose}>
          <p>Body</p>
        </Modal>
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: viMessages.common.close })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("exposes dialog ARIA semantics, traps Tab focus, and restores trigger focus on close", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open modal";
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const { rerender } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen onClose={onClose} ariaLabel="Edit item" showCloseButton={false}>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </Modal>
      </NextIntlClientProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen={false} onClose={onClose} ariaLabel="Edit item" showCloseButton={false}>
          <button type="button">First action</button>
        </Modal>
      </NextIntlClientProvider>,
    );

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("closes only the top-most stacked modal on Escape and ref-counts body scroll lock", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();

    const { rerender } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen onClose={onOuterClose} ariaLabel="Outer dialog">
          <p>Outer</p>
        </Modal>
        <Modal isOpen onClose={onInnerClose} ariaLabel="Inner dialog">
          <p>Inner</p>
        </Modal>
      </NextIntlClientProvider>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();

    // Closing only the inner modal must keep body scroll locked while outer remains open
    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen onClose={onOuterClose} ariaLabel="Outer dialog">
          <p>Outer</p>
        </Modal>
        <Modal isOpen={false} onClose={onInnerClose} ariaLabel="Inner dialog">
          <p>Inner</p>
        </Modal>
      </NextIntlClientProvider>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    // Closing the outer modal releases body scroll lock
    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Modal isOpen={false} onClose={onOuterClose} ariaLabel="Outer dialog">
          <p>Outer</p>
        </Modal>
        <Modal isOpen={false} onClose={onInnerClose} ariaLabel="Inner dialog">
          <p>Inner</p>
        </Modal>
      </NextIntlClientProvider>,
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
