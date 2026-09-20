import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // TailAdmin 2.4.0 synchronizes imported widget state from route, browser,
    // and modal effects. Keep this exception scoped to the upstream files;
    // new Continuum components must satisfy the default React hooks rules.
    files: [
      "src/components/calendar/CalendarEventModal.tsx",
      "src/context/SidebarContext.tsx",
      "src/context/ThemeContext.tsx",
      "src/layout/AppSidebar.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
