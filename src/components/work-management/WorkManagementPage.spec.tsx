import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import messages from "@/messages/en.json";
import { useClientStateStore } from "@/stores/client-state";
import WorkManagementPage from "./WorkManagementPage";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
}));

vi.mock("@/components/common/PageBreadCrumb", () => ({
  default: () => null,
}));

const mockedApiClient = vi.mocked(apiClient);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <WorkManagementPage />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("WorkManagementPage", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    useClientStateStore.setState({ activeProjectId: null });
  });

  it("asks for a project before making any Work API request", () => {
    renderPage();

    expect(
      screen.getByText(messages.workManagement.selectProjectPrompt),
    ).toBeTruthy();
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("shows the pending IAM state instead of pretending the project is empty", async () => {
    mockedApiClient.mockRejectedValue(
      new Error("API request failed: 503 Service Unavailable"),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText(messages.workManagement.projectId), {
      target: { value: "507f1f77bcf86cd799439011" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: messages.workManagement.useProject }),
    );

    expect(
      await screen.findByText(messages.workManagement.authPending),
    ).toBeTruthy();
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items?page=1&pageSize=20",
    );
  });

  it("loads the next page and resets pagination after changing a filter", async () => {
    mockedApiClient.mockImplementation(async (path) => {
      const page = new URL(`http://localhost${path}`).searchParams.get("page");
      return {
        data: [],
        pagination: {
          page: Number(page),
          pageSize: 20,
          totalItems: 25,
          totalPages: 2,
        },
      };
    });
    renderPage();

    fireEvent.change(screen.getByLabelText(messages.workManagement.projectId), {
      target: { value: "507f1f77bcf86cd799439011" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: messages.workManagement.useProject }),
    );

    const nextPageButton = await screen.findByRole("button", {
      name: messages.workManagement.nextPage,
    });
    await waitFor(() =>
      expect((nextPageButton as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(nextPageButton);

    expect(
      await screen.findByText(
        messages.workManagement.pageOf
          .replace("{page}", "2")
          .replace("{totalPages}", "2"),
      ),
    ).toBeTruthy();
    expect(mockedApiClient).toHaveBeenLastCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items?page=2&pageSize=20",
    );

    fireEvent.change(screen.getByLabelText(messages.workManagement.filterStatus), {
      target: { value: "TODO" },
    });

    expect(
      await screen.findByText(
        messages.workManagement.pageOf
          .replace("{page}", "1")
          .replace("{totalPages}", "2"),
      ),
    ).toBeTruthy();
    expect(mockedApiClient).toHaveBeenLastCalledWith(
      "/projects/507f1f77bcf86cd799439011/work-items?page=1&pageSize=20&status=TODO",
    );
  });
});
