import { create } from "zustand";

export const MAX_OPEN_CHAT_WINDOWS = 2;
export const MAX_MINIMIZED_CHAT_HEADS = 5;
export const TWO_WINDOW_MIN_VIEWPORT_PX = 1024;
export const EMPTY_CHAT_IDS: readonly string[] = [];

export function resolveMaxOpenChatWindows(viewportWidth?: number): number {
  const width =
    viewportWidth ??
    (typeof window !== "undefined" && window.innerWidth > 0
      ? window.innerWidth
      : TWO_WINDOW_MIN_VIEWPORT_PX);
  return width < TWO_WINDOW_MIN_VIEWPORT_PX ? 1 : MAX_OPEN_CHAT_WINDOWS;
}

type OpenConversationOptions = Readonly<{
  messageId?: string;
  maxOpen?: number;
}>;

export type FloatingChatState = Readonly<{
  activeOrgId: string | null;
  launcherOrgId: string | null;
  realtimeOwner: string | null;
  realtimeConnectedOwner: string | null;
  openWindowsByOrg: Readonly<Record<string, readonly string[]>>;
  minimizedHeadsByOrg: Readonly<Record<string, readonly string[]>>;
  highlightedMessageByConv: Readonly<Record<string, string>>;
  contextMessageByConv: Readonly<Record<string, string>>;
  setActiveOrg: (organizationId: string | null) => void;
  setRealtimeOwner: (owner: string | null) => void;
  setRealtimeConnectedOwner: (owner: string | null) => void;
  toggleLauncher: (organizationId: string) => void;
  openLauncher: (organizationId: string) => void;
  closeLauncher: () => void;
  openConversation: (
    organizationId: string,
    conversationId: string,
    options?: OpenConversationOptions,
  ) => void;
  clampOpenWindows: (organizationId: string, maxOpen: number) => void;
  minimizeWindow: (organizationId: string, conversationId: string) => void;
  backToLauncher: (organizationId: string, conversationId: string) => void;
  closeWindow: (organizationId: string, conversationId: string) => void;
  closeHead: (organizationId: string, conversationId: string) => void;
  removeConversation: (organizationId: string, conversationId: string) => void;
  focusMessageContext: (conversationId: string, messageId: string) => void;
  clearContextMessage: (conversationId: string) => void;
  clearHighlight: (conversationId: string) => void;
  reset: () => void;
}>;

export const useFloatingChatStore = create<FloatingChatState>((set) => ({
  activeOrgId: null,
  launcherOrgId: null,
  realtimeOwner: null,
  realtimeConnectedOwner: null,
  openWindowsByOrg: {},
  minimizedHeadsByOrg: {},
  highlightedMessageByConv: {},
  contextMessageByConv: {},

  setActiveOrg: (organizationId) =>
    set((state) =>
      state.activeOrgId === organizationId
        ? state
        : { activeOrgId: organizationId },
    ),

  setRealtimeOwner: (owner) =>
    set((state) =>
      state.realtimeOwner === owner
        ? state
        : {
            realtimeOwner: owner,
            realtimeConnectedOwner:
              owner === null ? null : state.realtimeConnectedOwner,
          },
    ),

  setRealtimeConnectedOwner: (owner) =>
    set((state) =>
      state.realtimeConnectedOwner === owner
        ? state
        : { realtimeConnectedOwner: owner },
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

      const nextContexts = options?.messageId
        ? {
            ...state.contextMessageByConv,
            [conversationId]: options.messageId,
          }
        : state.contextMessageByConv;

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
        contextMessageByConv: nextContexts,
      };
    }),

  clampOpenWindows: (organizationId, maxOpen) =>
    set((state) => {
      if (!organizationId) return state;
      const limit = Math.max(1, maxOpen);
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      if (currentOpen.length <= limit) return state;

      const trimmedOpen = currentOpen.slice(0, limit);
      const overflow = currentOpen.slice(limit);
      const currentHeads =
        state.minimizedHeadsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHeads = [
        ...overflow,
        ...currentHeads.filter(
          (id) => !trimmedOpen.includes(id) && !overflow.includes(id),
        ),
      ].slice(0, MAX_MINIMIZED_CHAT_HEADS);

      return {
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: trimmedOpen,
        },
        minimizedHeadsByOrg: {
          ...state.minimizedHeadsByOrg,
          [organizationId]: nextHeads,
        },
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

      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      const nextContexts = { ...state.contextMessageByConv };
      delete nextContexts[conversationId];

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
        highlightedMessageByConv: nextHighlights,
        contextMessageByConv: nextContexts,
      };
    }),

  backToLauncher: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      const nextContexts = { ...state.contextMessageByConv };
      delete nextContexts[conversationId];
      return {
        activeOrgId: organizationId,
        launcherOrgId: organizationId,
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: currentOpen.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
        contextMessageByConv: nextContexts,
      };
    }),

  closeWindow: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentOpen = state.openWindowsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      const nextContexts = { ...state.contextMessageByConv };
      delete nextContexts[conversationId];
      return {
        activeOrgId: organizationId,
        openWindowsByOrg: {
          ...state.openWindowsByOrg,
          [organizationId]: currentOpen.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
        contextMessageByConv: nextContexts,
      };
    }),

  closeHead: (organizationId, conversationId) =>
    set((state) => {
      if (!organizationId || !conversationId) return state;
      const currentHeads =
        state.minimizedHeadsByOrg[organizationId] ?? EMPTY_CHAT_IDS;
      const nextHighlights = { ...state.highlightedMessageByConv };
      delete nextHighlights[conversationId];
      const nextContexts = { ...state.contextMessageByConv };
      delete nextContexts[conversationId];
      return {
        activeOrgId: organizationId,
        minimizedHeadsByOrg: {
          ...state.minimizedHeadsByOrg,
          [organizationId]: currentHeads.filter((id) => id !== conversationId),
        },
        highlightedMessageByConv: nextHighlights,
        contextMessageByConv: nextContexts,
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
      const nextContexts = { ...state.contextMessageByConv };
      delete nextContexts[conversationId];
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
        contextMessageByConv: nextContexts,
      };
    }),

  focusMessageContext: (conversationId, messageId) =>
    set((state) => {
      if (!conversationId || !messageId) return state;
      return {
        highlightedMessageByConv: {
          ...state.highlightedMessageByConv,
          [conversationId]: messageId,
        },
        contextMessageByConv: {
          ...state.contextMessageByConv,
          [conversationId]: messageId,
        },
      };
    }),

  clearContextMessage: (conversationId) =>
    set((state) => {
      if (!(conversationId in state.contextMessageByConv)) return state;
      const next = { ...state.contextMessageByConv };
      delete next[conversationId];
      return { contextMessageByConv: next };
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
      realtimeOwner: null,
      realtimeConnectedOwner: null,
      openWindowsByOrg: {},
      minimizedHeadsByOrg: {},
      highlightedMessageByConv: {},
      contextMessageByConv: {},
    }),
}));
