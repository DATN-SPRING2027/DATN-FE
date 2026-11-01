import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import AiChatMindMapCanvas from "./AiChatMindMapCanvas";
import { computeMindMapLayout, createAllExpandedIds } from "./mind-map-layout";

function renderCanvas(width = 375, height = 300) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width, height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
    },
  );
  const tree = {
    id: "root",
    label: "Project architecture",
    summary: null,
    citationNumbers: [],
    children: Array.from({ length: 8 }, (_, i) => ({
      id: `branch_${i}`,
      label: `Security and deployment theme ${i}`,
      summary: null,
      citationNumbers: [1],
      children: Array.from({ length: 6 }, (_, j) => ({
        id: `leaf_${i}_${j}`,
        label: `Detailed knowledge subtopic ${i}.${j}`,
        summary: null,
        citationNumbers: [1],
        children: [],
      })),
    })),
  };
  const layout = computeMindMapLayout(tree, createAllExpandedIds(tree));
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AiChatMindMapCanvas
        layout={layout}
        selectedNodeId="root"
        isFullscreen={false}
        onSelectNode={vi.fn()}
        onToggleNode={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseDefault={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  const svg = screen.getByRole("img", {
    name: messages.AiChat.mindMapCanvasAriaLabel,
  });
  const viewport = svg.parentElement!;
  return { ...view, layout, svg, viewport };
}

afterEach(() => vi.unstubAllGlobals());

describe("AiChatMindMapCanvas viewport controls", () => {
  it.each([375, 408])(
    "fits all 57 supported nodes into a %ipx viewport",
    (width) => {
      const { layout, svg } = renderCanvas(width);
      fireEvent.click(
        screen.getByRole("button", { name: messages.AiChat.mindMapZoomIn }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: messages.AiChat.mindMapFitView }),
      );
      const transform = svg
        .querySelector("g[transform]")!
        .getAttribute("transform")!;
      const scale = Number(transform.match(/scale\(([^)]+)\)/)![1]);
      expect(layout.width * scale).toBeLessThanOrEqual(width - 20);
      expect(layout.height * scale).toBeLessThanOrEqual(300 - 54);
    },
  );

  it("cancels the browser's Ctrl+wheel zoom and removes the listener on unmount", () => {
    const { viewport, unmount } = renderCanvas();
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -80,
    });
    act(() => {
      viewport.dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(true);
    unmount();
    const afterUnmount = new WheelEvent("wheel", {
      cancelable: true,
      ctrlKey: true,
      deltaY: -80,
    });
    viewport.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it("enables smooth camera transform transition on dock button clicks and disables it during drag or wheel pan", () => {
    const { svg, viewport } = renderCanvas();
    const cameraGroup = svg.querySelector("g[transform]")!;
    expect(cameraGroup.getAttribute("class") ?? "").not.toContain(
      "continuum-mind-map-camera",
    );

    fireEvent.click(
      screen.getByRole("button", { name: messages.AiChat.mindMapZoomIn }),
    );
    expect(cameraGroup.getAttribute("class")).toContain(
      "continuum-mind-map-camera",
    );

    act(() => {
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaX: 10,
          deltaY: 10,
        }),
      );
    });
    expect(cameraGroup.getAttribute("class") ?? "").not.toContain(
      "continuum-mind-map-camera",
    );

    fireEvent.click(
      screen.getByRole("button", { name: messages.AiChat.mindMapFitView }),
    );
    expect(cameraGroup.getAttribute("class")).toContain(
      "continuum-mind-map-camera",
    );
  });
});
