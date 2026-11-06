import type {
  AiAnswerFeedbackInput,
  AiDislikeReasonCategory,
} from "@/lib/queries/ai-chat/ai-chat.types";

export const DISLIKE_REASON_CATEGORIES: readonly AiDislikeReasonCategory[] = [
  "INACCURATE",
  "OUTDATED",
  "IRRELEVANT_CITATION",
  "INCOMPLETE",
  "OTHER",
] as const;

export const MAX_DISLIKE_REASON_LENGTH = 1000;

export function isDislikeReasonCategory(
  value: unknown,
): value is AiDislikeReasonCategory {
  return (
    typeof value === "string" &&
    (DISLIKE_REASON_CATEGORIES as readonly string[]).includes(value)
  );
}

export function validateDislike(
  reasonCategory: string | null | undefined,
  reasonText: string | null | undefined,
): boolean {
  if (!isDislikeReasonCategory(reasonCategory)) {
    return false;
  }
  const raw = reasonText ?? "";
  if (raw.length > MAX_DISLIKE_REASON_LENGTH) {
    return false;
  }
  if (reasonCategory === "OTHER") {
    return /\S/.test(raw);
  }
  return true;
}

export function buildDislikeFeedbackPayload(
  reasonCategory: AiDislikeReasonCategory,
  reasonText: string,
): Extract<AiAnswerFeedbackInput, { rating: "DISLIKE" }> {
  const trimmed = reasonText.trim();
  return trimmed.length > 0
    ? {
        rating: "DISLIKE",
        reasonCategory,
        reasonText: trimmed,
      }
    : {
        rating: "DISLIKE",
        reasonCategory,
      };
}

export interface GroupableChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly replyToMessageId?: string | null;
  readonly regeneratedFromMessageId?: string | null;
}

export interface GroupedChatTurn<T extends GroupableChatMessage> {
  readonly groupKey: string;
  readonly message: T;
  readonly versions: readonly T[];
  readonly questionMessage?: T;
}

export function groupAnswerVersions<T extends GroupableChatMessage>(
  messages: readonly T[],
): GroupedChatTurn<T>[] {
  const userById = new Map<string, T>();
  for (const item of messages) {
    if (item.role === "user") {
      userById.set(item.id, item);
    }
  }

  const slots: Array<{
    groupKey: string;
    versions: T[];
    questionMessage?: T;
  }> = [];
  const slotIndexByKey = new Map<string, number>();
  const slotIndexByAssistantId = new Map<string, number>();
  let lastSeenUser: T | undefined;

  for (const item of messages) {
    if (item.role === "user") {
      lastSeenUser = item;
      slots.push({
        groupKey: `user:${item.id}`,
        versions: [item],
      });
      continue;
    }

    let resolvedSlotIdx: number | undefined;
    let groupKey = "";
    let questionMessage: T | undefined;

    if (item.replyToMessageId) {
      groupKey = `reply:${item.replyToMessageId}`;
      questionMessage = userById.get(item.replyToMessageId);
      resolvedSlotIdx = slotIndexByKey.get(groupKey);
    }

    if (
      resolvedSlotIdx === undefined &&
      item.regeneratedFromMessageId &&
      slotIndexByAssistantId.has(item.regeneratedFromMessageId)
    ) {
      resolvedSlotIdx = slotIndexByAssistantId.get(
        item.regeneratedFromMessageId,
      );
      if (resolvedSlotIdx !== undefined) {
        groupKey = slots[resolvedSlotIdx]!.groupKey;
        questionMessage = slots[resolvedSlotIdx]!.questionMessage;
      }
    }

    if (!groupKey) {
      if (lastSeenUser) {
        groupKey = `reply:${lastSeenUser.id}`;
        questionMessage = lastSeenUser;
        resolvedSlotIdx = slotIndexByKey.get(groupKey);
      } else {
        groupKey = `assistant:${item.id}`;
      }
    }

    if (resolvedSlotIdx !== undefined) {
      const existingSlot = slots[resolvedSlotIdx]!;
      existingSlot.versions.push(item);
      if (!existingSlot.questionMessage && questionMessage) {
        existingSlot.questionMessage = questionMessage;
      }
      slotIndexByAssistantId.set(item.id, resolvedSlotIdx);
    } else {
      const nextIdx = slots.length;
      slots.push({
        groupKey,
        versions: [item],
        questionMessage,
      });
      slotIndexByKey.set(groupKey, nextIdx);
      slotIndexByAssistantId.set(item.id, nextIdx);
    }
  }

  return slots.map((slot) => ({
    groupKey: slot.groupKey,
    message: slot.versions[slot.versions.length - 1]!,
    versions: slot.versions,
    ...(slot.questionMessage ? { questionMessage: slot.questionMessage } : {}),
  }));
}

