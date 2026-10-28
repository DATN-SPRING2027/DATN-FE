import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi, afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import CopyIdentifier from "./CopyIdentifier";
afterEach(() => vi.restoreAllMocks());
it.each([true, false])(
  "copies the full identifier and announces clipboard success=%s",
  async (success) => {
    const value = "81397abd-3cc9-4ee7-bc36-45c603436562";
    const writeText = vi.fn();
    if (success) writeText.mockResolvedValue(undefined);
    else writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <CopyIdentifier value={value} label="Session ID" />
        </NextIntlClientProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Copy Session ID" }));
      expect(writeText).toHaveBeenCalledWith(value);
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          success ? "Copied" : "Copy failed",
        ),
      );
      expect(screen.getByTitle(value)).toHaveTextContent(value);
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  },
);
