import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import type {
  AiAnswerFeedback,
  AiAnswerShare,
  AiChatCitation,
} from "@/lib/queries/ai-chat/ai-chat.types";
import AiChatAnswerActionBar from "./AiChatAnswerActionBar";
import { useLocalSpeech } from "./useLocalSpeech";

const {
  useFeedbackQueryMock,
  upsertFeedbackMutateAsync,
  deleteFeedbackMutateAsync,
  createShareMutateAsync,
  revokeShareMutateAsync,
} = vi.hoisted(() => ({
  useFeedbackQueryMock: vi.fn(),
  upsertFeedbackMutateAsync: vi.fn(),
  deleteFeedbackMutateAsync: vi.fn(),
  createShareMutateAsync: vi.fn(),
  revokeShareMutateAsync: vi.fn(),
}));

vi.mock("@/lib/queries/ai-chat/useAiAnswerActions", () => ({
  useAiAnswerFeedbackQuery: (...args: unknown[]) => useFeedbackQueryMock(...args),
  useUpsertAiAnswerFeedbackMutation: () => ({
    mutateAsync: upsertFeedbackMutateAsync,
    isPending: false,
  }),
  useDeleteAiAnswerFeedbackMutation: () => ({
    mutateAsync: deleteFeedbackMutateAsync,
    isPending: false,
  }),
  useCreateAiAnswerShareMutation: () => ({
    mutateAsync: createShareMutateAsync,
    isPending: false,
  }),
  useRevokeAiAnswerShareMutation: () => ({
    mutateAsync: revokeShareMutateAsync,
    isPending: false,
  }),
}));

