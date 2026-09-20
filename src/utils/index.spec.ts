import { describe, it, expect } from "vitest";
import { cn } from "./index";

describe("cn utility", () => {
  it("merges static class names", () => {
    expect(cn("px-2", "py-1", "bg-white")).toBe("px-2 py-1 bg-white");
  });

  it("handles conditional classes correctly", () => {
    const isVisible = false;
    const isPrimary = true;
    expect(
      cn("base-class", isVisible && "hidden", isPrimary && "text-brand-500")
    ).toBe("base-class text-brand-500");
  });

  it("handles undefined, null, and empty values gracefully", () => {
    expect(cn("text-sm", null, undefined, false, "")).toBe("text-sm");
  });

  it("resolves Tailwind CSS conflicts via twMerge", () => {
    expect(cn("px-2 px-4", "text-red-500 text-blue-500")).toBe(
      "px-4 text-blue-500"
    );
  });

  it("supports object and array formats", () => {
    expect(cn(["btn", { "btn-active": true, "btn-disabled": false }])).toBe(
      "btn btn-active"
    );
  });
});
