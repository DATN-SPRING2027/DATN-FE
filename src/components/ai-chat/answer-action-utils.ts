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
}

export function selectLocalVoice<T extends LocalSpeechVoiceCandidate>(
  voices: readonly T[],
  preferredLang: string,
): T | undefined {
  const localVoices = voices.filter((voice) => voice.localService === true);
  if (localVoices.length === 0) {
    return undefined;
  }

  const normalizedPref = preferredLang
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const primarySubtag = normalizedPref.split("-")[0] ?? "";

  if (normalizedPref) {
    const exactMatch = localVoices.find(
      (voice) => voice.lang.toLowerCase().replace(/_/g, "-") === normalizedPref,
    );
    if (exactMatch) return exactMatch;
  }

  if (primarySubtag) {
    const subtagMatch = localVoices.find((voice) => {
      const normalizedVoiceLang = voice.lang.toLowerCase().replace(/_/g, "-");
      return (
        normalizedVoiceLang === primarySubtag ||
        normalizedVoiceLang.startsWith(`${primarySubtag}-`)
      );
    });
    if (subtagMatch) return subtagMatch;
  }

  return localVoices[0];
}

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function detectAnswerSpeechLang(
  content: string,
  fallbackLocale: string,
): "vi" | "en" {
  if (VIETNAMESE_DIACRITIC_REGEX.test(content)) {
    return "vi";
  }
  if (/[A-Za-z]/.test(content)) {
    return "en";
  }
  return fallbackLocale.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function stripAnswerToPlainSpeechText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(?:\d+|S\d+)(?:\s*,\s*(?:\d+|S\d+))*\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const HIDDEN_SCOPE_PLACEHOLDER =
  "[Answer hidden because its evidence is unavailable in the current source scope.]";

export function isHiddenScopeMessage(content: string): boolean {
  return content.trim() === HIDDEN_SCOPE_PLACEHOLDER;
}

export function isPersistedMessageId(messageId: string): boolean {
  return Boolean(messageId) && !messageId.startsWith("local-");
}
