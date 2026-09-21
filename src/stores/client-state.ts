"use client";

import { create } from "zustand";

type ClientState = {
  activeProjectId: string | null;
  setActiveProjectId: (projectId: string | null) => void;
};

export const useClientStateStore = create<ClientState>((set) => ({
  activeProjectId: null,
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
}));
