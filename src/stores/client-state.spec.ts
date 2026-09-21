import { beforeEach, describe, expect, it } from "vitest";
import { useClientStateStore } from "./client-state";

describe("client state store", () => {
  beforeEach(() => {
    useClientStateStore.setState({ activeProjectId: null });
  });

  it("keeps only client-side project selection state", () => {
    useClientStateStore.getState().setActiveProjectId("project-1");

    expect(useClientStateStore.getState().activeProjectId).toBe("project-1");
  });
});
