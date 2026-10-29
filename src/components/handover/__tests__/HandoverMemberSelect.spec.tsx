import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HandoverDialogShell from "../HandoverDialogShell";
import HandoverMemberSelect from "../HandoverMemberSelect";

describe("member picker portal focus (R2-FE03)", () => {
  it.each([false, true])(
    "keeps Tab inside dialog and advances relative to its trigger; reverse=%s",
    async (reverse) => {
      render(
        <HandoverDialogShell isOpen onClose={() => {}} title="Choose members">
          <button type="button">Previous field</button>
          <label htmlFor="member">Member</label>
          <HandoverMemberSelect
            id="member"
            value=""
            onChange={() => {}}
            placeholder="Choose"
            options={Array.from({ length: 4 }, (_, n) => ({
              userId: String(n),
              fullName: `Member ${n}`,
            }))}
          />
          <button type="button">Next field</button>
        </HandoverDialogShell>,
      );
      fireEvent.click(screen.getByRole("combobox", { name: "Member" }));
      const search = screen.getByRole("textbox");
      await waitFor(() => expect(search).toHaveFocus());
      const nativeEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: reverse,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(search, nativeEvent);
      expect(nativeEvent.defaultPrevented).toBe(true);
      expect(
        screen.getByRole("button", {
          name: reverse ? "Previous field" : "Next field",
        }),
      ).toHaveFocus();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.getByRole("dialog")).toContainElement(
        document.activeElement as HTMLElement,
      );
    },
  );
});
