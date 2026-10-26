import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import HeaderSettingsDropdown from "./HeaderSettingsDropdown";

const state = vi.hoisted(() => ({
  pathname: "/projects/project-a/overview",
  roles: ["MEMBER"],
  canUpdateProject: false,
  canAccessSettings: false,
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => state.pathname,
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: { id: "user-a", organizationId: "org-a", roles: state.roles },
    error: null,
  }),
}));
vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectsQuery: () => ({ data: { data: [] } }),
}));
vi.mock("@/lib/queries/projects/useProjectSettings", () => ({
  useProjectManagementAccess: () => state,
}));

function open() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HeaderSettingsDropdown />
    </NextIntlClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.header.settings }),
  );
}

beforeEach(() => {
  state.pathname = "/projects/project-a/overview";
  state.roles = ["MEMBER"];
  state.canUpdateProject = false;
  state.canAccessSettings = false;
});

it("does not infer Leader tools from an unscoped role string", () => {
  state.roles = ["MEMBER", "TEAM_LEADER"];
  open();
  expect(
    screen.queryByText(messages.header.settingsMenu.leaderHeading),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", {
      name: new RegExp(messages.header.settingsMenu.teamManagementTitle),
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", {
      name: new RegExp(messages.header.settingsMenu.systemTitle),
    }),
  ).not.toBeInTheDocument();
});

it("links authorized Leader tools to the current Project", () => {
  state.canUpdateProject = true;
  state.canAccessSettings = true;
  open();
  expect(
    screen.getByRole("link", {
      name: new RegExp(messages.header.settingsMenu.spacesTitle),
    }),
  ).toHaveAttribute("href", "/projects/project-a/settings");
  expect(
    screen.getByRole("link", {
      name: new RegExp(messages.header.settingsMenu.teamManagementTitle),
    }),
  ).toHaveAttribute("href", "/projects/project-a/members");
});

it("keeps Manager organization tools separate from Project leadership", () => {
  state.roles = ["ADMIN"];
  open();
  expect(
    screen.getByRole("link", {
      name: new RegExp(messages.header.settingsMenu.systemTitle),
    }),
  ).toHaveAttribute("href", "/organization/settings");
  expect(
    screen.queryByText(messages.header.settingsMenu.leaderHeading),
  ).not.toBeInTheDocument();
});