export interface LocalSpeechVoiceCandidate {
  readonly lang: string;
  readonly localService: boolean;
  readonly name?: string;
  readonly default?: boolean;
}

export interface SpeechSegment {
  readonly text: string;
  readonly lang: "vi" | "en";
}

function normalizeLangTag(lang: string): string {
  return (lang ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function scoreVoiceCandidate(
  voice: LocalSpeechVoiceCandidate,
  normalizedPref: string,
  primarySubtag: string,
): number {
  const voiceLang = normalizeLangTag(voice.lang);
  const voiceName = (voice.name ?? "").toLowerCase();
  let score = 0;

  if (normalizedPref && voiceLang === normalizedPref) {
    score += 30;
  } else if (primarySubtag === "vi" && voiceLang === "vi-vn") {
    score += 25;
  } else if (primarySubtag === "en" && voiceLang === "en-us") {
    score += 25;
  } else if (
    primarySubtag === "en" &&
    (voiceLang === "en-gb" || voiceLang === "en-au" || voiceLang === "en-ca")
  ) {
    score += 15;
  }

  if (voiceName.includes("natural") || voiceName.includes("neural")) {
    score += 120;
  } else if (voiceName.includes("google")) {
    score += 95;
  } else if (
    voiceName.includes("online") ||
    voiceName.includes("premium") ||
    voiceName.includes("enhanced")
  ) {
    score += 70;
  } else if (
    voiceName.includes("siri") ||
    voiceName.includes("linh") ||
    voiceName.includes("samantha") ||
    voiceName.includes("ava")
  ) {
    score += 60;
  }

  if (
    voiceName.includes("hoaimy") ||
    voiceName.includes("namminh") ||
    voiceName.includes("aria") ||
    voiceName.includes("jenny") ||
    voiceName.includes("guy")
  ) {
    score += 25;
  } else if (voiceName.includes("zira")) {
    score += 20;
  } else if (primarySubtag === "vi" && /\ban\b/.test(voiceName)) {
    score += 15;
  }

  if (voice.localService === true) {
    score += 10;
  }
  if (voice.default === true) {
    score += 5;
  }

  return score;
}

export function selectLocalVoice<T extends LocalSpeechVoiceCandidate>(
  voices: readonly T[],
  preferredLang: string,
  options?: { readonly localOnly?: boolean },
): T | undefined {
  if (voices.length === 0) {
    return undefined;
  }

  const normalizedPref = normalizeLangTag(preferredLang);
  const primarySubtag = normalizedPref.split("-")[0] ?? "";
  if (!primarySubtag) {
    return undefined;
  }

  const matchingVoices = voices.filter((voice) => {
    if (options?.localOnly && voice.localService !== true) {
      return false;
    }
    const normalizedVoiceLang = normalizeLangTag(voice.lang);
    return (
      normalizedVoiceLang === primarySubtag ||
      normalizedVoiceLang.startsWith(`${primarySubtag}-`)
    );
  });

  if (matchingVoices.length === 0) {
    return undefined;
  }

  let bestVoice = matchingVoices[0]!;
  let bestScore = scoreVoiceCandidate(bestVoice, normalizedPref, primarySubtag);

  for (let i = 1; i < matchingVoices.length; i += 1) {
    const candidate = matchingVoices[i]!;
    const candidateScore = scoreVoiceCandidate(
      candidate,
      normalizedPref,
      primarySubtag,
    );
    if (candidateScore > bestScore) {
      bestVoice = candidate;
      bestScore = candidateScore;
    }
  }

  return bestVoice;
}

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const VIETNAMESE_EXCLUSIVE_ASCII_WORDS = new Set([
  "trong",
  "theo",
  "nhung",
  "khong",
  "duoc",
  "ngay",
  "thay",
  "chia",
  "khung",
  "chung",
  "trang",
  "nhanh",
  "chua",
  "luon",
  "xoay",
  "ngang",
  "nhau",
  "chao",
  "xem",
  "khu",
  "kho",
  "nho",
  "nha",
  "nhe",
  "nhi",
  "nhu",
  "nghe",
  "nghi",
  "ngoi",
  "ngu",
  "ngan",
  "ngon",
  "thoi",
  "them",
  "thua",
  "trao",
  "treo",
  "troi",
  "trua",
  "trung",
  "khao",
  "khau",
  "khoi",
  "giao",
  "chuyen",
  "quyen",
  "nguyen",
]);

const ENGLISH_CERTAIN_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "has",
  "had",
  "are",
  "was",
  "were",
  "will",
  "would",
  "should",
  "could",
  "not",
  "but",
  "what",
  "which",
  "when",
  "where",
  "who",
  "why",
  "how",
  "into",
  "across",
  "between",
  "through",
  "about",
  "after",
  "before",
  "during",
  "without",
  "within",
  "because",
  "however",
  "therefore",
  "although",
  "while",
  "each",
  "every",
  "both",
  "either",
  "neither",
  "these",
  "those",
  "their",
  "there",
  "here",
  "been",
  "being",
  "only",
  "also",
  "such",
  "than",
  "then",
  "them",
  "they",
  "your",
  "our",
  "you",
  "she",
  "her",
  "his",
  "its",
  "two",
  "three",
  "all",
  "any",
  "some",
  "more",
  "most",
  "other",
  "new",
  "now",
  "see",
  "too",
  "use",
  "used",
  "using",
  "try",
  "sky",
  "fly",
  "dry",
  "cry",
  "ai",
  "api",
  "jwt",
  "rbac",
  "ui",
  "ux",
  "db",
  "pr",
  "fe",
  "be",
  "sag",
  "bff",
  "url",
  "json",
  "sql",
  "llm",
  "acl",
  "csrf",
  "uuid",
  "http",
  "https",
  "rest",
  "crud",
  "sse",
]);

