import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import Layout from "@/app/[locale]/(platform-console)/platform/layout";
import UsersPage from "@/app/[locale]/(platform-console)/platform/users/page";
import ProjectsPage from "@/app/[locale]/(platform-console)/platform/projects/page";

const setRequestLocaleMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getMessages: vi.fn().mockResolvedValue({}),
  getTranslations: vi.fn(),
  setRequestLocale: setRequestLocaleMock,
}));
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

it("keeps one Console and its state when navigating from Users to Projects and sets request locale", async () => {
  setRequestLocaleMock.mockClear();
  const localeParams = Promise.resolve({ locale: "en" });
  const usersNode = await UsersPage({ params: localeParams });
  const initialLayout = await Layout({
    params: localeParams,
    children: usersNode,
  });
  const { rerender } = render(initialLayout);
  fireEvent.change(screen.getByRole("textbox", { name: "Shell search" }), {
    target: { value: "retained" },
  });
  const projectsNode = await ProjectsPage({ params: localeParams });
  const nextLayout = await Layout({
    params: localeParams,
    children: projectsNode,
  });
  rerender(nextLayout);
  expect(screen.getAllByRole("textbox", { name: "Shell search" })).toHaveLength(
    1,
  );
  expect(screen.getByRole("textbox", { name: "Shell search" })).toHaveValue(
    "retained",
  );
  expect(setRequestLocaleMock).toHaveBeenCalledWith("en");
});
