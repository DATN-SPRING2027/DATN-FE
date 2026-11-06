"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectAnswerSpeechLang,
  selectLocalVoice,
  splitAnswerSpeechSegments,
  stripAnswerToPlainSpeechText,
} from "./answer-action-utils";

export type LocalSpeechErrorKind = "unavailable" | "failed";

export interface LocalSpeechErrorState {
  readonly messageId: string;
  readonly kind: LocalSpeechErrorKind;
}

async function resolveVoicesWithFallback(
  synth: SpeechSynthesis,
  registerCleanup: (cleanup: (() => void) | null) => void,
): Promise<readonly SpeechSynthesisVoice[]> {
  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    return immediate;
  }

  return new Promise<readonly SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    let timerId: number | null = null;
    const teardown = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
      registerCleanup(null);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      teardown();
      resolve(synth.getVoices());
    };
    const cancelPending = () => {
      if (settled) return;
      settled = true;
      teardown();
      resolve([]);
    };
    const handleVoicesChanged = () => finish();
    registerCleanup(cancelPending);
    synth.addEventListener?.("voiceschanged", handleVoicesChanged);
    timerId = window.setTimeout(finish, 450);
  });
}

export function useLocalSpeech(locale: string) {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );
  const [preparingMessageId, setPreparingMessageId] = useState<string | null>(
    null,
  );
  const [speechError, setSpeechError] = useState<LocalSpeechErrorState | null>(
    null,
  );
  const requestIdRef = useRef(0);
  const pendingVoiceCleanupRef = useRef<(() => void) | null>(null);

  const stopSpeech = useCallback(() => {
    requestIdRef.current += 1;
    pendingVoiceCleanupRef.current?.();
    pendingVoiceCleanupRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser synthesis teardown errors.
      }
    }
    setSpeakingMessageId(null);
    setPreparingMessageId(null);
  }, []);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      pendingVoiceCleanupRef.current?.();
      pendingVoiceCleanupRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore teardown errors.
        }
      }
    };
  }, []);

  const toggleSpeak = useCallback(
    async (messageId: string, rawContent: string) => {
      if (
        speakingMessageId === messageId ||
        preparingMessageId === messageId
      ) {
        stopSpeech();
        return;
      }

      stopSpeech();
      setSpeechError(null);

      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        typeof SpeechSynthesisUtterance === "undefined"
      ) {
        setSpeechError({ messageId, kind: "unavailable" });
        return;
      }

      const plainText = stripAnswerToPlainSpeechText(rawContent);
      if (!plainText) {
        return;
      }

      const currentRequestId = requestIdRef.current + 1;
      requestIdRef.current = currentRequestId;
      setPreparingMessageId(messageId);

      const synth = window.speechSynthesis;
      const voices = await resolveVoicesWithFallback(synth, (cleanup) => {
        pendingVoiceCleanupRef.current = cleanup;
      });
      if (requestIdRef.current !== currentRequestId) {
        return;
      }

      const preferredLang = detectAnswerSpeechLang(plainText, locale);
      const viVoice = selectLocalVoice(voices, "vi");
      const enVoice = selectLocalVoice(voices, "en");
      const viOfflineVoice = selectLocalVoice(voices, "vi", {
        localOnly: true,
      });
      const enOfflineVoice = selectLocalVoice(voices, "en", {
        localOnly: true,
      });
      const primaryVoice = preferredLang === "vi" ? viVoice : enVoice;

      if (!primaryVoice) {
        setPreparingMessageId(null);
        setSpeechError({ messageId, kind: "unavailable" });
        return;
      }

      const segments = splitAnswerSpeechSegments(rawContent, locale);
      const activeSegments =
        segments.length > 0
          ? segments
          : [{ text: plainText, lang: preferredLang }];

      const speakSegmentAt = (index: number, forceOfflineFallback: boolean) => {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        const segment = activeSegments[index];
        if (!segment) {
          setPreparingMessageId(null);
          setSpeakingMessageId(null);
          return;
        }

        const targetVoice = forceOfflineFallback
          ? segment.lang === "vi"
            ? viOfflineVoice
            : enOfflineVoice
          : segment.lang === "vi"
            ? viVoice
            : enVoice;

        try {
          const utterance = new SpeechSynthesisUtterance(segment.text);
          if (targetVoice) {
            utterance.voice = targetVoice;
            utterance.lang =
              targetVoice.lang || (segment.lang === "vi" ? "vi-VN" : "en-US");
          } else {
            utterance.lang = segment.lang === "vi" ? "vi-VN" : "en-US";
          }

          utterance.onstart = () => {
            if (requestIdRef.current !== currentRequestId) return;
            setPreparingMessageId(null);
            setSpeakingMessageId(messageId);
          };
          utterance.onend = () => {
            if (requestIdRef.current !== currentRequestId) return;
            if (index + 1 < activeSegments.length) {
              speakSegmentAt(index + 1, false);
              return;
            }
            setPreparingMessageId(null);
            setSpeakingMessageId(null);
          };
          utterance.onerror = (event) => {
            if (requestIdRef.current !== currentRequestId) return;
            if (event.error === "canceled" || event.error === "interrupted") {
              setPreparingMessageId(null);
              setSpeakingMessageId(null);
              return;
            }
            const offlineCandidate =
              segment.lang === "vi" ? viOfflineVoice : enOfflineVoice;
            if (
              !forceOfflineFallback &&
              targetVoice &&
              !targetVoice.localService &&
              offlineCandidate
            ) {
              speakSegmentAt(index, true);
              return;
            }
            setPreparingMessageId(null);
            setSpeakingMessageId(null);
            setSpeechError({ messageId, kind: "failed" });
          };

          setPreparingMessageId(null);
          setSpeakingMessageId(messageId);
          synth.speak(utterance);
        } catch {
          setPreparingMessageId(null);
          setSpeakingMessageId(null);
          setSpeechError({ messageId, kind: "failed" });
        }
      };

      speakSegmentAt(0, false);
    },
    [locale, preparingMessageId, speakingMessageId, stopSpeech],
  );

  return {
    speakingMessageId,
    preparingMessageId,
    speechError,
    clearSpeechError: () => setSpeechError(null),
    stopSpeech,
    toggleSpeak,
  };
}
