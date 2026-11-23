import { fireEvent, render, screen, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { it, expect } from "vitest";
import { useDialogFocus } from "./useDialogFocus";

function NestedDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, true);
  return createPortal(
    <div ref={dialog} role="dialog" aria-label="Details" tabIndex={-1}>
      <button onClick={onClose}>Close details</button>
    </div>,
    document.body,
  );
}

function Fixture() {
  const dialog = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  useDialogFocus(dialog, isOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Inspect</button>
      {isOpen && (
        <div ref={dialog} role="dialog" aria-label="Inspector" tabIndex={-1}>
          <button onClick={() => setNested(true)}>Show details</button>
          <button disabled>Unavailable</button>
          <button onClick={() => setOpen(false)}>Close inspector</button>
          {nested && <NestedDialog onClose={() => setNested(false)} />}
        </div>
      )}
    </>
  );
}

it("contains Tab in the active dialog and restores both opening controls", () => {
  render(<Fixture />);
  const inspect = screen.getByRole("button", { name: "Inspect" });
  inspect.focus();
  fireEvent.click(inspect);

  const inspector = screen.getByRole("dialog", { name: "Inspector" });
  const showDetails = within(inspector).getByRole("button", { name: "Show details" });
  const closeInspector = within(inspector).getByRole("button", { name: "Close inspector" });
  expect(inspector).toHaveFocus();
  fireEvent.keyDown(inspector, { key: "Tab", shiftKey: true });
  expect(closeInspector).toHaveFocus();
  fireEvent.keyDown(closeInspector, { key: "Tab" });
  expect(showDetails).toHaveFocus();

  fireEvent.click(showDetails);
  const details = screen.getByRole("dialog", { name: "Details" });
  expect(details).toHaveFocus();
  fireEvent.keyDown(details, { key: "Tab" });
  const closeDetails = within(details).getByRole("button", { name: "Close details" });
  expect(closeDetails).toHaveFocus();
  fireEvent.click(closeDetails);
  expect(showDetails).toHaveFocus();

  fireEvent.click(closeInspector);
  expect(inspect).toHaveFocus();
});
