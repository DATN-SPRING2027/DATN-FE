import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import type { PlatformAiOperationsData } from "@/lib/queries/platform/usePlatformOperations";
import PlatformAiDirectory from "./PlatformAiDirectory";
import type { PlatformOperationsViewModel } from "./usePlatformOperationsViewModel";

vi.mock("./PlatformAiFeedbackPanel", () => ({
  default: ({ permissions }: { permissions: readonly string[] }) => (
    <div data-testid="platform-ai-feedback-panel">
      {permissions.join(",")}
    </div>
  ),
}));

const liveAiData: PlatformAiOperationsData = {
  id: "sag",
  name: "SAG",
  status: "READY",
  availability: "AVAILABLE",
  liveness: "ALIVE",
  readiness: "READY",
  dependencies: {
    database: "AVAILABLE",
    knowledgeRuntime: "READY",
    retrieval: "READY",
    modelProvider: "CONFIGURED",
    processingJobs: "IDLE",
    failedProcessingSummary: "HAS_FAILURES",
  },
  runtimeProfile: {
    llmConfigured: true,
    llmProvider: "openai",
    llmModel: "Qwen/Qwen3-8B",
    retrievalModel: "Qwen/Qwen3-Embedding-0.6B",
    vectorStore: "qdrant",
    parserProvider: "mineru",
    workerConcurrency: 4,
  },
  jobSummary: {
    queued: 0,
    running: 0,
    paused: 0,
    succeeded: 352,
    failed: 34,
  },
  corpusSummary: {
    ready: 221,
    processing: 0,
    paused: 0,
    failed: 0,
  },
  lastCheckedAt: "2026-11-14T11:22:00.000Z",
  diagnosticsSummary:
    "SAG metadata database, knowledge runtime, retrieval store, and operational summary report ready.",
};

function createModel(
  overrides: {
    canReadAi?: boolean;
    ai?: Partial<PlatformOperationsViewModel["ai"]>;
  } = {},
): PlatformOperationsViewModel {
  return {
    canReadAi: overrides.canReadAi ?? true,
    permissions: ["platform.ai.operations.read"],
    ai: {
      data: liveAiData,
      error: null,
      isPending: false,
      isFetching: false,
      isError: false,
      isRefetchError: false,
      refetch: vi.fn(),
      ...overrides.ai,
    },
  } as unknown as PlatformOperationsViewModel;
}

function renderDirectory(
  model: PlatformOperationsViewModel,
  locale: "en" | "vi" = "en",
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : enMessages}
    >
      <PlatformAiDirectory model={model} />
    </NextIntlClientProvider>,
  );
}

describe("PlatformAiDirectory", () => {
  it("blocks access with the required permission notice when platform.ai.operations.read is absent", () => {
    renderDirectory(createModel({ canReadAi: false }));

    expect(
      screen.getByText(
        "Your Platform session does not grant platform.ai.operations.read.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("platform-ai-feedback-panel"),
    ).not.toBeInTheDocument();
  });

  it("renders a loading skeleton while initial AI operations telemetry is pending", () => {
    renderDirectory(
      createModel({
        ai: { data: undefined, isPending: true, isError: false },
      }),
    );

    expect(screen.getByText("Loading Platform data")).toBeInTheDocument();
  });

  it("renders ErrorState and calls refetch when initial load fails", () => {
    const refetch = vi.fn();
    renderDirectory(
      createModel({
        ai: { data: undefined, isPending: false, isError: true, refetch },
      }),
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders background refresh warning when refetch fails while keeping cached telemetry", () => {
    const refetch = vi.fn();
    renderDirectory(
      createModel({
        ai: {
          data: liveAiData,
          isError: true,
          isRefetchError: true,
          isFetching: false,
          refetch,
        },
      }),
    );

    expect(screen.getByText("Qwen/Qwen3-8B")).toBeInTheDocument();
    const retryButtons = screen.getAllByRole("button", { name: "Retry" });
    expect(retryButtons.length).toBeGreaterThan(0);
    fireEvent.click(retryButtons[0]!);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders live runtime profile, corpus, job KPIs, dependency badges, and Refresh trigger in English and Vietnamese", () => {
    const refetch = vi.fn();
    const { rerender } = renderDirectory(createModel({ ai: { refetch } }), "en");

    expect(screen.getByText("Qwen/Qwen3-8B")).toBeInTheDocument();
    expect(screen.getByText("Qwen/Qwen3-Embedding-0.6B")).toBeInTheDocument();
    expect(screen.getByText(/Vector: qdrant/i)).toBeInTheDocument();
    expect(screen.getByText(/Parser: mineru/i)).toBeInTheDocument();
    expect(screen.getByText("221")).toBeInTheDocument();
    expect(screen.getByText("0 active")).toBeInTheDocument();
    expect(screen.getByText(/352 succeeded/)).toBeInTheDocument();
    expect(screen.getByText(/34 failed/)).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByText("Has failures")).toBeInTheDocument();
    expect(
      screen.getByTestId("platform-ai-feedback-panel"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <PlatformAiDirectory model={createModel({ ai: { refetch } })} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Vận hành SAG / RAG")).toBeInTheDocument();
    expect(screen.getByText("0 đang chạy")).toBeInTheDocument();
    expect(screen.getByText(/352 hoàn tất/)).toBeInTheDocument();
    expect(screen.getByText("Nhà cung cấp LLM")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Làm mới" }),
    ).toBeInTheDocument();
  });

  it("renders honest telemetry unavailable message without fabricated zeroes when telemetry objects are null", () => {
    renderDirectory(
      createModel({
        ai: {
          data: {
            ...liveAiData,
            dependencies: {
              database: "AVAILABLE",
              knowledgeRuntime: "READY",
              retrieval: "READY",
              modelProvider: "NOT_EXPOSED",
              processingJobs: "NOT_EXPOSED",
              failedProcessingSummary: "NOT_EXPOSED",
            },
            runtimeProfile: null,
            jobSummary: null,
            corpusSummary: null,
          },
        },
      }),
    );

    expect(
      screen.getByText(
        "Detailed model and job counts are currently unavailable from SAG. Readiness checks remain active above.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("0 active")).not.toBeInTheDocument();
    expect(screen.queryByText("Qwen/Qwen3-8B")).not.toBeInTheDocument();
  });
});
