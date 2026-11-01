import { expect, it } from "vitest";
import { sourceSelection, reconcileTextareaEdit } from "./textarea-source";
it("maps normalized textarea offsets to the exact CRLF source occurrence, including emoji", () => {
  const raw = "🙂 same\r\nsame\r\nend";
  expect(sourceSelection(raw, 8, 12)).toEqual({
    start: 9,
    end: 13,
    quote: "same",
  });
  expect(sourceSelection(raw, 3, 12)).toEqual({
    start: 3,
    end: 13,
    quote: "same\r\nsame",
  });
});
it("retains untouched CRLF/log whitespace when a user edits another part of a textarea", () => {
  const raw = "Before\r\n```log\r\n  exact\tvalue\r\n```\r\nAfter";
  expect(
    reconcileTextareaEdit(raw, "Changed\n```log\n  exact\tvalue\n```\nAfter"),
  ).toBe("Changed\r\n```log\r\n  exact\tvalue\r\n```\r\nAfter");
  expect(reconcileTextareaEdit(raw, raw.replace(/\r\n/g, "\n"))).toBe(raw);
});
it("preserves mixed untouched line endings and rejects invalid DOM selections", () => {
  expect(reconcileTextareaEdit("one\r\ntwo\nthree", "one\ntwo\nthird")).toBe(
    "one\r\ntwo\nthird",
  );
  expect(sourceSelection("x", 0, 3)).toBeNull();
  expect(sourceSelection("x", 0, 0)).toBeNull();
});
