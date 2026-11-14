"use client";

import { create } from "zustand";

type ClientState = {
  activeProjectId: string | null;
  selectedProjectByOrg: Record<string, string>;
  setActiveProjectId: (projectId: string | null) => void;
  setSelectedProjectForOrg: (organizationId: string, projectId: string) => void;
};

export const useClientStateStore = create<ClientState>((set) => ({
  activeProjectId: null,
  selectedProjectByOrg: {},
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setSelectedProjectForOrg: (organizationId, projectId) =>
    set((state) => {
      if (
        !organizationId ||
        !projectId ||
        (state.selectedProjectByOrg[organizationId] === projectId &&
          state.activeProjectId === projectId)
      ) {
        return state;
      }
      return {
        activeProjectId: projectId,
        selectedProjectByOrg: {
          ...state.selectedProjectByOrg,
          [organizationId]: projectId,
        },
      };
    }),
}));
