import { beforeEach, describe, expect, it } from "vitest";
import { useFloatingChatStore } from "./floating-chat";

describe("useFloatingChatStore", () => {
  beforeEach(() => {
    useFloatingChatStore.getState().reset();
  });

  it("toggles launcher per organization and closes launcher when opening a conversation", () => {
    const store = useFloatingChatStore.getState();
    store.toggleLauncher("org-1");
    expect(useFloatingChatStore.getState().launcherOrgId).toBe("org-1");

    store.openConversation("org-1", "conv-1", { messageId: "msg-99" });
    const next = useFloatingChatStore.getState();
    expect(next.launcherOrgId).toBeNull();
    expect(next.openWindowsByOrg["org-1"]).toEqual(["conv-1"]);
    expect(next.highlightedMessageByConv["conv-1"]).toBe("msg-99");
  });

  it("keeps up to 2 open windows and overflows the oldest open window into minimized chat heads", () => {
    const store = useFloatingChatStore.getState();
    store.openConversation("org-1", "conv-1");
    store.openConversation("org-1", "conv-2");
    expect(useFloatingChatStore.getState().openWindowsByOrg["org-1"]).toEqual([
      "conv-2",
      "conv-1",
    ]);
    expect(
      useFloatingChatStore.getState().minimizedHeadsByOrg["org-1"],
    ).toEqual([]);

    store.openConversation("org-1", "conv-3");
    expect(useFloatingChatStore.getState().openWindowsByOrg["org-1"]).toEqual([
      "conv-3",
      "conv-2",
    ]);
    expect(
      useFloatingChatStore.getState().minimizedHeadsByOrg["org-1"],
    ).toEqual(["conv-1"]);
  });

  it("minimizes an open window to a chat head, restores it on click, and dismisses chat heads cleanly", () => {
    const store = useFloatingChatStore.getState();
    store.openConversation("org-1", "conv-a");
    store.minimizeWindow("org-1", "conv-a");

    expect(useFloatingChatStore.getState().openWindowsByOrg["org-1"]).toEqual(
      [],
    );
    expect(
      useFloatingChatStore.getState().minimizedHeadsByOrg["org-1"],
    ).toEqual(["conv-a"]);

    store.openConversation("org-1", "conv-a");
    expect(useFloatingChatStore.getState().openWindowsByOrg["org-1"]).toEqual([
      "conv-a",
    ]);
    expect(
      useFloatingChatStore.getState().minimizedHeadsByOrg["org-1"],
    ).toEqual([]);

    store.minimizeWindow("org-1", "conv-a");
    store.closeHead("org-1", "conv-a");
    expect(
      useFloatingChatStore.getState().minimizedHeadsByOrg["org-1"],
    ).toEqual([]);
  });

  it("isolates open windows and chat heads across organizations", () => {
    const store = useFloatingChatStore.getState();
    store.openConversation("org-1", "conv-1");
    store.openConversation("org-2", "conv-2");

    expect(useFloatingChatStore.getState().openWindowsByOrg["org-1"]).toEqual([
      "conv-1",
    ]);
    expect(useFloatingChatStore.getState().openWindowsByOrg["org-2"]).toEqual([
      "conv-2",
    ]);
  });

  it("closes active window and re-opens launcher when navigating back to conversations", () => {
    const store = useFloatingChatStore.getState();
    store.openConversation("org-1", "conv-1", { messageId: "msg-1" });
    expect(useFloatingChatStore.getState().launcherOrgId).toBeNull();

    store.backToLauncher("org-1", "conv-1");
    const next = useFloatingChatStore.getState();
    expect(next.openWindowsByOrg["org-1"]).toEqual([]);
    expect(next.launcherOrgId).toBe("org-1");
    expect(next.highlightedMessageByConv["conv-1"]).toBeUndefined();
  });
});

