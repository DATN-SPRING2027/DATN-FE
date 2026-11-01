import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import CompanionProjectPicker from "./CompanionProjectPicker";
const state = vi.hoisted(() => ({
  error: false,
  loading: false,
  refetch: vi.fn(),
  projects: [{ id: "project-1", name: "Project One" }],
}));
vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: { organizationId: "org-1" },
    refetch: state.refetch,
  }),
}));
vi.mock("@/lib/queries/projects/useActiveOrganizationProjects", () => ({
  useActiveOrganizationProjects: () => ({
    projects: state.projects,
    isError: state.error,
    isPending: state.loading,
    refetch: state.refetch,
  }),
}));
beforeEach(() => {
  state.error = false;
  state.loading = false;
  state.projects = [{ id: "project-1", name: "Project One" }];
  vi.clearAllMocks();
});
it("requires explicit project selection and uses authorized project options", () => {
  const select = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CompanionProjectPicker value="" onChange={select} disabled={false} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("combobox")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Project for this conversation"), {
    target: { value: "project-1" },
  });
  expect(select).toHaveBeenCalledWith("project-1");
});
it("provides retry when project loading fails", () => {
  state.error = true;
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CompanionProjectPicker value="" onChange={vi.fn()} disabled={false} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("alert")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(state.refetch).toHaveBeenCalled();
});
