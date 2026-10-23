import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkItemCreateDialog from "./WorkItemCreateDialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/icons", () => ({ CloseLineIcon: () => null }));

describe("WorkItemCreateDialog", () => {
  it("keeps entered values after a failed save and closes after success", async () => {
    const onClose = vi.fn();
    const onCreate = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    render(
      <WorkItemCreateDialog
        isOpen
        people={[]}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    const summary = screen.getByPlaceholderText("summaryPlaceholder");
    fireEvent.change(summary, { target: { value: "Connect Work task API" } });
    fireEvent.click(screen.getByRole("button", { name: "addTask" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create the work item");
    expect(summary).toHaveValue("Connect Work task API");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "addTask" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog ready for another item after a successful create", async () => {
    const onClose = vi.fn();
    const onCreate = vi.fn().mockResolvedValue(true);
    render(
      <WorkItemCreateDialog
        isOpen
        people={[]}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    const summary = screen.getByPlaceholderText("summaryPlaceholder");
    fireEvent.change(summary, { target: { value: "First work item" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Create another/i }));
    fireEvent.click(screen.getByRole("button", { name: "addTask" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "First work item" })));
    expect(onClose).not.toHaveBeenCalled();
    expect(summary).toHaveValue("");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
