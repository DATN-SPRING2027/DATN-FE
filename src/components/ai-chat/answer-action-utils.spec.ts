import { describe, expect, it } from "vitest";
import {
  buildDislikeFeedbackPayload,
  detectAnswerSpeechLang,
  groupAnswerVersions,
  HIDDEN_SCOPE_PLACEHOLDER,
  isHiddenScopeMessage,
  isPersistedMessageId,
  selectLocalVoice,
  splitAnswerSpeechSegments,
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

  it("matches speech voices strictly by language and prioritizes Natural/Google voices over robotic offline fallbacks", () => {
    const hoaiMyNatural = {
      lang: "vi-VN",
      localService: false,
      name: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)",
    };
    const googleVi = {
      lang: "vi-VN",
      localService: false,
      name: "Google Tiếng Việt",
    };
    const microsoftAn = {
      lang: "vi-VN",
      localService: true,
      name: "Microsoft An - Vietnamese (Vietnam)",
    };
    const microsoftDavid = {
      lang: "en-US",
      localService: true,
      name: "Microsoft David Desktop - English (United States)",
    };
    const googleEn = {
      lang: "en-US",
      localService: false,
      name: "Google US English",
    };

    // Never falls back to an English voice when requesting Vietnamese
    expect(selectLocalVoice([microsoftDavid], "vi")).toBeUndefined();
    // Prefers Natural > Google > Offline An for Vietnamese
    expect(
      selectLocalVoice([microsoftDavid, microsoftAn, googleVi, hoaiMyNatural], "vi"),
    ).toBe(hoaiMyNatural);
    expect(
      selectLocalVoice([microsoftDavid, microsoftAn, googleVi], "vi"),
    ).toBe(googleVi);
    // Supports localOnly option for offline fallback
    expect(
      selectLocalVoice([googleVi, hoaiMyNatural, microsoftAn], "vi", {
        localOnly: true,
      }),
    ).toBe(microsoftAn);
    // Prefers Google US English over robotic Microsoft David for English
    expect(selectLocalVoice([microsoftDavid, googleEn], "en")).toBe(googleEn);
  });

  it("segments mixed Vietnamese and English text so each language run uses its native voice", () => {
    const mixedViSentence =
      "Hiện tại ở cái chat AI, chức năng Mind Map trong scope all của Manager đã hoạt động ổn định.";
    const segments = splitAnswerSpeechSegments(mixedViSentence, "vi");

    expect(segments).toEqual([
      { text: "Hiện tại ở cái", lang: "vi" },
      { text: "chat AI,", lang: "en" },
      { text: "chức năng", lang: "vi" },
      { text: "Mind Map", lang: "en" },
      { text: "trong", lang: "vi" },
      { text: "scope all", lang: "en" },
      { text: "của", lang: "vi" },
      { text: "Manager", lang: "en" },
      { text: "đã hoạt động ổn định.", lang: "vi" },
    ]);

    const englishWithViName =
      "Based on the specification from Trần Kim Thắng, the authentication service validates bearer tokens across all endpoints.";
    expect(detectAnswerSpeechLang(englishWithViName, "vi")).toBe("en");
    expect(splitAnswerSpeechSegments(englishWithViName, "en")).toEqual([
      { text: "Based on the specification from", lang: "en" },
      { text: "Trần Kim Thắng,", lang: "vi" },
      {
        text: "the authentication service validates bearer tokens across all endpoints.",
        lang: "en",
      },
    ]);
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
