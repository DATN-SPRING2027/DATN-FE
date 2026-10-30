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
): Promise<readonly SpeechSynthesisVoice[]> {
  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    return immediate;
  }

  return new Promise<readonly SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
      resolve(synth.getVoices());
    };
    const handleVoicesChanged = () => finish();
    synth.addEventListener?.("voiceschanged", handleVoicesChanged);
    window.setTimeout(finish, 450);
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

  const stopSpeech = useCallback(() => {
    requestIdRef.current += 1;
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
      const voices = await resolveVoicesWithFallback(synth);
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
