import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HighlightedText, { highlightParts } from "./HighlightedText";

it("highlights Vietnamese tokens in any order while preserving unicode and original text", () => {
  const text = "👋 Trần Kim Thắng và kế hoạch".normalize("NFD");
  const parts = highlightParts(text, "thang TRAN");
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(
    parts
      .filter((part) => part.matched)
      .map((part) => part.text.normalize("NFC")),
  ).toEqual(["Trần", "Thắng"]);
});

it("renders markup and regex syntax as literal text", () => {
  render(<HighlightedText text={'<img onerror="alert(1)"> a.b'} query="a.b" />);
  expect(document.querySelector("img")).toBeNull();
  expect(screen.getByText("a.b").tagName).toBe("MARK");
  expect(highlightParts("anything", "   ")).toEqual([
    { text: "anything", matched: false },
  ]);
});
