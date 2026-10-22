import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import type { Project } from "@/lib/queries/projects/useProjects";
import {
  ProjectCoverThumbnail,
  ProjectDirectoryRow,
  ProjectMemberAvatarGroup,
} from "./ProjectVisualIdentity";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderWithIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const baseProject: Project = {
  id: "proj-1",
  organizationId: "org-1",
  name: "Website Redesign",
  code: "WR",
  visibility: "PRIVATE",
  status: "ACTIVE",
  createdBy: "user-1",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
  activeMemberCount: 6,
  memberPreviews: [
    {
      userId: "u1",
      fullName: "Kevin Chen",
      email: "kc@example.com",
      roleCode: "TEAM_LEADER",
    },
    {
      userId: "u2",
      fullName: "Minh Tran",
      email: "mt@example.com",
      roleCode: "MEMBER",
    },
    {
      userId: "u3",
      fullName: "Huy Nguyen",
      email: "hn@example.com",
      avatarUrl: "/images/user/user-01.jpg",
      roleCode: "MEMBER",
    },
    {
      userId: "u4",
      fullName: "Linh Le",
      email: "ll@example.com",
      roleCode: "MEMBER",
    },
  ],
};

describe("ProjectVisualIdentity design rules", () => {
  it("renders user-selected cover image with unified object-cover crop when coverImageUrl is provided", () => {
    const { container } = renderWithIntl(
      <ProjectCoverThumbnail
        project={{
          ...baseProject,
          coverImageUrl: "/images/projects/custom-cover.jpg",
        }}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/images/projects/custom-cover.jpg");
    expect(img?.className).toContain("object-cover");
  });

  it("falls back to TailAdmin wave surface and project initials when no coverImageUrl is present", () => {
    const { container } = renderWithIntl(
      <ProjectCoverThumbnail project={baseProject} index={0} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).toContain("WR");
  });

  it("does NOT guess or render a category label from the project name when project.category is absent", () => {
    renderWithIntl(
      <ProjectDirectoryRow
        project={{
          ...baseProject,
          name: "Website Redesign Marketing Campaign",
          category: undefined,
        }}
        statusLabel="Active"
        visibilityLabel="Private"
        memberCountLabel="6 members"
        actionAriaLabel="Open Website Redesign"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Website Redesign Marketing Campaign" }),
    ).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("Private")).toBeVisible();
    expect(screen.getByText("6 members")).toBeVisible();
    expect(screen.queryByText("Marketing")).toBeNull();
  });

  it("renders the category label when project.category actually exists in data", () => {
    renderWithIntl(
      <ProjectDirectoryRow
        project={{
          ...baseProject,
          category: "Data & Analytics",
          visibility: "PUBLIC",
        }}
        statusLabel="Active"
        visibilityLabel="Public"
        memberCountLabel="6 members"
        actionAriaLabel="Open Website Redesign"
      />,
    );

    expect(screen.getByText("Data & Analytics")).toBeVisible();
    expect(screen.getByText("Public")).toBeVisible();
  });

  it("renders the first few member avatars, groups the rest into +N, and shows member info on hover", () => {
    renderWithIntl(
      <ProjectMemberAvatarGroup
        members={baseProject.memberPreviews}
        totalCount={6}
        maxVisible={3}
      />,
    );

    expect(screen.getByText("KC")).toBeVisible();
    expect(screen.getByText("MT")).toBeVisible();
    expect(screen.getByAltText("Huy Nguyen")).toBeVisible();
    expect(screen.getByText("+3")).toBeVisible();

    // Hover over Kevin Chen's avatar button
    const kevinButton = screen.getByRole("button", { name: "Kevin Chen" });
    fireEvent.mouseEnter(kevinButton);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Kevin Chen");
    expect(tooltip).toHaveTextContent("kc@example.com");
    expect(tooltip).toHaveTextContent("Leader");

    fireEvent.mouseLeave(kevinButton);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
