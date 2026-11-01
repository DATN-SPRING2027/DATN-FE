import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import {configure} from '@testing-library/react';
// Allow asynchronous query rendering under the same constrained local fixture load.
configure({asyncUtilTimeout:3000});

// In Vite/Vitest, .svg imports default to URL strings instead of SVGR components.
// Mocking @/icons and @/icons/index ensures all icon components render safely as dummy components in tests.
vi.mock("@/icons", async (importOriginal) => {
  const icons = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(
    Object.keys(icons).map((name) => [name, () => null]),
  );
});
vi.mock("@/icons/index", async (importOriginal) => {
  const icons = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(
    Object.keys(icons).map((name) => [name, () => null]),
  );
});
