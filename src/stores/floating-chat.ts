import { create } from "zustand";

export const MAX_OPEN_CHAT_WINDOWS = 2;
export const MAX_MINIMIZED_CHAT_HEADS = 5;
export const EMPTY_CHAT_IDS: readonly string[] = [];

type OpenConversationOptions = Readonly<{
  messageId?: string;
  maxOpen?: number;
}>;

export type FloatingChatState = Readonly<{
  activeOrgId: string | null;
  launcherOrgId: string | null;
  openWindowsByOrg: Readonly<Record<string, readonly string[]>>;
  minimizedHeadsByOrg: Readonly<Record<string, readonly string[]>>;
  highlightedMessageByConv: Readonly<Record<string, string>>;
  setActiveOrg: (organizationId: string | null) => void;
  toggleLauncher: (organizationId: string) => void;
  openLauncher: (organizationId: string) => void;
  closeLauncher: () => void;
  openConversation: (
    organizationId: string,
    conversationId: string,
    options?: OpenConversationOptions,
  ) => void;
  minimizeWindow: (organizationId: string, conversationId: string) => void;
  backToLauncher: (organizationId: string, conversationId: string) => void;
  closeWindow: (organizationId: string, conversationId: string) => void;
  closeHead: (organizationId: string, conversationId: string) => void;
  removeConversation: (organizationId: string, conversationId: string) => void;
  clearHighlight: (conversationId: string) => void;
  reset: () => void;
}>;

export const useFloatingChatStore = create<FloatingChatState>((set) => ({
  activeOrgId: null,
  launcherOrgId: null,
  openWindowsByOrg: {},
  minimizedHeadsByOrg: {},
  highlightedMessageByConv: {},

  setActiveOrg: (organizationId) =>
    set((state) =>
      state.activeOrgId === organizationId
        ? state
        : { activeOrgId: organizationId },
    ),

  toggleLauncher: (organizationId) =>
    set((state) => ({
      activeOrgId: organizationId,
      launcherOrgId:
        state.launcherOrgId === organizationId ? null : organizationId,
    })),

  openLauncher: (organizationId) =>
    set({
      activeOrgId: organizationId,
      launcherOrgId: organizationId,
    }),

  closeLauncher: () =>
    set((state) =>
      state.launcherOrgId === null ? state : { launcherOrgId: null },
    ),

  openConversation: (organizationId, conversationId, options) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const maxOpen = Math.max(1, options?.maxOpen ?? MAX_OPEN_CHAT_WINDOWS);
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const currentHeads =
        state.minimizedHeadsByOrg[organizationId] ?? EMPTY_CHAT_IDS;

      const withoutTarget = currentOpen.filter((id) => id !== conversationId);
      const nextOpen = [conversationId, ...withoutTarget];
      const overflow = nextOpen.slice(maxOpen);
      const trimmedOpen = nextOpen.slice(0, maxOpen);

      const nextHeads = [
        ...overflow,
        ...currentHeads.filter(
          (id) => id !== conversationId && !trimmedOpen.includes(id),
        ),
      ].slice(0, MAX_MINIMIZED_CHAT_HEADS);

      const nextHighlights = options?.messageId
        ? {
            ...state.highlightedMessageByConv,
            [conversationId]: options.messageId,
          }
        : state.highlightedMessageByConv;

      return {
        activeOrgId: organizationId,
        launcherOrgId: null,
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: trimmedOpen,
        },
        minimizedHeadsByOrg: {
          ...state.minimizedHeadsByOrg,
          [organizationId]: nextHeads,
        },
        highlightedMessageByConv: nextHighlights,
      };
    }),

  minimizeWindow: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const currentHeads =
        state.minimizedHeadsByOrg[organizationId] ?? EMPTY_CHAT_IDS;

      const nextOpen = currentOpen.filter((id) => id !== conversationId);
      const nextHeads = [
        conversationId,
        ...currentHeads.filter((id) => id !== conversationId),
      ].slice(0, MAX_MINIMIZED_CHAT_HEADS);

      return {
        activeOrgId: organizationId,
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: nextOpen,
        },
        minimizedHeadsByOrg: {
          ...state.minimizedHeadsByOrg,
          [organizationId]: nextHeads,
        },
      };
    }),

  backToLauncher: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      return {
        activeOrgId: organizationId,
        launcherOrgId: organizationId,
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: currentOpen.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
      };
    }),

  closeWindow: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      return {
        activeOrgId: organizationId,
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: currentOpen.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
      };
    }),

  closeHead: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentHeads =
        state.minimizedHeadsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      return {
        activeOrgId: organizationId,
        minimizedHeadsByOrg: {
          ...state.minimizedHeadsByOrg,
          [organizationId]: currentHeads.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
      };
    }),

  removeConversation: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const currentHeads =
        state.minimizedHeadsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      return {
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: currentOpen.filter((id) => id !== conversationId),
        },
        minimizedHeadsByOrg: {
          ...state.minimizedHeadsByOrg,
          [organizationId]: currentHeads.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
      };
    }),

  clearHighlight: (conversationId) =>
    set((state) => {
      if (!(conversationId in state.highlightedMessageByConv)) return state;
      const next = { ...state.highlightedMessageByConv };
      delete next[conversationId];
      return { highlightedMessageByConv: next };
    }),

  reset: () =>
    set({
      activeOrgId: null,
      launcherOrgId: null,
      openWindowsByOrg: {},
      minimizedHeadsByOrg: {},
      highlightedMessageByConv: {},
    }),
}));
