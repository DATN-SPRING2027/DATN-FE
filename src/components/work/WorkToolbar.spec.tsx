import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkToolbar from "./WorkToolbar";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({
  FilterIcon: () => null,
  GridIcon: () => null,
  SearchIcon: () => null,
}));

describe("WorkToolbar", () => {
  it("shows Clear filters when the search query is the only active criterion", () => {
    const onClearFilters = vi.fn();

    render(
      <WorkToolbar
        query="KNW-142"
        status="ALL"
        priority="ALL"
        assigneeId="ALL"
        groupBy="STATUS"
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        onGroupByChange={vi.fn()}
        onClearFilters={onClearFilters}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "clearFilters" }));

    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