const VIETNAMESE_NGANG_SYLLABLE_REGEX =
  /^(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnpqrstvx])?(?:uy|ua|uo|ia|iu|ie|eo|ao|au|ay|ai|oi|ui|oa|oe|[aeiouy])(?:ng|nh|[mn])?$/i;

const ENGLISH_VOWEL_CLUSTER_REGEX = /(?:ee|ea|oo|aw|ow|ew|ou)/i;

type WordLangClassification = "vi" | "en" | "ambiguous" | "neutral";

function classifyWordToken(rawToken: string): WordLangClassification {
  const core = rawToken.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!core || !/\p{L}/u.test(core)) {
    return "neutral";
  }

  if (VIETNAMESE_DIACRITIC_REGEX.test(core)) {
    return "vi";
  }

  // Hyphenated technical identifiers (e.g. WDP301-SPRING-2027, ai-chat) or alphanumeric tokens (OAuth2, HS256)
  if (/[-_/]/.test(core) || (/\p{L}/u.test(core) && /\d/.test(core))) {
    return "en";
  }

  // CamelCase or ALL-CAPS acronyms (2+ letters like API, JWT, MIND, MAP)
  if (
    /[a-z][A-Z]/.test(core) ||
    (core.length >= 2 &&
      core === core.toUpperCase() &&
      !VIETNAMESE_EXCLUSIVE_ASCII_WORDS.has(core.toLowerCase()))
  ) {
    return "en";
  }

  const lower = core.toLowerCase();
  if (ENGLISH_CERTAIN_WORDS.has(lower)) {
    return "en";
  }
  if (VIETNAMESE_EXCLUSIVE_ASCII_WORDS.has(lower)) {
    return "vi";
  }

  if (
    !ENGLISH_VOWEL_CLUSTER_REGEX.test(lower) &&
    VIETNAMESE_NGANG_SYLLABLE_REGEX.test(lower)
  ) {
    return "ambiguous";
  }

  return "en";
}

export function detectAnswerSpeechLang(
  content: string,
  fallbackLocale: string,
): "vi" | "en" {
  const tokens = content.trim().split(/\s+/).filter(Boolean);
  let viScore = 0;
  let enScore = 0;
  let wordCount = 0;

  for (const token of tokens) {
    const kind = classifyWordToken(token);
    if (kind === "neutral") continue;
    wordCount += 1;
    if (kind === "vi") {
      viScore += 1;
    } else if (kind === "en") {
      enScore += 1;
    }
  }

  if (wordCount === 0) {
    return fallbackLocale.toLowerCase().startsWith("vi") ? "vi" : "en";
  }

  if (viScore === 0) {
    return "en";
  }

  // If the text is overwhelmingly English and only contains a few Vietnamese proper nouns (< 22% of words)
  if (enScore > viScore * 2.5 && viScore / wordCount < 0.22) {
    return "en";
  }

  return "vi";
}

