import { create } from "zustand";

export const useChatNavigation = create<{
  target: { conversationId: string; messageId: string } | null;
  open: (conversationId: string, messageId: string) => void;
  clear: () => void;
}>((set) => ({
  target: null,
  open: (conversationId, messageId) =>
    set({ target: { conversationId, messageId } }),
  clear: () => set({ target: null }),
}));
