import { describe, expect, it } from "vitest";
import {
  aggregateTokenUsage,
  formatCompactTokens,
  formatSharePercent,
} from "./token-usage-data";
import type { AiTokenUsageResponse } from "@/lib/queries/token-usage/useTokenUsage";

describe("token-usage-data aggregation & formatting", () => {
  const nowHourEpoch = Math.floor(Date.now() / 3_600_000);

  const mockResponse: AiTokenUsageResponse = {
    effectiveScope: "personal",
    availableScopes: ["personal"],
    ownerGroupKind: "project",
    selectedProjectId: null,
    actor: {
      id: "65f000000000000000000101",
      name: "Member One",
      role: "MEMBER",
    },
    projects: [
      {
        id: "65f0000000000000000000a1",
        name: "Continuum Core",
        code: "CORE",
        isLeader: false,
      },
      {
        id: "65f0000000000000000000b2",
        name: "Continuum Mobile",
        code: "MOB",
        isLeader: false,
      },
    ],
    owners: [
      {
        id: "65f0000000000000000000a1",
        name: "Continuum Core",
        code: "CORE",
        kind: "project",
      },
      {
        id: "65f0000000000000000000b2",
        name: "Continuum Mobile",
        code: "MOB",
        kind: "project",
      },
    ],
    tasks: [
      { id: "ai_chat", index: 0 },
      { id: "mind_map", index: 1 },
      { id: "knowledge_sync", index: 2 },
      { id: "note_assessment", index: 3 },
      { id: "note_rewrite", index: 4 },
    ],
    rows: [
      [nowHourEpoch - 2, 0, 0, 1200, 1800, 0, 600, 3],
      [nowHourEpoch - 1, 1, 2, 2000, 1000, 0, 500, 1],
    ],
    generatedAt: new Date().toISOString(),
  };

  it("aggregates totals, 5 AI tasks, owners, and 53x7 heatmap accurately without any monetary fields", () => {
    const agg = aggregateTokenUsage(mockResponse, "7d", null, null, "vi");

    expect(agg.totals.tokens).toBe(7100);
    expect(agg.totals.input).toBe(3200);
    expect(agg.totals.cacheRead).toBe(2800);
    expect(agg.totals.output).toBe(1100);
    expect(agg.totals.calls).toBe(4);
    expect(Math.round(agg.totals.cacheHitRate * 100)).toBe(47);

    expect(agg.tasksList).toHaveLength(5);
    expect(agg.tasksList[0]?.id).toBe("ai_chat");
    expect(agg.tasksList[0]?.tokens).toBe(3600);
    expect(agg.tasksList[1]?.id).toBe("knowledge_sync");
    expect(agg.tasksList[1]?.tokens).toBe(3500);

    expect(agg.heatmap.weeks).toHaveLength(53);
    expect(agg.heatmap.weeks[0]).toHaveLength(7);
    expect(agg.heatmap.lifetimeTokens).toBe(7100);
    expect(agg.heatmap.activeDays).toBeGreaterThanOrEqual(1);
  });

  it("filters accurately when focusing on a specific project or AI task", () => {
    const focusedByProject = aggregateTokenUsage(
      mockResponse,
      "7d",
      null,
      { kind: "owner", id: "65f0000000000000000000a1" },
      "vi",
    );
    expect(focusedByProject.totals.tokens).toBe(3600);
    expect(focusedByProject.totals.calls).toBe(3);

    const focusedByTask = aggregateTokenUsage(
      mockResponse,
      "7d",
      null,
      { kind: "task", id: "knowledge_sync" },
      "vi",
    );
    expect(focusedByTask.totals.tokens).toBe(3500);
    expect(focusedByTask.totals.calls).toBe(1);
  });

  it("formats compact token numbers and percentages cleanly", () => {
    expect(formatCompactTokens(0)).toBe("0");
    expect(formatCompactTokens(950)).toBe("950");
    expect(formatCompactTokens(14_500_000)).toBe("14.5M");
    expect(formatCompactTokens(101_000)).toBe("101K");
    expect(formatSharePercent(0.482)).toBe("48%");
    expect(formatSharePercent(0.004)).toBe("< 1%");
  });
});
