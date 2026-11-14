import { beforeEach, describe, expect, it } from "vitest";
import { useClientStateStore } from "./client-state";

describe("client state store", () => {
  beforeEach(() => {
    useClientStateStore.setState({
      activeProjectId: null,
      selectedProjectByOrg: {},
    });
  });

  it("keeps only client-side project selection state", () => {
    useClientStateStore.getState().setActiveProjectId("project-1");

    expect(useClientStateStore.getState().activeProjectId).toBe("project-1");
  });

  it("remembers the selected project per organization without cross-org bleed", () => {
    useClientStateStore
      .getState()
      .setSelectedProjectForOrg("org-1", "project-a");
    useClientStateStore
      .getState()
      .setSelectedProjectForOrg("org-2", "project-b");

    expect(useClientStateStore.getState().selectedProjectByOrg).toEqual({
      "org-1": "project-a",
      "org-2": "project-b",
    });
    expect(useClientStateStore.getState().activeProjectId).toBe("project-b");
  });
});
