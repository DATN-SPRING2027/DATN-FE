import { describe, expect, it } from "vitest";
import type { WorkItem } from "./work-types";
import {
  buildCanonicalTaskUrl,
  buildProjectWorkPath,
  extractProjectIdFromWorkPathname,
  isProjectWorkPathname,
  isWorkViewSlug,
  parseProjectWorkLocation,
  parseProjectWorkSlugs,
  resolveWorkRouteTarget,
  stripLegacyTaskSearchParams,
} from "./work-route";

const SAMPLE_ITEMS: readonly WorkItem[] = [
  {
    id: "6addb4e1601e4bc926ed4610",
    key: "GENERAL-1",
    title: "[DATN-1] Thảo luận đề tài đồ án",
    type: "TASK",
    assignee: { id: "u1", name: "KeyT", initials: "KT" },
    reporter: { id: "u1", name: "KeyT", initials: "KT" },
    priority: "MEDIUM",
    status: "DONE",
    resolution: "RESOLVED",
    createdAt: "2026-10-25T00:00:00.000Z",
    dueDate: null,
    projectName: "General",
    subtasks: { completed: 1, total: 1 },
    subtaskItems: [
      {
        id: "6addb4e1601e4bc926ed4611",
        key: "GENERAL-2",
        summary: "Chuẩn bị outline đề tài",
        done: true,
        status: "DONE",
        priority: "MEDIUM",
        assignee: { id: "u1", name: "KeyT", initials: "KT" },
        dueDate: null,
      },
    ],
  },
];

