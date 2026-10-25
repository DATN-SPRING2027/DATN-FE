import {
  createProjectTaskApi,
  fetchProjectTaskDetail,
  fetchProjectTasks,
  transitionProjectTaskApi,
  type BackendTask,
  type BackendTaskStatus,
} from "@/lib/queries/tasks/useTasks";

export type JiraImportRow = Readonly<{
  target_project_id: string;
  jira_key: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  issue_type: string;
  parent_key: string;
  source_url: string;
}>;

export type JiraImportProgress = Readonly<{
  completed: number;
  total: number;
  created: number;
  existing: number;
  currentKey: string;
}>;

const HEADERS: readonly (keyof JiraImportRow)[] = [
  "target_project_id",
  "jira_key",
  "title",
  "description",
  "status",
  "priority",
  "issue_type",
  "parent_key",
  "source_url",
];
const OBJECT_ID = /^[a-f\d]{24}$/i;
const JIRA_KEY = /^DATN-\d+$/;
const SOURCE_URL =
  /^https:\/\/trankimthang0207\.atlassian\.net\/browse\/(DATN-\d+)$/;

function csvCells(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let quoteClosed = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        cell += char;
      }
    } else if (quoteClosed) {
      if (char === ",") {
        row.push(cell);
        cell = "";
        quoteClosed = false;
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && input[i + 1] === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => value.length > 0)) rows.push(row);
        row = [];
        cell = "";
        quoteClosed = false;
      } else {
        throw new Error("CSV has unexpected characters after a quoted field.");
      }
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === '"') {
      throw new Error("CSV has a quote inside an unquoted field.");
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseJiraImportCsv(
  csv: string,
  projectId: string,
): JiraImportRow[] {
  if (!OBJECT_ID.test(projectId)) throw new Error("Invalid Project ID.");
  const [headerRow, ...dataRows] = csvCells(csv.replace(/^\uFEFF/, ""));
  if (!headerRow || dataRows.length === 0 || dataRows.length > 1000) {
    throw new Error("CSV must contain 1–1000 task rows.");
  }
  if (
    headerRow.length !== HEADERS.length ||
    HEADERS.some((header, index) => headerRow[index] !== header)
  ) {
    throw new Error("CSV columns do not match the Jira import template.");
  }
  const seen = new Set<string>();
  return dataRows.map((cells, index) => {
    if (cells.length !== HEADERS.length)
      throw new Error(`CSV row ${index + 2} has an invalid column count.`);
    const row = Object.fromEntries(
      HEADERS.map((key, i) => [key, cells[i]]),
    ) as JiraImportRow;
    if (
      row.target_project_id !== projectId ||
      !JIRA_KEY.test(row.jira_key) ||
      row.title.length < 1 ||
      row.title.length > 255 ||
      !row.title.startsWith(`[${row.jira_key}] `) ||
      row.description.length > 20000 ||
      !SOURCE_URL.test(row.source_url) ||
      SOURCE_URL.exec(row.source_url)?.[1] !== row.jira_key ||
      !["To Do", "In Progress", "In Review", "Done"].includes(row.status) ||
      !["Low", "Medium", "High"].includes(row.priority) ||
      !["Task", "Subtask", "Epic"].includes(row.issue_type) ||
      (row.parent_key !== "" && !JIRA_KEY.test(row.parent_key))
    ) {
      throw new Error(
        `CSV row ${index + 2} has invalid Jira data or belongs to another Project.`,
      );
    }
    if (seen.has(row.jira_key))
      throw new Error(`Duplicate Jira key: ${row.jira_key}`);
    seen.add(row.jira_key);
    return row;
  });
}

function targetStatus(status: string): BackendTaskStatus {
  if (status === "Done") return "DONE";
  if (status === "In Review") return "IN_REVIEW";
  if (status === "In Progress") return "IN_PROGRESS";
  return "TODO";
}

async function moveToStatus(
  projectId: string,
  task: BackendTask,
  target: BackendTaskStatus,
): Promise<void> {
  const edges: Readonly<
    Record<BackendTaskStatus, readonly BackendTaskStatus[]>
  > = {
    TODO: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
    IN_PROGRESS: ["TODO", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"],
    IN_REVIEW: ["IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"],
    BLOCKED: ["TODO", "IN_PROGRESS", "IN_REVIEW", "CANCELLED"],
    DONE: ["IN_PROGRESS"],
    CANCELLED: ["TODO"],
  };
  const queue: BackendTaskStatus[][] = [[task.status]];
  const visited = new Set<BackendTaskStatus>([task.status]);
  let path: BackendTaskStatus[] | undefined;
  while (queue.length) {
    const current = queue.shift()!;
    const last = current[current.length - 1];
    if (last === target) {
      path = current;
      break;
    }
    for (const next of edges[last]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...current, next]);
      }
    }
  }
  if (!path)
    throw new Error(
      `${task.title} cannot move from ${task.status} to ${target}.`,
    );
  let version = task.version;
  let fromStatus = task.status;
  for (const toStatus of path.slice(1)) {
    const updated = await transitionProjectTaskApi(
      projectId,
      task.id,
      version,
      {
        fromStatus,
        toStatus,
        ...(fromStatus === "BLOCKED" ||
        fromStatus === "CANCELLED" ||
        fromStatus === "DONE" ||
        toStatus === "BLOCKED" ||
        toStatus === "CANCELLED"
          ? { reason: "Imported from Jira DATN" }
          : {}),
      },
    );
    version = updated.version;
    fromStatus = toStatus;
  }
}

