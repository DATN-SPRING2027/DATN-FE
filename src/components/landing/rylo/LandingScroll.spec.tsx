import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingScroll from "./LandingScroll";

let frames: Map<number, FrameRequestCallback>;
let reducedMotion = false;

beforeEach(() => {
  frames = new Map();
  reducedMotion = false;
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion }));
  vi.stubGlobal("innerHeight", 800);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
    4000,
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function setup() {
  render(
    <LandingScroll>
      <a href="#giai-phap">Solutions</a>
      <section
        id="giai-phap"
        aria-label="Solution details"
        style={{ scrollMarginTop: "32px" }}
      >
        Project knowledge
      </section>
    </LandingScroll>,
  );
  const target = screen.getByRole("region", { name: "Solution details" });
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    top: 1200,
  } as DOMRect);
  return target;
}

function advance(time: number) {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  });
}

describe("Landing section navigation", () => {
  it("moves through intermediate positions before focusing the destination", () => {
    const target = setup();
    fireEvent.click(screen.getByRole("link", { name: "Solutions" }));
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#giai-phap");
    advance(0);
    advance(500);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 584);
    expect(target).not.toHaveFocus();
    advance(1000);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 1168);
    expect(target).toHaveFocus();
    expect(frames.size).toBe(0);
  });

  it("moves directly to the destination when reduced motion is requested", () => {
    reducedMotion = true;
    const target = setup();
    fireEvent.click(screen.getByRole("link", { name: "Solutions" }));
    expect(window.scrollTo).toHaveBeenCalledOnce();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1168);
    expect(target).toHaveFocus();
    expect(frames.size).toBe(0);
  });

  it("stops the animation when the user scrolls manually", () => {
    setup();
    fireEvent.click(screen.getByRole("link", { name: "Solutions" }));
    advance(0);
    fireEvent.wheel(window);
    expect(frames.size).toBe(0);
    vi.mocked(window.scrollTo).mockClear();
    advance(1000);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
