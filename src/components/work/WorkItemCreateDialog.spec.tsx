import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import WorkItemCreateDialog from "./WorkItemCreateDialog";

vi.mock("@/icons", () => ({
  CloseLineIcon: () => null,
}));

function renderDialog(
  overrides: Partial<Parameters<typeof WorkItemCreateDialog>[0]> = {},
) {
  const onClose = vi.fn();
  const onCreate = vi.fn();
  const people = [
    { id: "6ad88b6eed7cd148fcd0e615", name: "Le Thu Leader FE", initials: "LF" },
    { id: "6ad88b6fed7cd148fcd0e616", name: "Pham Minh Dev", initials: "PD" },
  ];
  const parentCandidates = [
    {
      id: "6ada96179e81dbad08c5e666",
      key: "CONT-FE-1",
      title: "Architecture foundation",
      type: "STORY" as const,
    },
  ];

  const utils = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WorkItemCreateDialog
        isOpen
        isPreview={false}
        projectId="6ad88b72ed7cd148fcd0e621"
        projectCode="CONT-FE"
        projectName="Continuum Frontend Portal"
        people={people}
        currentUserPerson={people[0]}
        parentCandidates={parentCandidates}
        existingLabels={["cont-fe", "workspace"]}
        onClose={onClose}
        onCreate={onCreate}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );

  return { ...utils, onClose, onCreate, people, parentCandidates };
}

describe("WorkItemCreateDialog (Jira Quick-Create experience)", () => {
  it("supports header issue type pill, interactive Assignee/Parent/Labels/DueDate/Priority pills, and slash (/) templates", () => {
    const { onCreate, people, parentCandidates } = renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Create work item" });

    // 1. Switch Type in Header pill from Task -> Bug
    fireEvent.click(within(dialog).getByRole("button", { name: "Type" }));
    fireEvent.click(within(dialog).getByRole("option", { name: /Bug/i }));

    // 2. Fill Summary
    fireEvent.change(within(dialog).getByLabelText("Summary"), {
      target: { value: "Fix Jira-style quick create flow" },
    });

    // 3. Trigger `/` slash template in Description
    const desc = within(dialog).getByLabelText("Description");
    fireEvent.change(desc, {
      target: { value: "/bug", selectionStart: 4 },
    });
    const slashOption = within(dialog).getByRole("option", {
      name: /Bug reproduction steps/i,
    });
    fireEvent.click(slashOption);
    expect((desc as HTMLTextAreaElement).value).toContain("Steps to Reproduce");

    // 4. Interactive Assignee pill -> Assign to me
    const pillsRegion = within(dialog).getByLabelText("Quick field pills");
    fireEvent.click(within(pillsRegion).getByRole("button", { name: /Unassigned/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Assign to me/i }));

    // 5. Interactive Parent pill -> select CONT-FE-1
    fireEvent.click(within(pillsRegion).getByRole("button", { name: /Parent/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /CONT-FE-1/i }));

    // 6. Interactive Labels pill -> add custom label + toggle existing label
    fireEvent.click(within(pillsRegion).getByRole("button", { name: /Labels/i }));
    const labelInput = within(dialog).getByPlaceholderText(
      /Type a label and press Enter/i,
    );
    fireEvent.change(labelInput, { target: { value: "jira-ux" } });
    fireEvent.keyDown(labelInput, { key: "Enter" });
    fireEvent.click(within(dialog).getByRole("button", { name: "workspace" }));

    // 7. Interactive Due date pill -> Tomorrow preset
    fireEvent.click(within(pillsRegion).getByRole("button", { name: /Due date/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Tomorrow" }));

    // 8. Interactive Priority pill -> High
    fireEvent.click(within(pillsRegion).getByRole("button", { name: /Medium/i }));
    fireEvent.click(within(dialog).getByRole("option", { name: /High/i }));

    // 9. Submit form
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Fix Jira-style quick create flow",
        type: "BUG",
        priority: "HIGH",
        assignee: people[0],
        parentId: parentCandidates[0].id,
        labels: ["jira-ux", "workspace"],
        dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        keepDialogOpen: false,
      }),
    );
  });

  it("keeps composer open and passes keepDialogOpen=true when 'Create another' is checked, and supports Dock & Expand modes", () => {
    const { onCreate } = renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Create work item" });

    // Toggle Dock to corner (`◨`) & Expand full fields (`⤢`)
    const dockBtn = within(dialog).getByRole("button", {
      name: "Dock to corner",
    });
    fireEvent.click(dockBtn);
    expect(
      screen.getByRole("button", { name: "Center dialog" }),
    ).toHaveAttribute("aria-pressed", "true");

    const expandBtn = screen.getByRole("button", {
      name: "Expand full fields",
    });
    fireEvent.click(expandBtn);
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();

    // Check Create another
    fireEvent.click(screen.getByLabelText("Create another"));
    fireEvent.change(screen.getByLabelText("Summary"), {
      target: { value: "Batch item 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Batch item 1",
        keepDialogOpen: true,
      }),
    );
    expect(
      screen.getByText(/Created work item — ready for the next one/i),
    ).toBeInTheDocument();
    expect((screen.getByLabelText("Summary") as HTMLInputElement).value).toBe(
      "",
    );
  });
});

