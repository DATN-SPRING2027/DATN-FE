import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import Layout from "@/app/[locale]/(platform-console)/platform/layout";
import UsersPage from "@/app/[locale]/(platform-console)/platform/users/page";
import ProjectsPage from "@/app/[locale]/(platform-console)/platform/projects/page";

vi.mock("@/components/platform/ui/platformFont", () => ({
  platformFont: { variable: "platform-font" },
}));
vi.mock("@/components/platform/ui/PlatformCopyProvider", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/platform/PlatformConsole", () => ({
  default: function Console() {
    const [search, setSearch] = useState("");
    return (
      <input
        aria-label="Shell search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    );
  },
}));

it("keeps one Console and its state when navigating from Users to Projects", () => {
  const { rerender } = render(
    <Layout>
      <UsersPage />
    </Layout>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Shell search" }), {
    target: { value: "retained" },
  });
  rerender(
    <Layout>
      <ProjectsPage />
    </Layout>,
  );
  expect(screen.getAllByRole("textbox", { name: "Shell search" })).toHaveLength(
    1,
  );
  expect(screen.getByRole("textbox", { name: "Shell search" })).toHaveValue(
    "retained",
  );
});
