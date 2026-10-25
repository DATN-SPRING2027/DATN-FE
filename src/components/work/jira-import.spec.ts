import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProjectTaskApi,
  fetchProjectTasks,
  type BackendTaskDetail,
} from "@/lib/queries/tasks/useTasks";
import { importJiraRows, parseJiraImportCsv } from "./jira-import";

vi.mock("@/lib/queries/tasks/useTasks", () => ({
  createProjectTaskApi: vi.fn(),
  fetchProjectTaskDetail: vi.fn(),
  fetchProjectTasks: vi.fn(),
  transitionProjectTaskApi: vi.fn(),
}));

const projectId = "6addb47a601e4bc926ed43a0";
const header =
  "target_project_id,jira_key,title,description,status,priority,issue_type,parent_key,source_url";
const row = (description: string, status = "Done") =>
  [
    projectId,
    "DATN-64",
    '"[DATN-64] Evidence, ""quotes"" and details"',
    description,
    status,
    "Medium",
    "Task",
    "",
    "https://trankimthang0207.atlassian.net/browse/DATN-64",
  ].join(",");

const createdTask: BackendTaskDetail = {
  id: "507f1f77bcf86cd799439011",
  projectId,
  key: "BE-1",
  title: "[DATN-64] Evidence, \"quotes\" and details",
  type: "TASK",
  status: "TODO",
  priority: "MEDIUM",
  assigneeId: null,
  createdBy: "507f1f77bcf86cd799439012",
  parentId: null,
  sprintId: null,
  labels: [],
  subtaskCounts: { total: 0, done: 0 },
  dueDate: null,
  startDate: null,
  createdAt: "2026-10-25T00:00:00.000Z",
  updatedAt: "2026-10-25T00:00:00.000Z",
  version: 1,
  description: null,
  steps: [],
  completedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchProjectTasks).mockResolvedValue({
    items: [],
    nextAfterId: null,
    nextCursor: null,
  });
  vi.mocked(createProjectTaskApi).mockResolvedValue(createdTask);
});

describe("parseJiraImportCsv", () => {
  it("parses quoted commas, escaped quotes, and multiline descriptions", () => {
    const parsed = parseJiraImportCsv(
      `${header}\r\n${row('"line one\nline two, with commas"')}`,
      projectId,
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toContain('"quotes"');
    expect(parsed[0].description).toBe("line one\nline two, with commas");
  });

  it("rejects malformed quote boundaries", () => {
    expect(() =>
      parseJiraImportCsv(`${header}\n${row('"details"unexpected')}`, projectId),
    ).toThrow(/unexpected characters after a quoted field/i);
  });

  it("rejects rows routed to another project and duplicate Jira keys", () => {
    expect(() =>
      parseJiraImportCsv(
        `${header}\n${row('"Jira source: https://trankimthang0207.atlassian.net/browse/DATN-64"')}`,
        "6addb47a601e4bc926ed43a1",
      ),
    ).toThrow(/another Project/i);
    const valid = row(
      '"Jira source: https://trankimthang0207.atlassian.net/browse/DATN-64"',
    );
    expect(() =>
      parseJiraImportCsv(`${header}\n${valid}\n${valid}`, projectId),
    ).toThrow(/Duplicate Jira key/);
  });

  it("strips Jira descriptions when importing into a public Project", async () => {
    const rows = parseJiraImportCsv(
      `${header}\n${row('"Internal details must stay private"', "To Do")}`,
      projectId,
    );

    await importJiraRows(projectId, rows, "PUBLIC", () => undefined);

    expect(createProjectTaskApi).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({
        title: '[DATN-64] Evidence, "quotes" and details',
        description:
          "Jira source: https://trankimthang0207.atlassian.net/browse/DATN-64",
        priority: "MEDIUM",
        labels: [],
      }),
      `jira-import:${projectId}:DATN-64`,
    );
  });

  it("preserves Jira descriptions when importing into a private Project", async () => {
    const rows = parseJiraImportCsv(
      `${header}\n${row('"Full implementation details"', "To Do")}`,
      projectId,
    );

    await importJiraRows(projectId, rows, "PRIVATE", () => undefined);

    expect(createProjectTaskApi).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({
        description: "Full implementation details",
        priority: "MEDIUM",
        labels: ["jira-import", "DATN-64"],
      }),
      `jira-import:${projectId}:DATN-64`,
    );
  });

  it("fails closed when Project visibility is unavailable", async () => {
    const rows = parseJiraImportCsv(
      `${header}\n${row('"Internal details must stay private"', "To Do")}`,
      projectId,
    );

    await expect(
      importJiraRows(projectId, rows, undefined, () => undefined),
    ).rejects.toThrow(/visibility could not be verified/i);
    expect(fetchProjectTasks).not.toHaveBeenCalled();
    expect(createProjectTaskApi).not.toHaveBeenCalled();
  });
});
