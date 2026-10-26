import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AiChatWorkspace from "./AiChatWorkspace";

const { listTaskNotesMock, listDocsMock, listReportsMock } = vi.hoisted(() => ({
  listTaskNotesMock: vi.fn(),
  listDocsMock: vi.fn(),
  listReportsMock: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/queries/auth/useAuth", () => ({
  useCurrentUserQuery: () => ({
    data: {
      id: "user-1",
      name: "KeyT Manager",
      email: "manager@continuum.ai",
      organizationId: "org-1",
      roles: ["ADMIN"],
    },
  }),
}));

vi.mock("@/lib/queries/projects/useProjects", () => ({
  useProjectsQuery: () => ({
    data: {
      data: [
        {
          id: "proj-doc-1",
          organizationId: "org-1",
          name: "Documentation",
          code: "DOCS",
          visibility: "PUBLIC",
          status: "ACTIVE",
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/lib/queries/work-notes/useWorkNotes", () => ({
  workNotesApi: {
    listProjectTaskNotes: (...args: unknown[]) => listTaskNotesMock(...args),
    listDocuments: (...args: unknown[]) => listDocsMock(...args),
    listReports: (...args: unknown[]) => listReportsMock(...args),
  },
}));

describe("AiChatWorkspace (ChatGPT-style SAG interface)", () => {
  beforeEach(() => {
    listTaskNotesMock.mockReset().mockResolvedValue({
      data: [
        {
          id: "tn-1",
          taskKey: "SAG-101",
          title: "Hybrid Search & ACL Filtering",
          accomplishments: "Implemented vector + BM25 retrieval",
          approach: "Reciprocal rank fusion with tenant guard",
          reason: "Prevent cross-project data leakage",
          authorName: "KeyT Manager",
          updatedAtLabel: "Today",
        },
      ],
      pagination: { totalItems: 1 },
    });
    listDocsMock.mockReset().mockResolvedValue({
      data: [
        {
          id: "doc-1",
          title: "Continuum SAG Architecture Spec",
          version: "2.4",
          type: "ARCHITECTURE",
          summary: "End-to-end RAG citation pipeline specification",
          authorName: "System Architect",
          updatedAtLabel: "Yesterday",
        },
      ],
      pagination: { totalItems: 1 },
    });
    listReportsMock.mockReset().mockResolvedValue({
      data: [],
      pagination: { totalItems: 0 },
    });
  });

  it("renders the ChatGPT-style hero screen ('Ready when you are.'), Chat | Work mode switch, High depth selector, and conversation sidebar", () => {
    render(<AiChatWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Ready when you are." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Work" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Retrieval depth" }),
    ).toHaveTextContent("High");

    const historySidebar = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    expect(
      within(historySidebar).getByRole("button", { name: "New chat" }),
    ).toBeInTheDocument();
    expect(within(historySidebar).getByText("Pinned")).toBeInTheDocument();
  });

  it("submits a SAG query, retrieves Task Notes & Project Documents, and renders verified citations with source links", async () => {
    render(<AiChatWorkspace />);

    const input = screen.getByRole("textbox", { name: "Ask Continuum SAG" });
    fireEvent.change(input, {
      target: {
        value: "Tổng hợp tiến độ SAG và quyết định kỹ thuật gần nhất",
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send SAG query" }));
    });

    expect(listTaskNotesMock).toHaveBeenCalledWith("proj-doc-1", 1);
    expect(listDocsMock).toHaveBeenCalledWith("proj-doc-1", "ALL", 1);

    expect(
      await screen.findByText(/SAG-101 · Hybrid Search & ACL Filtering/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Continuum SAG Architecture Spec \(v2\.4\)/),
    ).toBeInTheDocument();
  });

  it("switches between pinned SAG threads, collapses/re-opens the history sidebar, and resets to New chat", () => {
    render(<AiChatWorkspace />);

    const historySidebar = screen.getByRole("complementary", {
      name: "AI Chat conversation history",
    });
    fireEvent.click(
      within(historySidebar).getAllByRole("button", {
        name: /Branch - Thiết kế kiến trúc RAG \/ SAG/,
      })[0]!,
    );

    expect(
      screen.queryByRole("heading", { name: "Ready when you are." }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/SAG Architecture & RBAC Retrieval Specification v2\.4/),
    ).toBeInTheDocument();

    // Collapse history sidebar and reopen
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse chat history sidebar" }),
    );
    expect(
      screen.queryByRole("complementary", {
        name: "AI Chat conversation history",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open chat history sidebar" }),
    );
    expect(
      screen.getByRole("complementary", {
        name: "AI Chat conversation history",
      }),
    ).toBeInTheDocument();

    // Reset back to New chat hero screen
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(
      screen.getByRole("heading", { name: "Ready when you are." }),
    ).toBeInTheDocument();
  });
});
