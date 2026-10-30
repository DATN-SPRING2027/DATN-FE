import { describe, expect, it } from "vitest";
import {
  buildDislikeFeedbackPayload,
  detectAnswerSpeechLang,
  groupAnswerVersions,
  HIDDEN_SCOPE_PLACEHOLDER,
  isHiddenScopeMessage,
  isPersistedMessageId,
  selectLocalVoice,
  stripAnswerToPlainSpeechText,
  validateDislike,
} from "./answer-action-utils";

describe("answer action boundaries", () => {
  it("requires a meaningful reason for OTHER without sending incomplete feedback", () => {
    expect(validateDislike("OTHER", "  ")).toBe(false);
    expect(validateDislike("OTHER", "Wrong conclusion")).toBe(true);
    expect(validateDislike("INACCURATE", "")).toBe(true);
    expect(validateDislike("INCOMPLETE", "x".repeat(1001))).toBe(false);
  });

  it("groups regenerated answers under the same question without duplicating user turns", () => {
    const messages = [
      { id: "q", role: "user" },
      { id: "a", role: "assistant", replyToMessageId: "q" },
      { id: "q2", role: "user" },
      { id: "b", role: "assistant", replyToMessageId: "q2" },
      {
        id: "a2",
        role: "assistant",
        replyToMessageId: "q",
        regeneratedFromMessageId: "a",
      },
    ] as const;
    const grouped = groupAnswerVersions(messages);
    expect(grouped.map((x) => x.message.id)).toEqual(["q", "a2", "q2", "b"]);
    expect(grouped[1]!.versions.map((x) => x.id)).toEqual(["a", "a2"]);
  });

  it("never sends answer text to a remote speech voice", () => {
    const remote = { lang: "vi-VN", localService: false };
    const local = { lang: "en-US", localService: true };
    expect(selectLocalVoice([remote, local], "vi")).toBe(local);
    expect(selectLocalVoice([remote], "vi")).toBeUndefined();
  });

  it("anchors legacy turns without replyToMessageId and chains regenerated versions", () => {
    const legacyMessages = [
      { id: "u1", role: "user" as const },
      { id: "a1", role: "assistant" as const },
      {
        id: "a1-v2",
        role: "assistant" as const,
        regeneratedFromMessageId: "a1",
      },
    ];
    const grouped = groupAnswerVersions(legacyMessages);
    expect(grouped).toHaveLength(2);
    expect(grouped[1]!.message.id).toBe("a1-v2");
    expect(grouped[1]!.versions.map((v) => v.id)).toEqual(["a1", "a1-v2"]);
    expect(grouped[1]!.questionMessage?.id).toBe("u1");
  });

  it("omits blank optional reasonText when building non-OTHER dislike payload", () => {
    expect(buildDislikeFeedbackPayload("OUTDATED", "   ")).toEqual({
      rating: "DISLIKE",
      reasonCategory: "OUTDATED",
    });
    expect(buildDislikeFeedbackPayload("OTHER", "  Missing citation 2  ")).toEqual({
      rating: "DISLIKE",
      reasonCategory: "OTHER",
      reasonText: "Missing citation 2",
    });
  });

  it("strips markdown formatting and inline citation markers for natural local speech", () => {
    const raw =
      "### Security Scope\n- **Project ACL** isolates tokens [1, S1].\n```ts\nconst secret = 1;\n```\nVerified `HS256` claim [2].";
    const plain = stripAnswerToPlainSpeechText(raw);
    expect(plain).not.toContain("[1");
    expect(plain).not.toContain("S1]");
    expect(plain).not.toContain("**");
    expect(plain).not.toContain("```");
    expect(plain).toContain("Project ACL isolates tokens");
    expect(detectAnswerSpeechLang("Câu trả lời đã xác minh", "en")).toBe("vi");
    expect(detectAnswerSpeechLang("Verified project scope", "en")).toBe("en");
  });

  it("distinguishes persisted server message IDs from optimistic local turn IDs", () => {
    expect(isPersistedMessageId("local-assistant-1730000000")).toBe(false);
    expect(isPersistedMessageId("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toBe(
      true,
    );
    expect(isHiddenScopeMessage(HIDDEN_SCOPE_PLACEHOLDER)).toBe(true);
    expect(isHiddenScopeMessage("Normal grounded answer")).toBe(false);
  });
});
