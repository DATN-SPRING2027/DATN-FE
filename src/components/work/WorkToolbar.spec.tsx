import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkToolbar from "./WorkToolbar";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/icons", () => ({
  FilterIcon: () => null,
  GridIcon: () => null,
  SearchIcon: () => null,
}));

describe("WorkToolbar", () => {
  it("hides Clear filters and keeps the status selector available", () => {
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
        onClearFilters={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "clearFilters" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "statusScope" })).toBeVisible();
    expect(screen.getByRole("option", { name: "TODO" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "IN_PROGRESS" }),
    ).toBeInTheDocument();
  });
});
