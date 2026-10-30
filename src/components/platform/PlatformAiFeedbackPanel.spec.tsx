import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import PlatformAiFeedbackPanel from "./PlatformAiFeedbackPanel";

const { useFeedbackListMock, useOrganizationsMock, useProjectsMock } =
  vi.hoisted(() => ({
    useFeedbackListMock: vi.fn(),
    useOrganizationsMock: vi.fn(),
    useProjectsMock: vi.fn(),
  }));

vi.mock("@/lib/queries/platform/usePlatformConsole", () => ({
  usePlatformOrganizationsQuery: (...args: unknown[]) =>
    useOrganizationsMock(...args),
}));

vi.mock("@/lib/queries/platform/usePlatformOperations", () => ({
  usePlatformAiFeedbackQuery: (...args: unknown[]) =>
    useFeedbackListMock(...args),
  usePlatformProjectsQuery: (...args: unknown[]) => useProjectsMock(...args),
}));

describe("PlatformAiFeedbackPanel (System Admin AI Chat Like/Dislike summary & reasons)", () => {
  beforeEach(() => {
    useOrganizationsMock.mockReset().mockReturnValue({
      data: {
        data: [
          {
            id: "651a2b3c4d5e6f7a8b9c0d21",
            name: "Continuum Labs",
            slug: "continuum-labs",
            plan: "ENTERPRISE",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-02T00:00:00.000Z",
          },
        ],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
    });
    useProjectsMock.mockReset().mockReturnValue({
      data: {
        data: [
          {
            id: "751a2b3c4d5e6f7a8b9c0d99",
            organizationId: "651a2b3c4d5e6f7a8b9c0d21",
            name: "Core Platform",
            code: "CORE",
            visibility: "PRIVATE",
            status: "ACTIVE",
          },
        ],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      },
      isPending: false,
      isError: false,
    });
    useFeedbackListMock.mockReset().mockReturnValue({
      data: {
        totals: { likes: 18, dislikes: 4 },
        items: [
          {
            id: "fb-1",
            organizationId: "651a2b3c4d5e6f7a8b9c0d21",
            projectId: "751a2b3c4d5e6f7a8b9c0d99",
            messageId: "msg-202",
            rating: "DISLIKE" as const,
            reasonCategory: "INACCURATE" as const,
            reasonText:
              "Cited an archived architecture section instead of the v3 rollout guide.",
            createdAt: "2026-10-30T08:30:00.000Z",
            updatedAt: "2026-10-30T08:31:00.000Z",
          },
        ],
        nextCursor: "cursor-page-2",
      },
      isPending: false,
      isFetching: false,
      isError: false,
      isRefetchError: false,
      refetch: vi.fn(),
    });
  });

  function renderPanel(permissions: readonly string[] = [
    "platform.ai.operations.read",
    "platform.organizations.organization.read",
    "platform.projects.project.read",
  ]) {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PlatformAiFeedbackPanel permissions={permissions} />
      </NextIntlClientProvider>,
    );
  }

  it("displays Likes and Dislikes KPI totals, filters by rating, paginates with cursor, and opens full dislike reason details", () => {
    renderPanel();

    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/Inaccurate/i)).toBeInTheDocument();

    // Inspect full reason modal
    fireEvent.click(screen.getByRole("button", { name: /View reason/i }));
    const dialog = screen.getByRole("dialog", { name: /Feedback details/i });
    expect(
      within(dialog).getByText(
        "Cited an archived architecture section instead of the v3 rollout guide.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: /Close/i })[0]!);

    // Next cursor page
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(useFeedbackListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "cursor-page-2" }),
      true,
    );

    // Changing rating filter resets cursor to first page
    fireEvent.change(screen.getByRole("combobox", { name: /Rating/i }), {
      target: { value: "DISLIKE" },
    });
    expect(useFeedbackListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ rating: "DISLIKE", cursor: undefined }),
      true,
    );
  });
});
