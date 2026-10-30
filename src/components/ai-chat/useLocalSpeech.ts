"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  detectAnswerSpeechLang,
  selectLocalVoice,
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
      const localVoice = selectLocalVoice(voices, preferredLang);
      if (!localVoice) {
        setPreparingMessageId(null);
        setSpeechError({ messageId, kind: "unavailable" });
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.voice = localVoice;
        utterance.lang = localVoice.lang;

        utterance.onstart = () => {
          if (requestIdRef.current !== currentRequestId) return;
          setPreparingMessageId(null);
          setSpeakingMessageId(messageId);
        };
        utterance.onend = () => {
          if (requestIdRef.current !== currentRequestId) return;
          setPreparingMessageId(null);
          setSpeakingMessageId(null);
        };
        utterance.onerror = (event) => {
          if (requestIdRef.current !== currentRequestId) return;
          setPreparingMessageId(null);
          setSpeakingMessageId(null);
          if (event.error !== "canceled" && event.error !== "interrupted") {
            setSpeechError({ messageId, kind: "failed" });
          }
        };

        setPreparingMessageId(null);
        setSpeakingMessageId(messageId);
        synth.speak(utterance);
      } catch {
        setPreparingMessageId(null);
        setSpeakingMessageId(null);
        setSpeechError({ messageId, kind: "failed" });
      }
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