describe("work-route helpers", () => {
  const projectId = "6addb4e1601e4bc926ed4602";

  it("identifies known workspace view slugs and distinguishes task keys/IDs", () => {
    expect(isWorkViewSlug("list")).toBe(true);
    expect(isWorkViewSlug("BOARD")).toBe(true);
    expect(isWorkViewSlug("timeline")).toBe(true);
    expect(isWorkViewSlug("work-notes")).toBe(true);
    expect(isWorkViewSlug("GENERAL-1")).toBe(false);
    expect(isWorkViewSlug("6addb4e1601e4bc926ed4610")).toBe(false);
  });

  it("parses optional catch-all workSlug segments for views, modal tasks, and full-page tasks", () => {
    expect(parseProjectWorkSlugs(undefined)).toEqual({
      view: "list",
      mode: null,
      taskRef: null,
      subtaskRef: null,
      isLegacyQueryOrHash: false,
    });

    expect(parseProjectWorkSlugs(["board"])).toEqual({
      view: "board",
      mode: null,
      taskRef: null,
      subtaskRef: null,
      isLegacyQueryOrHash: false,
    });

    expect(parseProjectWorkSlugs(["list", "GENERAL-1"])).toEqual({
      view: "list",
      mode: "modal",
      taskRef: "GENERAL-1",
      subtaskRef: null,
      isLegacyQueryOrHash: false,
    });

    expect(parseProjectWorkSlugs(["board", "GENERAL-1", "GENERAL-2"])).toEqual({
      view: "board",
      mode: "modal",
      taskRef: "GENERAL-1",
      subtaskRef: "GENERAL-2",
      isLegacyQueryOrHash: false,
    });

    expect(parseProjectWorkSlugs(["GENERAL-1"])).toEqual({
      view: null,
      mode: "page",
      taskRef: "GENERAL-1",
      subtaskRef: null,
      isLegacyQueryOrHash: false,
    });

    expect(parseProjectWorkSlugs(["GENERAL-1", "GENERAL-2"])).toEqual({
      view: null,
      mode: "page",
      taskRef: "GENERAL-1",
      subtaskRef: "GENERAL-2",
      isLegacyQueryOrHash: false,
    });
  });

  it("parses full locations including legacy ?taskId= and #hash deep links", () => {
    expect(
      isProjectWorkPathname(`/projects/${projectId}/work/GENERAL-1`, projectId),
    ).toBe(true);
    expect(
      isProjectWorkPathname(`/projects/${projectId}/work-notes`, projectId),
    ).toBe(false);
    expect(
      extractProjectIdFromWorkPathname(`/vi/projects/${projectId}/work/board`),
    ).toBe(projectId);

    expect(
      parseProjectWorkLocation({
        pathname: `/projects/${projectId}/work`,
        projectId,
        search: "?taskId=6addb4e1601e4bc926ed4610",
      }),
    ).toEqual({
      isProjectWorkPath: true,
      view: "list",
      mode: "modal",
      taskRef: "6addb4e1601e4bc926ed4610",
      subtaskRef: null,
      isLegacyQueryOrHash: true,
    });

    expect(
      parseProjectWorkLocation({
        pathname: "/workspace",
        projectId,
        hash: "#GENERAL-2",
      }),
    ).toEqual({
      isProjectWorkPath: false,
      view: null,
      mode: "modal",
      taskRef: "GENERAL-2",
      subtaskRef: null,
      isLegacyQueryOrHash: true,
    });
  });

  it("builds canonical project work paths and copy-link URLs", () => {
    expect(buildProjectWorkPath({ projectId, view: "list", mode: null })).toBe(
      `/projects/${projectId}/work`,
    );
    expect(buildProjectWorkPath({ projectId, view: "board", mode: null })).toBe(
      `/projects/${projectId}/work/board`,
    );
    expect(
      buildProjectWorkPath({
        projectId,
        view: "list",
        mode: "modal",
        taskKeyOrId: "GENERAL-1",
      }),
    ).toBe(`/projects/${projectId}/work/list/GENERAL-1`);
    expect(
      buildProjectWorkPath({
        projectId,
        view: "board",
        mode: "modal",
        taskKeyOrId: "GENERAL-1",
        subtaskKeyOrId: "GENERAL-2",
      }),
    ).toBe(`/projects/${projectId}/work/board/GENERAL-1/GENERAL-2`);
    expect(
      buildProjectWorkPath({
        projectId,
        mode: "page",
        taskKeyOrId: "GENERAL-1",
      }),
    ).toBe(`/projects/${projectId}/work/GENERAL-1`);
    expect(
      buildProjectWorkPath({
        projectId,
        mode: "page",
        taskKeyOrId: "GENERAL-1",
        subtaskKeyOrId: "GENERAL-2",
      }),
    ).toBe(`/projects/${projectId}/work/GENERAL-1/GENERAL-2`);

    expect(
      buildCanonicalTaskUrl({
        origin: "http://localhost:3000",
        projectId,
        taskKeyOrId: "GENERAL-1",
      }),
    ).toBe(`http://localhost:3000/projects/${projectId}/work/GENERAL-1`);

    expect(
      buildCanonicalTaskUrl({
        origin: "http://localhost:3000",
        projectId,
        taskKeyOrId: "GENERAL-1",
        subtaskKeyOrId: "GENERAL-2",
      }),
    ).toBe(
      `http://localhost:3000/projects/${projectId}/work/GENERAL-1/GENERAL-2`,
    );

    expect(stripLegacyTaskSearchParams("?taskId=123&filter=mine")).toBe(
      "?filter=mine",
    );
    expect(stripLegacyTaskSearchParams("?taskId=123")).toBe("");
  });

  it("resolves tasks and subtasks by case-insensitive key or backend ObjectId", () => {
    const byKey = resolveWorkRouteTarget(SAMPLE_ITEMS, "general-1");
    expect(byKey.status).toBe("matched");
    if (byKey.status === "matched") {
      expect(byKey.item.key).toBe("GENERAL-1");
      expect(byKey.subtask).toBeNull();
    }

    const bySubtaskIdOnly = resolveWorkRouteTarget(
      SAMPLE_ITEMS,
      "6addb4e1601e4bc926ed4611",
    );
    expect(bySubtaskIdOnly.status).toBe("matched");
    if (bySubtaskIdOnly.status === "matched") {
      expect(bySubtaskIdOnly.item.key).toBe("GENERAL-1");
      expect(bySubtaskIdOnly.subtask?.key).toBe("GENERAL-2");
    }

    const byParentAndMissingSub = resolveWorkRouteTarget(
      SAMPLE_ITEMS,
      "GENERAL-1",
      "GENERAL-999",
    );
    expect(byParentAndMissingSub.status).toBe("matched");
    if (byParentAndMissingSub.status === "matched") {
      expect(byParentAndMissingSub.item.key).toBe("GENERAL-1");
      expect(byParentAndMissingSub.subtask).toBeNull();
      expect(byParentAndMissingSub.missingSubtask).toBe(true);
    }

    expect(resolveWorkRouteTarget(SAMPLE_ITEMS, "GENERAL-404")).toEqual({
      status: "not_found",
    });
  });
});