describe("AiChatAnswerActionBar (Copy, Like/Dislike, Read Aloud, Share, Try Again & Versions)", () => {
  const sampleCitations: readonly AiChatCitation[] = [
    {
      number: 1,
      sourceId: "src-1",
      documentId: "507f1f77bcf86cd799439088",
      documentName: "Architecture Runbook",
      snippet: "Strict project-scoped token verification.",
    },
  ];

  beforeEach(() => {
    useFeedbackQueryMock.mockReset().mockReturnValue({
      data: { feedback: null },
      isLoading: false,
      isError: false,
    });
    upsertFeedbackMutateAsync.mockReset();
    deleteFeedbackMutateAsync.mockReset();
    createShareMutateAsync.mockReset();
    revokeShareMutateAsync.mockReset();
  });

  function renderBar(overrides: Partial<React.ComponentProps<typeof AiChatAnswerActionBar>> = {}) {
    const onSelectVersion = vi.fn();
    const onRegenerate = vi.fn();
    const onToggleSpeak = vi.fn();

    const utils = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatAnswerActionBar
          organizationId="org-1"
          projectId="proj-1"
          projectName="Continuum Core"
          threadId="thread-1"
          message={{
            id: "msg-a2",
            role: "assistant",
            content: "Verified architecture answer [1].",
            status: "ok",
            citations: sampleCitations,
            sessionCitations: [],
            retrievalSteps: [],
            createdAt: "2026-10-30T09:00:00Z",
          }}
          questionText="How does BFF isolate project access?"
          versionIndex={1}
          versionCount={2}
          isThreadStreaming={false}
          isSpeaking={false}
          speechError={null}
          onSelectVersionIndex={onSelectVersion}
          onRegenerate={onRegenerate}
          onToggleSpeak={onToggleSpeak}
          {...overrides}
        />
      </NextIntlClientProvider>,
    );
    return { ...utils, onSelectVersion, onRegenerate, onToggleSpeak };
  }

  it("handles clipboard write failure cleanly without claiming copied", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValueOnce(new Error("Permission denied")),
      },
    });

    renderBar();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });

    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/clipboard|copy/i);
  });

  it("enforces Dislike OTHER reason validation, preserves vote on cancel, shows server error with retry, and toggles active vote via DELETE", async () => {
    useFeedbackQueryMock.mockReturnValue({
      data: {
        feedback: {
          messageId: "msg-a2",
          rating: "LIKE",
          updatedAt: "2026-10-30T09:01:00Z",
        } satisfies AiAnswerFeedback,
      },
      isLoading: false,
      isError: false,
    });

    renderBar();

    // Active LIKE is marked aria-pressed="true"
    const likeBtn = screen.getByRole("button", { name: "Helpful" });
    expect(likeBtn).toHaveAttribute("aria-pressed", "true");

    // Clicking Dislike opens reason dialog without deleting LIKE yet
    fireEvent.click(screen.getByRole("button", { name: "Not helpful" }));
    const dialog = screen.getByRole("dialog", { name: /feedback|not helpful/i });
    expect(dialog).toBeInTheDocument();
    expect(upsertFeedbackMutateAsync).not.toHaveBeenCalled();

    // Cancel keeps prior LIKE vote untouched
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(upsertFeedbackMutateAsync).not.toHaveBeenCalled();

    // Open Dislike again, choose OTHER with whitespace -> submit blocked
    fireEvent.click(screen.getByRole("button", { name: "Not helpful" }));
    const reopened = screen.getByRole("dialog", { name: /feedback|not helpful/i });
    fireEvent.click(within(reopened).getByRole("radio", { name: /Other/i }));
    const reasonInput = within(reopened).getByRole("textbox");
    fireEvent.change(reasonInput, { target: { value: "   " } });

    const submitBtn = within(reopened).getByRole("button", {
      name: /Submit feedback/i,
    });
    expect(submitBtn).toBeDisabled();

    // Enter valid reason, simulate server error first -> stays open with error & retry, never claims saved
    upsertFeedbackMutateAsync.mockRejectedValueOnce(
      new ApiError(503, "SAG_UNAVAILABLE", "Feedback service unavailable"),
    );
    fireEvent.change(reasonInput, {
      target: { value: "Citation [1] refers to v1 instead of v2." },
    });
    expect(submitBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(reopened).getByRole("alert")).toHaveTextContent(
      /Feedback service unavailable/i,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Retry succeeds -> closes modal
    upsertFeedbackMutateAsync.mockResolvedValueOnce({
      messageId: "msg-a2",
      rating: "DISLIKE",
      reasonCategory: "OTHER",
      reasonText: "Citation [1] refers to v1 instead of v2.",
      updatedAt: "2026-10-30T09:02:00Z",
    } satisfies AiAnswerFeedback);

    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(upsertFeedbackMutateAsync).toHaveBeenLastCalledWith({
      threadId: "thread-1",
      messageId: "msg-a2",
      body: {
        rating: "DISLIKE",
        reasonCategory: "OTHER",
        reasonText: "Citation [1] refers to v1 instead of v2.",
      },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Clicking active LIKE button removes vote via DELETE
    deleteFeedbackMutateAsync.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.click(likeBtn);
    });
    expect(deleteFeedbackMutateAsync).toHaveBeenCalledWith({
      threadId: "thread-1",
      messageId: "msg-a2",
    });
  });

  it("opens Share preview modal, creates project-scoped link, and allows creator to revoke", async () => {
    createShareMutateAsync.mockResolvedValueOnce({
      id: "share-99",
      projectId: "proj-1",
      messageId: "msg-a2",
      createdAt: "2026-10-30T09:05:00Z",
    } satisfies AiAnswerShare);
    revokeShareMutateAsync.mockResolvedValueOnce(undefined);

    renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    const shareDialog = screen.getByRole("dialog", { name: /Share answer/i });
    expect(
      within(shareDialog).getByText("How does BFF isolate project access?"),
    ).toBeInTheDocument();
    expect(
      within(shareDialog).getByText("Verified architecture answer [1]."),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        within(shareDialog).getByRole("button", { name: /Create share link/i }),
      );
    });

    expect(createShareMutateAsync).toHaveBeenCalledWith({
      threadId: "thread-1",
      messageId: "msg-a2",
    });

    expect(
      within(shareDialog).getByDisplayValue(
        /\/projects\/proj-1\/ai-chat\/shares\/share-99$/,
      ),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        within(shareDialog).getByRole("button", { name: /Revoke link/i }),
      );
    });

    expect(revokeShareMutateAsync).toHaveBeenCalledWith({
      shareId: "share-99",
    });
  });

  it("switches answer versions via tabular-nums selector and triggers Try again regeneration", () => {
    const { onSelectVersion, onRegenerate } = renderBar();

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous answer version" }));
    expect(onSelectVersion).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("renders all 6 answer action buttons as icon-only controls with aria-label and hover title", () => {
    renderBar();

    for (const label of [
      "Copy",
      "Helpful",
      "Not helpful",
      "Read aloud",
      "Share",
      "Try again",
    ]) {
      const btn = screen.getByRole("button", { name: label });
      expect(btn.textContent?.trim() ?? "").toBe("");
      expect(btn).toHaveAttribute("title", label);
    }
  });

  it("scopes inline feedback retry state to the exact answer version and hides it on version switch (Finding #6)", async () => {
    upsertFeedbackMutateAsync.mockRejectedValueOnce(
      new ApiError(503, "SAG_UNAVAILABLE", "Temporary vote failure on v1"),
    );

    const { rerender, onSelectVersion, onRegenerate, onToggleSpeak } = renderBar({
      message: {
        id: "msg-v1",
        role: "assistant",
        content: "Answer version 1 [1].",
        status: "ok",
        citations: sampleCitations,
        sessionCitations: [],
        retrievalSteps: [],
        createdAt: "2026-10-30T09:00:00Z",
      },
      versionIndex: 0,
      versionCount: 2,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Temporary vote failure on v1/i,
    );

    // Switch active version from msg-v1 -> msg-v2 on the same mounted bar: v1's error/retry must NOT leak!
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatAnswerActionBar
          organizationId="org-1"
          projectId="proj-1"
          projectName="Continuum Core"
          threadId="thread-1"
          message={{
            id: "msg-v2",
            role: "assistant",
            content: "Answer version 2 [1].",
            status: "ok",
            citations: sampleCitations,
            sessionCitations: [],
            retrievalSteps: [],
            createdAt: "2026-10-30T09:01:00Z",
          }}
          questionText="How does BFF isolate project access?"
          versionIndex={1}
          versionCount={2}
          isThreadStreaming={false}
          isSpeaking={false}
          speechError={null}
          onSelectVersionIndex={onSelectVersion}
          onRegenerate={onRegenerate}
          onToggleSpeak={onToggleSpeak}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("never speaks after unmount or stopSpeech while browser voices are still loading asynchronously (Finding #8)", async () => {
    const listenerState: {
      active: (() => void) | null;
      lastRegistered: (() => void) | null;
    } = { active: null, lastRegistered: null };
    let availableVoices: SpeechSynthesisVoice[] = [];
    const speakSpy = vi.fn();
    const cancelSpy = vi.fn();

    const fakeSynth = {
      getVoices: vi.fn(() => availableVoices),
      speak: speakSpy,
      cancel: cancelSpy,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === "voiceschanged") {
          listenerState.active = cb;
          listenerState.lastRegistered = cb;
        }
      }),
      removeEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === "voiceschanged" && listenerState.active === cb) {
          listenerState.active = null;
        }
      }),
    };

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      writable: true,
      value: fakeSynth,
    });
    class FakeUtterance {
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      lang = "";
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    const localVoice = {
      lang: "en-US",
      localService: true,
      name: "Local English",
      default: true,
      voiceURI: "local-en",
    } as SpeechSynthesisVoice;

    // Case A: stopSpeech called (e.g. version switch) while voices are still resolving
    const { result, unmount } = renderHook(() => useLocalSpeech("en"));
    let pendingPromise: Promise<void> | undefined;
    act(() => {
      pendingPromise = result.current.toggleSpeak("msg-v1", "Read this aloud.");
    });
    expect(result.current.preparingMessageId).toBe("msg-v1");

    act(() => {
      result.current.stopSpeech();
    });
    expect(listenerState.active).toBeNull();
    availableVoices = [localVoice];
    listenerState.lastRegistered?.();
    await act(async () => {
      await pendingPromise;
    });
    expect(speakSpy).not.toHaveBeenCalled();

    // Case B: component unmounts while voices are still resolving
    availableVoices = [];
    const { result: result2, unmount: unmount2 } = renderHook(() =>
      useLocalSpeech("en"),
    );
    let pendingUnmountPromise: Promise<void> | undefined;
    act(() => {
      pendingUnmountPromise = result2.current.toggleSpeak(
        "msg-v2",
        "Never speak after unmount.",
      );
    });
    unmount2();
    expect(listenerState.active).toBeNull();
    availableVoices = [localVoice];
    listenerState.lastRegistered?.();
    await act(async () => {
      await pendingUnmountPromise;
    });
    expect(speakSpy).not.toHaveBeenCalled();

    unmount();
    vi.unstubAllGlobals();
  });

  it("opens More actions (⋯) popover with formatted timestamp, View sources, and Branch in new chat", () => {
    const onOpenSources = vi.fn();
    const onBranchInNewChat = vi.fn();

    renderBar({
      onOpenSources,
      onBranchInNewChat,
    });

    const moreBtn = screen.getByRole("button", { name: "More actions" });
    expect(moreBtn).toHaveAttribute("aria-haspopup", "menu");
    expect(moreBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(moreBtn);
    expect(moreBtn).toHaveAttribute("aria-expanded", "true");

    const menu = screen.getByRole("menu", { name: "More actions" });
    expect(menu).toBeVisible();
    expect(
      within(menu).getByTestId("ai-chat-more-actions-timestamp"),
    ).toHaveTextContent(/Oct/i);

    const viewSourcesItem = within(menu).getByRole("menuitem", {
      name: "View sources",
    });
    const branchItem = within(menu).getByRole("menuitem", {
      name: "Branch in new chat",
    });
    expect(viewSourcesItem).toBeVisible();
    expect(branchItem).toBeVisible();

    // Keyboard ArrowDown / Escape support
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(branchItem);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("menu", { name: "More actions" }),
    ).not.toBeInTheDocument();

    // Reopen and trigger View sources
    fireEvent.click(moreBtn);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "View sources" }),
    );
    expect(onOpenSources).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("menu", { name: "More actions" }),
    ).not.toBeInTheDocument();

    // Reopen and trigger Branch in new chat
    fireEvent.click(moreBtn);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Branch in new chat" }),
    );
    expect(onBranchInNewChat).toHaveBeenCalledTimes(1);
  });

  it("hides View sources when the turn has no citations and disables Branch while streaming or branching", () => {
    renderBar({
      message: {
        id: "msg-plain",
        role: "assistant",
        content: "Direct greeting response without document citations.",
        status: "ok",
        citations: [],
        sessionCitations: [],
        retrievalSteps: [],
        createdAt: "2026-10-30T09:00:00Z",
      },
      isBranching: true,
      onOpenSources: undefined,
      onBranchInNewChat: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menu = screen.getByRole("menu", { name: "More actions" });
    expect(
      within(menu).queryByRole("menuitem", { name: "View sources" }),
    ).not.toBeInTheDocument();

    const branchingItem = within(menu).getByRole("menuitem", {
      name: "Branching…",
    });
    expect(branchingItem).toBeDisabled();
    expect(branchingItem).toHaveAttribute("aria-busy", "true");
  });
});
