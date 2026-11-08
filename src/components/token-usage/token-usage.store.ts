"use client";

import { create } from "zustand";
import type { AiTokenUsageScope } from "@/lib/queries/token-usage/useTokenUsage";

interface TokenUsageModalState {
  isOpen: boolean;
  initialScope?: AiTokenUsageScope;
  initialProjectId?: string | null;
  openModal: (options?: {
    scope?: AiTokenUsageScope;
    projectId?: string | null;
  }) => void;
  closeModal: () => void;
}

export const useTokenUsageModalStore = create<TokenUsageModalState>((set) => ({
  isOpen: false,
  initialScope: undefined,
  initialProjectId: null,
  openModal: (options) =>
    set({
      isOpen: true,
      initialScope: options?.scope,
      initialProjectId: options?.projectId ?? null,
    }),
  closeModal: () => set({ isOpen: false }),
}));
