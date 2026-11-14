import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { PlatformOperationsViewModel } from "../usePlatformOperationsViewModel";
import ProjectDetail from "./ProjectDetail";

function mockDialogMethods() {
  const originalShow = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  const originalClose = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "close",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  return () => {
    cleanup();
    if (originalShow)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "showModal",
        originalShow,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (originalClose)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "close",
        originalClose,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  };
}

describe("ProjectDetail", () => {
  let restoreDialog: (() => void) | undefined;

  afterEach(() => {
    restoreDialog?.();
    restoreDialog = undefined;
  });

  it("opens project details in a modal and restores focus to the trigger on close", () => {
    restoreDialog = mockDialogMethods();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const model = {
      selectedId: "project-1",
      setSelectedId: vi.fn(),
      selectedProject: { isPending: true, data: undefined },
    } as unknown as PlatformOperationsViewModel;
    try {
      const { unmount } = render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <ProjectDetail model={model} />
        </NextIntlClientProvider>,
      );
      const dialog = screen.getByRole("dialog", { name: "Project detail" });
      expect(dialog).toHaveAttribute("open");
      fireEvent(dialog, new Event("cancel", { bubbles: true }));
      expect(model.setSelectedId).toHaveBeenCalledWith("");
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(model.setSelectedId).toHaveBeenCalledTimes(2);
      unmount();
      expect(trigger).toHaveFocus();
    } finally {
      trigger.remove();
    }
  });

  it("renders metadata, teams, privacy notice, rename/lock controls, and member governance", async () => {
    restoreDialog = mockDialogMethods();
    const changeProjectMutate = vi.fn().mockResolvedValue({});
    const addMemberMutate = vi.fn().mockResolvedValue({});
    const changeRoleMutate = vi.fn().mockResolvedValue({});
    const removeMemberMutate = vi.fn().mockResolvedValue({});

    const project = {
      id: "651a2b3c4d5e6f7a8b9c0d40",
      organization: {
        id: "651a2b3c4d5e6f7a8b9c0d21",
        name: "North Star",
        slug: "north-star",
      },
      name: "Core Platform",
      code: "CORE",
      visibility: "PRIVATE" as const,
      status: "ACTIVE" as const,
      createdBy: {
        id: "651a2b3c4d5e6f7a8b9c0d10",
        email: "creator@example.test",
        fullName: "Creator Admin",
      },
      memberCount: 2,
      leaders: [
        {
          id: "651a2b3c4d5e6f7a8b9c0d11",
          email: "lead@example.test",
          fullName: "Lead User",
        },
      ],
      leadersTruncated: false,
      teamCount: 1,
      teams: [
        {
          id: "651a2b3c4d5e6f7a8b9c0d50",
          name: "Backend Team",
          code: "BE",
          status: "ACTIVE" as const,
          memberCount: 4,
        },
      ],
      teamsTruncated: false,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    };

    const model = {
      selectedId: project.id,
      setSelectedId: vi.fn(),
      canManageProjects: true,
      selectedProject: {
        isPending: false,
        isFetching: false,
        isError: false,
        isRefetchError: false,
        data: project,
        refetch: vi.fn(),
      },
      changeProject: { mutateAsync: changeProjectMutate, isPending: false },
      projectMembers: {
        isPending: false,
        isFetching: false,
        isError: false,
        data: {
          data: [
            {
              id: "751a2b3c4d5e6f7a8b9c0d61",
              projectId: project.id,
              organizationId: project.organization.id,
              userId: "651a2b3c4d5e6f7a8b9c0d11",
              status: "ACTIVE" as const,
              roleCode: "TEAM_LEADER" as const,
              joinedAt: "2026-10-01T00:00:00.000Z",
              user: {
                id: "651a2b3c4d5e6f7a8b9c0d11",
                email: "lead@example.test",
                fullName: "Lead User",
                accountStatus: "ACTIVE",
              },
            },
            {
              id: "751a2b3c4d5e6f7a8b9c0d62",
              projectId: project.id,
              organizationId: project.organization.id,
              userId: "651a2b3c4d5e6f7a8b9c0d12",
              status: "ACTIVE" as const,
              roleCode: "MEMBER" as const,
              joinedAt: "2026-10-02T00:00:00.000Z",
              user: {
                id: "651a2b3c4d5e6f7a8b9c0d12",
                email: "dev@example.test",
                fullName: "Dev Member",
                accountStatus: "ACTIVE",
              },
            },
          ],
          pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
        },
        refetch: vi.fn(),
      },
      projectMemberCandidates: {
        isPending: false,
        data: {
          items: [
            {
              userId: "651a2b3c4d5e6f7a8b9c0d19",
              email: "candidate@example.test",
              fullName: "New Candidate",
              accountStatus: "ACTIVE",
            },
          ],
          total: 1,
        },
      },
      projectMemberPage: 1,
      setProjectMemberPage: vi.fn(),
      projectMemberSearch: "",
      setProjectMemberSearch: vi.fn(),
      projectMemberStatus: "",
      setProjectMemberStatus: vi.fn(),
      projectMemberRole: "",
      setProjectMemberRole: vi.fn(),
      projectCandidateSearch: "",
      setProjectCandidateSearch: vi.fn(),
      addProjectMember: { mutateAsync: addMemberMutate, isPending: false },
      changeProjectMemberRole: {
        mutateAsync: changeRoleMutate,
        isPending: false,
      },
      removeProjectMember: { mutateAsync: removeMemberMutate, isPending: false },
      formMessage: "",
      setFormMessage: vi.fn(),
      lastErrorCode: "",
      setLastErrorCode: vi.fn(),
      handleSubmit: vi.fn(
        async (
          e: React.FormEvent<HTMLFormElement>,
          action: () => Promise<unknown>,
        ) => {
          e.preventDefault();
          await action();
          return true;
        },
      ),
      runOperation: vi.fn(async (action: () => Promise<unknown>) => {
        await action();
        return true;
      }),
    } as unknown as PlatformOperationsViewModel;

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProjectDetail model={model} />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByText("Creator Admin (creator@example.test)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Backend Team")).toBeInTheDocument();
    expect(screen.getByText("Content Privacy Boundary")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Renamed Platform" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(changeProjectMutate).toHaveBeenCalledWith({
        projectId: project.id,
        name: "Renamed Platform",
        expectedUpdatedAt: project.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );

    fireEvent.click(screen.getByRole("tab", { name: /Project Members/i }));
    expect(screen.getByText("Lead User")).toBeInTheDocument();
    expect(screen.getByText("Dev Member")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Role for Lead User" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    await waitFor(() =>
      expect(addMemberMutate).toHaveBeenCalledWith({
        projectId: project.id,
        userId: "651a2b3c4d5e6f7a8b9c0d19",
        roleCode: "MEMBER",
        reasonCode: "ACCESS_REVIEW",
      }),
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Role for Dev Member" }),
      { target: { value: "TEAM_LEADER" } },
    );
    await waitFor(() =>
      expect(changeRoleMutate).toHaveBeenCalledWith({
        projectId: project.id,
        membershipId: "751a2b3c4d5e6f7a8b9c0d62",
        roleCode: "TEAM_LEADER",
        reasonCode: "ACCESS_REVIEW",
      }),
    );

    const leadRow = screen.getByRole("row", { name: /Lead User/i });
    expect(within(leadRow).getByRole("button", { name: "Remove" })).toBeDisabled();

    const devRow = screen.getByRole("row", { name: /Dev Member/i });
    fireEvent.click(within(devRow).getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    await waitFor(() =>
      expect(removeMemberMutate).toHaveBeenCalledWith({
        projectId: project.id,
        membershipId: "751a2b3c4d5e6f7a8b9c0d62",
        reasonCode: "ACCESS_REVIEW",
      }),
    );
  });
});
