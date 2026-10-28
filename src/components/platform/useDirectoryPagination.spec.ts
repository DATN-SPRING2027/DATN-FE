import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import useDirectoryPagination from "./useDirectoryPagination";

it("shows ten records, resets on scope changes, and clamps when an inventory shrinks", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);
  const { result, rerender } = renderHook(
    ({ rows, scope }) => useDirectoryPagination(rows, scope),
    { initialProps: { rows: items, scope: "all" } },
  );
  expect(result.current.rows).toEqual(items.slice(0, 10));
  act(() => result.current.onPageChange(3));
  expect(result.current.rows).toEqual([21, 22, 23]);
  rerender({ rows: items.slice(0, 12), scope: "all" });
  expect(result.current.page).toBe(2);
  expect(result.current.rows).toEqual([11, 12]);
  rerender({ rows: items, scope: "filtered" });
  expect(result.current.page).toBe(1);
  rerender({ rows: [], scope: "empty" });
  expect(result.current.page).toBe(1);
  expect(result.current.rows).toEqual([]);
  expect(result.current.totalItems).toBe(0);
});
