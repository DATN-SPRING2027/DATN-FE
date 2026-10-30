import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HandoverDialogShell from "../HandoverDialogShell";
import HandoverMemberSelect from "../HandoverMemberSelect";

describe("member picker portal focus & organization scopes", () => {
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

  it("renders Project vs Organization candidate groups and badges cleanly", () => {
    const onChange = vi.fn();
    render(
      <div>
        <label htmlFor="successor">Successor recipient (B)</label>
        <HandoverMemberSelect
          id="successor"
          value=""
          onChange={onChange}
          placeholder="Assign later"
          allowEmpty
          emptyOptionLabel="Assign later (optional)"
          inProjectBadgeLabel="In project"
          orgCandidateBadgeLabel="Org member · Auto-add"
          projectGroupLabel="Project members"
          orgCandidateGroupLabel="Organization colleagues · Auto-added to project"
          options={[
            {
              userId: "proj-1",
              fullName: "Binh Project",
              email: "binh@org.local",
              status: "ACTIVE",
              membershipScope: "PROJECT",
            },
            {
              userId: "org-2",
              fullName: "Chau Colleague",
              email: "chau@org.local",
              status: "ACTIVE",
              membershipScope: "ORG_CANDIDATE",
            },
          ]}
        />
      </div>,
    );

    fireEvent.click(
      screen.getByRole("combobox", { name: /successor recipient \(b\)/i }),
    );
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Project members")).toBeVisible();
    expect(
      within(listbox).getByText(
        "Organization colleagues · Auto-added to project",
      ),
    ).toBeVisible();

    const projOpt = within(listbox).getByRole("option", {
      name: /binh project/i,
    });
    expect(projOpt).toHaveTextContent("In project");

    const orgOpt = within(listbox).getByRole("option", {
      name: /chau colleague/i,
    });
    expect(orgOpt).toHaveTextContent("Org member · Auto-add");

    fireEvent.click(orgOpt);
    expect(onChange).toHaveBeenCalledWith("org-2");
  });
});
