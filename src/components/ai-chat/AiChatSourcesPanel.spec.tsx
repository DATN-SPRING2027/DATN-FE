import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import messages from "@/messages/en.json";
import AiChatSourcesPanel from "./AiChatSourcesPanel";

const { sourceQueryMock } = vi.hoisted(() => ({
  sourceQueryMock: vi.fn(),
}));

vi.mock("@/lib/queries/ai-chat/useAiChat", () => ({
  useAiChatProjectSourcesQuery: (...args: unknown[]) =>
    sourceQueryMock(...args),
}));

function renderPanel(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatSourcesPanel
          organizationId="org-1"
          projectId="project-1"
          projectName="Continuum Core"
          onClose={onClose}
        />
      </NextIntlClientProvider>,
    ),
  };
}

const readySource = {
  documentId: "doc-1",
  title: "Architecture specification",
  fileName: "architecture.pdf",
  type: "ARCHITECTURE",
  approvalStatus: "APPROVED",
  currentVersion: 2,
  approvedVersion: 1,
  readinessStatus: "READY",
  updatedAt: "2026-10-30T12:00:00Z",
};

const response = {
  data: [readySource],
  pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  summary: {
    totalCount: 1,
    readyCount: 1,
    verificationStatus: "VERIFIED",
    verifiedAt: "2026-10-30T12:00:00Z",
  },
};

describe("AiChatSourcesPanel", () => {
  beforeEach(() => {
    sourceQueryMock.mockReset().mockReturnValue({
      data: response,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("shows an accessible loading state without marking the idle panel busy", () => {
    sourceQueryMock.mockReturnValue({
      data: response,
      isPending: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading project sources",
    );
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("shows an empty state for a project with no documents", () => {
    sourceQueryMock.mockReturnValue({
      data: {
        ...response,
        data: [],
        pagination: { ...response.pagination, totalItems: 0, totalPages: 0 },
        summary: { ...response.summary, totalCount: 0, readyCount: 0 },
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText("No project documents yet")).toBeInTheDocument();
  });

  it("keeps existing rows visible and surfaces a failed refresh", () => {
    sourceQueryMock.mockReturnValue({
      data: response,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new Error("SAG unavailable"),
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load project sources",
    );
    expect(screen.getByText("—/1 sources ready for AI search")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Live SAG verification is unavailable; the ready count is unconfirmed.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Architecture specification")).toBeInTheDocument();
    expect(
      screen.getByText("AI uses approved v1; current version is v2"),
    ).toBeInTheDocument();
  });

  it.each([
    [401, "Sign-in required"],
    [403, "Project access denied"],
    [404, "Project sources are unavailable"],
  ])("shows the right access state for HTTP %s", (status, title) => {
    sourceQueryMock.mockReturnValue({
      data: response,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new ApiError(status, "REQUEST_FAILED", "Request failed"),
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(title);
    expect(screen.queryByText("Architecture specification")).not.toBeInTheDocument();
  });

  it("shows SAG verification unavailable only when the API says the live check failed", () => {
    sourceQueryMock.mockReturnValue({
      data: {
        ...response,
        summary: {
          ...response.summary,
          readyCount: null,
          verificationStatus: "UNAVAILABLE",
          verifiedAt: null,
        },
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Live SAG verification is unavailable; the ready count is unconfirmed.",
    );
  });

  it("hides cached source details after 403 and closes on Escape", () => {
    sourceQueryMock.mockReturnValue({
      data: response,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new ApiError(403, "FORBIDDEN", "No project access"),
      refetch: vi.fn(),
    });
    const { onClose } = renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Project access denied",
    );
    expect(screen.getByText("—/— sources ready for AI search")).toBeInTheDocument();
    expect(screen.queryByText("Architecture specification")).not.toBeInTheDocument();
    expect(screen.queryByText("AI uses approved v1; current version is v2")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps keyboard focus inside the mobile drawer", () => {
    renderPanel();
    const closeButton = screen.getAllByRole("button", {
      name: "Close project sources",
    })[1];
    const refreshButton = screen.getByRole("button", {
      name: "Refresh source status",
    });

    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(refreshButton).toHaveFocus();
  });

  it("displays the project badge when source items include projectCode in All-Projects mode", () => {
    sourceQueryMock.mockReturnValue({
      data: {
        ...response,
        data: [
          {
            ...readySource,
            projectId: "proj-core",
            projectCode: "CORE",
            projectName: "Continuum Core",
          },
        ],
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText("CORE")).toBeInTheDocument();
  });
});
