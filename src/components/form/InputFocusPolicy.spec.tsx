import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import InputFocusPolicy from "./InputFocusPolicy";

it("shows keyboard focus cues for Tab navigation and clears them for pointer input", () => {
  const { unmount } = render(<InputFocusPolicy />);
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.documentElement).toHaveAttribute(
    "data-keyboard-navigation",
    "true",
  );
  fireEvent.pointerDown(document.body);
  expect(document.documentElement).not.toHaveAttribute(
    "data-keyboard-navigation",
  );
  fireEvent.keyDown(document, { key: "a" });
  expect(document.documentElement).not.toHaveAttribute(
    "data-keyboard-navigation",
  );
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.documentElement).toHaveAttribute(
    "data-keyboard-navigation",
    "true",
  );
  unmount();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.documentElement).not.toHaveAttribute(
    "data-keyboard-navigation",
  );
});