export async function importJiraRows(
  projectId: string,
  rows: readonly JiraImportRow[],
  projectVisibility: unknown,
  onProgress: (progress: JiraImportProgress) => void,
): Promise<JiraImportProgress> {
  if (projectVisibility !== "PUBLIC" && projectVisibility !== "PRIVATE") {
    throw new Error(
      "Project visibility could not be verified. Wait for Project details to load, then retry.",
    );
  }
  const isPublicProject = projectVisibility === "PUBLIC";
  const existingTasks = (await fetchProjectTasks(projectId)).items;
  const byJiraKey = new Map<string, BackendTask>();
  for (const task of existingTasks) {
    const key = /^\[(DATN-\d+)\] /.exec(task.title)?.[1];
    if (key) {
      if (byJiraKey.has(key))
        throw new Error(`Duplicate imported task: ${key}`);
      byJiraKey.set(key, task);
    }
  }
  let created = 0;
  let existing = 0;
  let completed = 0;
  for (const row of rows) {
    let task = byJiraKey.get(row.jira_key);
    const description = isPublicProject
      ? `Jira source: ${row.source_url}`
      : row.description;
    if (task) {
      const detail = await fetchProjectTaskDetail(projectId, task.id);
      if (detail.description !== description || detail.title !== row.title) {
        throw new Error(`${row.jira_key} already exists with different content; import stopped.`);
      }
      if (task.status !== targetStatus(row.status)) {
        throw new Error(`${row.jira_key} already exists with status ${task.status}, while the Jira snapshot is ${row.status}. Resolve this task manually before retrying.`);
      }
      existing += 1;
    }
    if (!task) {
      task = await createProjectTaskApi(
        projectId,
        {
          title: row.title,
          description,
          type: "TASK",
          // Project visibility, not CSV contents, controls public redaction.
          priority: isPublicProject
            ? "MEDIUM"
            : (row.priority.toUpperCase() as "LOW" | "MEDIUM" | "HIGH"),
          labels: isPublicProject ? [] : ["jira-import", row.jira_key],
        },
        `jira-import:${projectId}:${row.jira_key}`,
      );
      byJiraKey.set(row.jira_key, task);
      created += 1;
      await moveToStatus(projectId, task, targetStatus(row.status));
    }
    completed += 1;
    onProgress({
      completed,
      total: rows.length,
      created,
      existing,
      currentKey: row.jira_key,
    });
  }
  return { completed, total: rows.length, created, existing, currentKey: "" };
}
