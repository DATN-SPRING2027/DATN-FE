import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import HandoverDialogShell from "../HandoverDialogShell";
import HandoverDatePicker, { utcDateOffsetIso } from "../HandoverDatePicker";

function renderPicker(props: Partial<React.ComponentProps<typeof HandoverDatePicker>> = {}) {
  const onChange = props.onChange ?? vi.fn();
  const onDialogClose = vi.fn();
  const utils = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HandoverDialogShell
        isOpen
        onClose={onDialogClose}
        title="Schedule Handover"
      >
        <button type="button">Before field</button>
        <label htmlFor="target-date">Target completion date</label>
        <HandoverDatePicker
          id="target-date"
          value="2026-11-15"
          onChange={onChange}
          relativeBadgeText="(UTC) · in 16d"
          {...props}
        />
        <button type="button">After field</button>
      </HandoverDialogShell>
    </NextIntlClientProvider>,
  );
  return { ...utils, onChange, onDialogClose };
}

describe("HandoverDatePicker", () => {
  it("renders formatted UTC date, navigates months, and selects a calendar day", () => {
    const onChange = vi.fn();
    renderPicker({ onChange, value: "2026-11-15" });

    const trigger = screen.getByRole("button", {
      name: /target completion date/i,
    });
    expect(trigger).toHaveTextContent(/Nov 15, 2026/i);
    expect(trigger).toHaveTextContent(/\(UTC\) · in 16d/i);

    fireEvent.click(trigger);

    const calendarDialog = screen.getByRole("dialog", {
      name: /choose target completion date/i,
    });
    expect(within(calendarDialog).getByText(/November 2026/i)).toBeVisible();

    fireEvent.click(
      within(calendarDialog).getByRole("button", { name: /next month/i }),
    );
    expect(within(calendarDialog).getByText(/December 2026/i)).toBeVisible();

    const dec20 = within(calendarDialog).getByRole("button", {
      name: /December 20, 2026/i,
    });
    fireEvent.click(dec20);

    expect(onChange).toHaveBeenCalledWith("2026-12-20");
    expect(
      screen.queryByRole("dialog", { name: /choose target completion date/i }),
    ).not.toBeInTheDocument();
  });

  it("supports Today and quick offset presets inside the calendar popover", () => {
    const onChange = vi.fn();
    renderPicker({ onChange, value: "2026-11-15" });

    fireEvent.click(
      screen.getByRole("button", { name: /target completion date/i }),
    );
    const calendarDialog = screen.getByRole("dialog", {
      name: /choose target completion date/i,
    });

    fireEvent.click(
      within(calendarDialog).getByRole("button", { name: "Today" }),
    );
    expect(onChange).toHaveBeenCalledWith(utcDateOffsetIso(0));
  });

  it("closes only the calendar popover on Escape without closing the parent modal", async () => {
    const { onDialogClose } = renderPicker({ value: "2026-11-15" });

    fireEvent.click(
      screen.getByRole("button", { name: /target completion date/i }),
    );
    const calendarDialog = screen.getByRole("dialog", {
      name: /choose target completion date/i,
    });
    expect(calendarDialog).toBeInTheDocument();

    fireEvent.keyDown(calendarDialog, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", {
          name: /choose target completion date/i,
        }),
      ).not.toBeInTheDocument();
    });
    expect(onDialogClose).not.toHaveBeenCalled();
  });
});
