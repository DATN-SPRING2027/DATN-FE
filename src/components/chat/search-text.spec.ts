import { expect, it } from "vitest";
import { matchesNamePrefixes } from "./search-text";

it("matches local mention names by accent-insensitive word prefixes in any order", () => {
  expect(matchesNamePrefixes("Trần Kim Thắng", "thang tr")).toBe(true);
  expect(matchesNamePrefixes("Đặng Văn Danh", "danh dang")).toBe(true);
  expect(matchesNamePrefixes("Trần Kim Thắng", "ang")).toBe(false);
});