export function stripAnswerToPlainSpeechText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(
      /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/gm,
      " ",
    )
    .replace(/\|/g, ", ")
    .replace(/^#{1,6}\s+(.+?)\s*$/gm, (_match, heading: string) =>
      /[.!?:;]$/.test(heading) ? `${heading} ` : `${heading}. `,
    )
    .replace(/^\s*>\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(?:\d+|S\d+)(?:\s*,\s*(?:\d+|S\d+))*\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      " ",
    )
    .replace(/\b[0-9a-f]{24}\b/gi, " ")
    .replace(/\s*(?:->|=>|<-|→|↔)\s*/g, ", ")
    .replace(/([.!?:;])\s*,+/g, "$1 ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\.\s*\.+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_SPEECH_SEGMENT_CHARS = 220;

function splitLongSingleLangSegment(
  text: string,
  lang: "vi" | "en",
): SpeechSegment[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= MAX_SPEECH_SEGMENT_CHARS) {
    return [{ text: trimmed, lang }];
  }

  const clauses = trimmed.split(/(?<=[.!?;:,])\s+/);
  const result: SpeechSegment[] = [];
  let buffer = "";

  for (const clause of clauses) {
    if (!clause) continue;
    if (!buffer) {
      buffer = clause;
      continue;
    }
    if (buffer.length + 1 + clause.length <= MAX_SPEECH_SEGMENT_CHARS) {
      buffer = `${buffer} ${clause}`;
    } else {
      result.push({ text: buffer, lang });
      buffer = clause;
    }
  }

  if (buffer) {
    result.push({ text: buffer, lang });
  }

  return result;
}

export function splitAnswerSpeechSegments(
  rawContent: string,
  fallbackLocale: string,
): readonly SpeechSegment[] {
  const plainText = stripAnswerToPlainSpeechText(rawContent);
  if (!plainText) {
    return [];
  }

  const defaultLang = detectAnswerSpeechLang(plainText, fallbackLocale);
  const tokens = plainText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const rawKinds = tokens.map((token) => classifyWordToken(token));
  const hasAnyVi = rawKinds.some((k) => k === "vi");
  const hasAnyEn = rawKinds.some((k) => k === "en");

  // Fast path: if the text has no Vietnamese tokens at all, or no English tokens at all
  if (!hasAnyVi) {
    return splitLongSingleLangSegment(
      plainText,
      hasAnyEn ? "en" : defaultLang,
    );
  }
  if (!hasAnyEn) {
    return splitLongSingleLangSegment(plainText, "vi");
  }

  // Pass 1: Resolve "ambiguous" tokens using nearest definite ("vi" | "en") neighbors
  const resolved: Array<"vi" | "en" | "neutral"> = rawKinds.map((kind, idx) => {
    if (kind === "vi" || kind === "en" || kind === "neutral") {
      return kind;
    }

    let prevDefinite: "vi" | "en" | null = null;
    for (let left = idx - 1; left >= 0; left -= 1) {
      const k = rawKinds[left];
      if (k === "vi" || k === "en") {
        prevDefinite = k;
        break;
      }
    }

    let nextDefinite: "vi" | "en" | null = null;
    for (let right = idx + 1; right < rawKinds.length; right += 1) {
      const k = rawKinds[right];
      if (k === "vi" || k === "en") {
        nextDefinite = k;
        break;
      }
    }

    if (prevDefinite && nextDefinite && prevDefinite === nextDefinite) {
      return prevDefinite;
    }
    if (prevDefinite === "vi" || nextDefinite === "vi") {
      return "vi";
    }
    return prevDefinite ?? nextDefinite ?? defaultLang;
  });

  // Pass 2: Resolve "neutral" tokens (numbers, symbols) to attach to surrounding run
  const finalLangs: Array<"vi" | "en"> = resolved.map((kind, idx) => {
    if (kind === "vi" || kind === "en") {
      return kind;
    }
    for (let left = idx - 1; left >= 0; left -= 1) {
      const k = resolved[left];
      if (k === "vi" || k === "en") return k;
    }
    for (let right = idx + 1; right < resolved.length; right += 1) {
      const k = resolved[right];
      if (k === "vi" || k === "en") return k;
    }
    return defaultLang;
  });

  // Group contiguous runs of the same language
  const mergedRuns: Array<{ text: string; lang: "vi" | "en" }> = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const lang = finalLangs[i]!;
    const lastRun = mergedRuns[mergedRuns.length - 1];
    if (lastRun && lastRun.lang === lang) {
      lastRun.text = `${lastRun.text} ${token}`;
    } else {
      mergedRuns.push({ text: token, lang });
    }
  }

  const segments: SpeechSegment[] = [];
  for (const run of mergedRuns) {
    segments.push(...splitLongSingleLangSegment(run.text, run.lang));
  }

  return segments;
}

export const HIDDEN_SCOPE_PLACEHOLDER =
  "[Answer hidden because its evidence is unavailable in the current source scope.]";

export function isHiddenScopeMessage(content: string): boolean {
  return content.trim() === HIDDEN_SCOPE_PLACEHOLDER;
}

export function isPersistedMessageId(messageId: string): boolean {
  return Boolean(messageId) && !messageId.startsWith("local-");
}
