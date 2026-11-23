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
});
