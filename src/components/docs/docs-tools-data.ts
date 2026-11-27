import type { McpToolDoc, McpToolDomainId } from "./docs-types";

export const MCP_TOOL_DOMAIN_ORDER: readonly McpToolDomainId[] = [
  "iam-projects",
  "tasks-sprints",
  "capture",
  "handover",
  "sag-knowledge",
  "chat-notifications",
];

/**
 * 28 Continuum MCP Tools — 100% parameter & schema parity with
 * DATN-BE/src/mcp/mcp-tools.catalog.ts and PROJECT.md Section 2.3.
 */
export const CONTINUUM_MCP_TOOLS: readonly McpToolDoc[] = [
  // =========================================================================
  // 1. IAM & Projects (4)
  // =========================================================================
  {
    name: "continuum_get_context",
    domain: "iam-projects",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Inspect the authenticated actor identity, active organization, live roles, and granted MCP API key scope.",
      vi: "Truy xuất danh tính người dùng đang xác thực, tổ chức hiện hành, vai trò hiệu lực và phạm vi cấp quyền của khóa MCP.",
    },
    params: [],
    exampleArgs: {},
  },
  {
    name: "continuum_list_projects",
    domain: "iam-projects",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List accessible projects in the active organization filtered by status, search query, and allowedProjectIds partition.",
      vi: "Liệt kê các dự án được phép truy cập trong tổ chức theo trạng thái, từ khóa tìm kiếm và phạm vi giới hạn allowedProjectIds.",
    },
    params: [
      {
        name: "page",
        type: "number",
        required: false,
        description: {
          en: "1-based page number (defaults to 1).",
          vi: "Số trang bắt đầu từ 1 (mặc định là 1).",
        },
      },
      {
        name: "pageSize",
        type: "number",
        required: false,
        description: {
          en: "Maximum projects per page (1..100, default 20).",
          vi: "Số lượng dự án tối đa trên mỗi trang (1..100, mặc định 20).",
        },
      },
      {
        name: "status",
        type: '"ACTIVE" | "ARCHIVED"',
        required: false,
        description: {
          en: "Filter projects by lifecycle status.",
          vi: "Lọc dự án theo trạng thái vòng đời.",
        },
      },
      {
        name: "q",
        type: "string",
        required: false,
        description: {
          en: "Optional search term matching project name or key.",
          vi: "Từ khóa tìm kiếm theo tên hoặc mã dự án.",
        },
      },
    ],
    exampleArgs: { status: "ACTIVE", pageSize: 20 },
  },
  {
    name: "continuum_get_project",
    domain: "iam-projects",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Fetch detailed metadata, status, and caller role/leadership flags for a single Continuum project.",
      vi: "Lấy thông tin chi tiết, trạng thái và vai trò/quyền Trưởng nhóm của người gọi trong một dự án Continuum.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "24-character hexadecimal Continuum project identifier.",
          vi: "Mã định danh dự án Continuum 24 ký tự thập lục phân.",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21" },
  },
  {
    name: "continuum_list_project_members",
    domain: "iam-projects",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List project members and designated project leaders for an accessible project.",
      vi: "Liệt kê thành viên dự án và các Trưởng nhóm được chỉ định của một dự án có quyền truy cập.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "24-character hexadecimal Continuum project identifier.",
          vi: "Mã định danh dự án Continuum (24-hex).",
        },
      },
      {
        name: "status",
        type: '"ACTIVE" | "INACTIVE"',
        required: false,
        description: {
          en: "Filter member status (defaults to ACTIVE).",
          vi: "Lọc theo trạng thái thành viên (mặc định ACTIVE).",
        },
      },
      {
        name: "search",
        type: "string",
        required: false,
        description: {
          en: "Optional search filter on member name or email.",
          vi: "Từ khóa tìm kiếm theo tên hoặc email thành viên.",
        },
      },
      {
        name: "page",
        type: "number",
        required: false,
        description: {
          en: "1-based page index (default 1).",
          vi: "Số trang bắt đầu từ 1 (mặc định 1).",
        },
      },
      {
        name: "pageSize",
        type: "number",
        required: false,
        description: {
          en: "Items per page (1..100, default 50).",
          vi: "Số lượng thành viên mỗi trang (1..100, mặc định 50).",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21", status: "ACTIVE" },
  },

  // =========================================================================
  // 2. Tasks & Sprints (8)
  // =========================================================================
  {
    name: "continuum_list_tasks",
    domain: "tasks-sprints",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List tasks in a project with filters for workflow status, priority, type, assignee, sprint, dates, and keyword search.",
      vi: "Truy vấn danh sách công việc trong dự án theo trạng thái, mức ưu tiên, phân loại, người phụ trách, sprint, hạn chót và từ khóa.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier owning the task workspace.",
          vi: "Mã định danh dự án chứa không gian công việc.",
        },
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: {
          en: "Single or comma-separated statuses: TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED.",
          vi: "Một hoặc nhiều trạng thái cách nhau dấu phẩy: TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED.",
        },
      },
      {
        name: "priority",
        type: "string",
        required: false,
        description: {
          en: "Single or comma-separated priorities: LOW, MEDIUM, HIGH.",
          vi: "Mức ưu tiên: LOW, MEDIUM, HIGH.",
        },
      },
      {
        name: "type",
        type: "string",
        required: false,
        description: {
          en: "Single or comma-separated types: TASK, BUG, STORY.",
          vi: "Loại công việc: TASK, BUG, STORY.",
        },
      },
      {
        name: "assigneeId",
        type: "string",
        required: false,
        description: {
          en: '24-hex user ID, "me", or "unassigned".',
          vi: 'Mã người dùng 24-hex, "me" hoặc "unassigned".',
        },
      },
      {
        name: "sprintId",
        type: "string",
        required: false,
        description: {
          en: '24-hex sprint ID or "backlog".',
          vi: 'Mã sprint 24-hex hoặc "backlog".',
        },
      },
      {
        name: "parentId",
        type: "string",
        required: false,
        description: {
          en: '24-hex parent task ID or "none" for root tasks.',
          vi: 'Mã công việc cha 24-hex hoặc "none" cho việc gốc.',
        },
      },
      {
        name: "q",
        type: "string",
        required: false,
        description: {
          en: "Keyword search across task title and description.",
          vi: "Từ khóa tìm kiếm trên tiêu đề và mô tả công việc.",
        },
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: {
          en: "Maximum items to return (1..100, default 50).",
          vi: "Số lượng công việc tối đa trả về (1..100, mặc định 50).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      status: "IN_PROGRESS",
      limit: 25,
    },
  },
  {
    name: "continuum_get_task",
    domain: "tasks-sprints",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Retrieve full task details, checklist steps, current ETag, and optional comments/audit history.",
      vi: "Đọc chi tiết công việc, các bước kiểm tra, phiên bản ETag hiện hành cùng tùy chọn bình luận và lịch sử thay đổi.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Task identifier (24-hex).",
          vi: "Mã định danh công việc (24-hex).",
        },
      },
      {
        name: "includeComments",
        type: "boolean",
        required: false,
        description: {
          en: "Include recent task discussion comments (default false).",
          vi: "Đính kèm danh sách bình luận của công việc (mặc định false).",
        },
      },
      {
        name: "includeHistory",
        type: "boolean",
        required: false,
        description: {
          en: "Include task state transition history (default false).",
          vi: "Đính kèm lịch sử chuyển trạng thái công việc (mặc định false).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      taskId: "69e923c77859fd1c702d4c32",
      includeComments: true,
    },
  },
  {
    name: "continuum_get_project_task_summary",
    domain: "tasks-sprints",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Compute real-time task counts by workflow status, priority, overdue items, and assignee workload.",
      vi: "Tổng hợp số lượng công việc theo trạng thái, mức ưu tiên, số mục quá hạn và khối lượng theo thành viên.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21" },
  },
  {
    name: "continuum_list_sprints",
    domain: "tasks-sprints",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List planned, active, and completed sprints along with sprint task counters.",
      vi: "Liệt kê các sprint dự kiến, đang chạy và đã hoàn tất kèm bộ đếm tiến độ công việc.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "status",
        type: '"PLANNED" | "ACTIVE" | "COMPLETED"',
        required: false,
        description: {
          en: "Optional sprint lifecycle filter.",
          vi: "Bộ lọc trạng thái vòng đời sprint.",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21", status: "ACTIVE" },
  },
  {
    name: "continuum_create_task",
    domain: "tasks-sprints",
    minScope: "READ_WRITE",
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Create a new task, bug, or story inside a Continuum project with priority, sprint, assignee, and checklist steps.",
      vi: "Tạo mới công việc (TASK, BUG, STORY) trong dự án kèm mức ưu tiên, sprint, người nhận và danh sách bước kiểm tra.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Target project identifier (24-hex).",
          vi: "Mã định danh dự án đích (24-hex).",
        },
      },
      {
        name: "title",
        type: "string",
        required: true,
        description: {
          en: "Task title (1..255 chars).",
          vi: "Tiêu đề công việc (1..255 ký tự).",
        },
      },
      {
        name: "description",
        type: "string | null",
        required: false,
        description: {
          en: "Markdown technical specification and acceptance criteria.",
          vi: "Đặc tả kỹ thuật Markdown và tiêu chí nghiệm thu.",
        },
      },
      {
        name: "type",
        type: '"TASK" | "BUG" | "STORY"',
        required: false,
        description: {
          en: "Work item classification (defaults to TASK).",
          vi: "Phân loại đầu việc (mặc định TASK).",
        },
      },
      {
        name: "priority",
        type: '"LOW" | "MEDIUM" | "HIGH"',
        required: false,
        description: {
          en: "Task priority level (defaults to MEDIUM).",
          vi: "Mức độ ưu tiên (mặc định MEDIUM).",
        },
      },
      {
        name: "assigneeId",
        type: "string (24-hex) | null",
        required: false,
        description: {
          en: "Assigned project member user ID.",
          vi: "Mã người dùng thành viên được giao việc.",
        },
      },
      {
        name: "sprintId",
        type: "string (24-hex) | null",
        required: false,
        description: {
          en: "Optional sprint ID.",
          vi: "Mã sprint gắn công việc (tùy chọn).",
        },
      },
      {
        name: "labels",
        type: "string[]",
        required: false,
        description: {
          en: "Up to 20 classification labels.",
          vi: "Tối đa 20 nhãn phân loại.",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      title: "Harden Redis session revocation retry backoff",
      type: "BUG",
      priority: "HIGH",
    },
  },
  {
    name: "continuum_update_task",
    domain: "tasks-sprints",
    minScope: "READ_WRITE",
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Update mutable task fields (title, description, priority, assigneeId, sprintId, dates, labels, steps) with automatic ETag resolution.",
      vi: "Cập nhật thông tin công việc (tiêu đề, mô tả, độ ưu tiên, người nhận, sprint, hạn chót, nhãn, bước con) kèm đồng bộ ETag tự động.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Task identifier (24-hex).",
          vi: "Mã định danh công việc (24-hex).",
        },
      },
      {
        name: "title",
        type: "string",
        required: false,
        description: {
          en: "Updated task title.",
          vi: "Tiêu đề công việc mới.",
        },
      },
      {
        name: "description",
        type: "string | null",
        required: false,
        description: {
          en: "Updated Markdown specification.",
          vi: "Mô tả kỹ thuật Markdown cập nhật.",
        },
      },
      {
        name: "priority",
        type: '"LOW" | "MEDIUM" | "HIGH"',
        required: false,
        description: {
          en: "Updated task priority.",
          vi: "Mức ưu tiên cập nhật.",
        },
      },
      {
        name: "ifMatch",
        type: "string",
        required: false,
        description: {
          en: 'Optional strong ETag ("task:<id>:<version>"). Automatically resolved if omitted.',
          vi: 'ETag kiểm soát đồng thời ("task:<id>:<version>"). Tự động nạp nếu bỏ trống.',
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      taskId: "69e923c77859fd1c702d4c32",
      priority: "HIGH",
    },
  },
  {
    name: "continuum_transition_task",
    domain: "tasks-sprints",
    minScope: "READ_WRITE",
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Transition a task to a new workflow state (TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED) with automatic ETag resolution.",
      vi: "Chuyển trạng thái công việc (TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED) với cơ chế tự động đối chiếu ETag.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Task identifier (24-hex).",
          vi: "Mã định danh công việc (24-hex).",
        },
      },
      {
        name: "toStatus",
        type: '"TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE" | "CANCELLED"',
        required: true,
        description: {
          en: "Target workflow status.",
          vi: "Trạng thái đích cần chuyển tới.",
        },
      },
      {
        name: "reason",
        type: "string",
        required: false,
        description: {
          en: "Required (min 5 chars) when moving to BLOCKED/CANCELLED or reopening from DONE.",
          vi: "Bắt buộc (tối thiểu 5 ký tự) khi chuyển sang BLOCKED/CANCELLED hoặc mở lại từ DONE.",
        },
      },
      {
        name: "ifMatch",
        type: "string",
        required: false,
        description: {
          en: "Optional strong ETag; auto-resolved if omitted.",
          vi: "ETag phiên bản; tự động nạp nếu bỏ trống.",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      taskId: "69e923c77859fd1c702d4c32",
      toStatus: "IN_REVIEW",
    },
  },
  {
    name: "continuum_add_task_comment",
    domain: "tasks-sprints",
    minScope: "READ_WRITE",
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Post an implementation update, PR link, or root-cause summary comment on a project task.",
      vi: "Đăng bình luận cập nhật tiến độ, liên kết PR hoặc phân tích nguyên nhân gốc vào công việc.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Task identifier (24-hex).",
          vi: "Mã định danh công việc (24-hex).",
        },
      },
      {
        name: "body",
        type: "string",
        required: true,
        description: {
          en: "Comment text (1..5000 chars).",
          vi: "Nội dung bình luận (1..5000 ký tự).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      taskId: "69e923c77859fd1c702d4c32",
      body: "Verified fix in commit a41c9e2 — linked structured Work Note.",
    },
  },

  // =========================================================================
  // 3. Work Notes, Documents & Reports (7)
  // =========================================================================
  {
    name: "continuum_list_work_notes",
    domain: "capture",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List structured engineering work notes across a project or specific task, filtered by review status or search query.",
      vi: "Liệt kê các ghi chú công việc kỹ thuật trong dự án hoặc theo công việc cụ thể, hỗ trợ lọc trạng thái duyệt và từ khóa.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: false,
        description: {
          en: "Optional 24-hex task ID filter.",
          vi: "Mã công việc 24-hex để lọc riêng ghi chú của task.",
        },
      },
      {
        name: "reviewStatus",
        type: '"PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"',
        required: false,
        description: {
          en: "Optional governance review status filter.",
          vi: "Lọc theo trạng thái xét duyệt ghi chú.",
        },
      },
      {
        name: "search",
        type: "string",
        required: false,
        description: {
          en: "Optional keyword search across note fields.",
          vi: "Từ khóa tìm kiếm trên nội dung ghi chú.",
        },
      },
      {
        name: "pageSize",
        type: "number",
        required: false,
        description: {
          en: "Items per page (1..50, default 20).",
          vi: "Số mục mỗi trang (1..50, mặc định 20).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      pageSize: 20,
    },
  },
  {
    name: "continuum_get_work_note",
    domain: "capture",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Fetch a single task work note including accomplishments, technical approach, rationale, and SAG sync state.",
      vi: "Đọc toàn văn một ghi chú công việc gồm kết quả đạt được, hướng tiếp cận, lý do kỹ thuật và trạng thái đồng bộ SAG.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "noteId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Work note identifier (24-hex).",
          vi: "Mã định danh ghi chú công việc (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: false,
        description: {
          en: "Optional parent task identifier (24-hex).",
          vi: "Mã công việc cha 24-hex (tùy chọn).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      noteId: "69e923c77859fd1c702d4c44",
    },
  },
  {
    name: "continuum_create_work_note",
    domain: "capture",
    minScope: "READ_WRITE",
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
    summary: {
      en: "Capture a structured engineering work note (accomplishments, approach, rationale) linked to a project task.",
      vi: "Ghi nhận ghi chú công việc có cấu trúc (kết quả thực hiện, phương pháp triển khai, lý do thiết kế) gắn với một công việc.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "taskId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Linked task identifier (24-hex).",
          vi: "Mã công việc liên kết (24-hex).",
        },
      },
      {
        name: "title",
        type: "string",
        required: true,
        description: {
          en: "Concise work note title (1..200 chars).",
          vi: "Tiêu đề ghi chú công việc (1..200 ký tự).",
        },
      },
      {
        name: "accomplishments",
        type: "string",
        required: true,
        description: {
          en: "What was built, fixed, or verified.",
          vi: "Những hạng mục đã xây dựng, khắc phục hoặc kiểm chứng.",
        },
      },
      {
        name: "approach",
        type: "string",
        required: true,
        description: {
          en: "Technical implementation approach and architecture mechanics.",
          vi: "Phương pháp triển khai kỹ thuật và cơ chế kiến trúc.",
        },
      },
      {
        name: "reason",
        type: "string",
        required: true,
        description: {
          en: "Engineering rationale and trade-offs behind the chosen design.",
          vi: "Lý do kỹ thuật và các đánh đổi đằng sau giải pháp đã chọn.",
        },
      },
      {
        name: "autoApprove",
        type: "boolean",
        required: false,
        description: {
          en: "Auto-approve immediately when caller holds leader review authority.",
          vi: "Tự động duyệt ngay nếu người gọi có quyền Trưởng nhóm.",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      taskId: "69e923c77859fd1c702d4c32",
      title: "ADR: Streamable HTTP JSON-RPC 2.0 MCP Gateway",
      accomplishments: "Implemented stateless /api/v1/mcp transport and SHA-256 key guard.",
      approach: "Mounted NestJS JSON-RPC dispatcher backed by live IAM RBAC.",
      reason: "Avoids stateful stdio/SSE sidecars while preserving strict tenant isolation.",
    },
  },
  {
    name: "continuum_list_documents",
    domain: "capture",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List project specification documents, governance review states, and SAG knowledge sync readiness.",
      vi: "Liệt kê tài liệu đặc tả dự án, trạng thái xét duyệt quản trị và mức độ sẵn sàng đồng bộ tri thức SAG.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "status",
        type: '"DRAFT" | "PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "ARCHIVED"',
        required: false,
        description: {
          en: "Optional document governance status filter.",
          vi: "Bộ lọc trạng thái quản trị của tài liệu.",
        },
      },
      {
        name: "pageSize",
        type: "number",
        required: false,
        description: {
          en: "Items per page (1..50, default 20).",
          vi: "Số tài liệu mỗi trang (1..50, mặc định 20).",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21" },
  },
  {
    name: "continuum_create_document",
    domain: "capture",
    minScope: "FULL_OPERATIONS",
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
    summary: {
      en: "Create a Markdown/text project document with classification type and optionally submit it for review.",
      vi: "Tạo tài liệu dự án định dạng Markdown/văn bản theo phân loại chuẩn và tùy chọn gửi xét duyệt ngay.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "title",
        type: "string",
        required: true,
        description: {
          en: "Document title (1..200 chars).",
          vi: "Tiêu đề tài liệu (1..200 ký tự).",
        },
      },
      {
        name: "type",
        type: '"ARCHITECTURE" | "API_SPECIFICATION" | "DATABASE_DESIGN" | "REQUIREMENT" | "DESIGN" | "TECHNICAL_SPECIFICATION" | "RESEARCH" | "MVP" | "RSR" | "OTHER"',
        required: true,
        description: {
          en: "Standard project document category.",
          vi: "Phân loại tài liệu dự án.",
        },
      },
      {
        name: "content",
        type: "string",
        required: true,
        description: {
          en: "Full Markdown body content (1..100000 chars).",
          vi: "Toàn văn nội dung Markdown (1..100000 ký tự).",
        },
      },
      {
        name: "description",
        type: "string",
        required: false,
        description: {
          en: "Optional summary abstract (max 2000 chars).",
          vi: "Tóm tắt ngắn gọn mục đích tài liệu (tối đa 2000 ký tự).",
        },
      },
      {
        name: "submitForReview",
        type: "boolean",
        required: false,
        description: {
          en: "Immediately submit the created draft for review & SAG indexing.",
          vi: "Gửi xét duyệt và đồng bộ SAG ngay sau khi tạo.",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      title: "MCP Gateway Security & Access Specification",
      type: "ARCHITECTURE",
      content: "# MCP Key Digest Storage\nAll MCP keys store SHA-256 digests only...",
      submitForReview: true,
    },
  },
  {
    name: "continuum_list_work_reports",
    domain: "capture",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List periodic member or leader work reports in a project filtered by review status.",
      vi: "Liệt kê các báo cáo công việc định kỳ của thành viên hoặc trưởng nhóm trong dự án.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "scope",
        type: '"MEMBER" | "LEADER"',
        required: false,
        description: {
          en: "Report tier (defaults to MEMBER).",
          vi: "Cấp báo cáo (mặc định MEMBER).",
        },
      },
      {
        name: "status",
        type: '"DRAFT" | "PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "OVERDUE"',
        required: false,
        description: {
          en: "Optional report status filter.",
          vi: "Bộ lọc trạng thái báo cáo.",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21", scope: "MEMBER" },
  },
  {
    name: "continuum_save_work_report_draft",
    domain: "capture",
    minScope: "READ_WRITE",
    escalationNote: {
      en: "Requires FULL_OPERATIONS when submit: true",
      vi: "Yêu cầu FULL_OPERATIONS khi đặt submit: true",
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Save the current or specified work report draft (accomplishments, approach, reason, blockers, nextSteps) and optionally submit for review.",
      vi: "Lưu bản nháp báo cáo công việc (kết quả, cách làm, lý do, vướng mắc, kế hoạch tiếp theo) và tùy chọn nộp xét duyệt.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "accomplishments",
        type: "string",
        required: true,
        description: {
          en: "Completed deliverables during the reporting period.",
          vi: "Các kết quả hoàn thành trong kỳ báo cáo.",
        },
      },
      {
        name: "approach",
        type: "string",
        required: true,
        description: {
          en: "Engineering methodology and verification steps executed.",
          vi: "Phương pháp kỹ thuật và các bước kiểm chứng đã thực hiện.",
        },
      },
      {
        name: "reason",
        type: "string",
        required: true,
        description: {
          en: "Business/technical rationale for key decisions.",
          vi: "Lý do nghiệp vụ/kỹ thuật cho các quyết định chính.",
        },
      },
      {
        name: "blockers",
        type: "string",
        required: false,
        description: {
          en: "Optional risks or blockers encountered.",
          vi: "Các rủi ro hoặc vướng mắc đang gặp phải (tùy chọn).",
        },
      },
      {
        name: "nextSteps",
        type: "string",
        required: false,
        description: {
          en: "Planned priorities for the next period.",
          vi: "Các ưu tiên dự kiến cho kỳ tiếp theo.",
        },
      },
      {
        name: "submit",
        type: "boolean",
        required: false,
        description: {
          en: "Set true to formally submit for review (requires FULL_OPERATIONS).",
          vi: "Đặt true để nộp duyệt chính thức (yêu cầu quyền FULL_OPERATIONS).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      accomplishments: "Delivered Streamable HTTP MCP gateway and 28 domain tools.",
      approach: "TDD across IAM, Task, Capture, Handover, SAG, and Chat modules.",
      reason: "Unifies IDE agent access under live Continuum RBAC.",
      submit: false,
    },
  },

  // =========================================================================
  // 4. Knowledge Handover (5)
  // =========================================================================
  {
    name: "continuum_list_handovers",
    domain: "handover",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "List 5-step knowledge handover packages in a project with optional participant role filtering.",
      vi: "Liệt kê các gói bàn giao tri thức 5 bước trong dự án kèm bộ lọc vai trò tham gia.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "participantRole",
        type: '"DEPARTING" | "SUCCESSOR"',
        required: false,
        description: {
          en: "Filter handovers where caller is DEPARTING or SUCCESSOR.",
          vi: "Lọc các gói bàn giao mà người gọi đóng vai trò DEPARTING hoặc SUCCESSOR.",
        },
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: {
          en: "Maximum packages to return (1..100, default 20).",
          vi: "Số gói bàn giao tối đa trả về (1..100, mặc định 20).",
        },
      },
    ],
    exampleArgs: { projectId: "69e923c77859fd1c702d4c21" },
  },
  {
    name: "continuum_get_handover",
    domain: "handover",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Inspect full details, published revision items, readiness status, capabilities, and ETag of a handover package.",
      vi: "Xem chi tiết gói bàn giao gồm danh mục bằng chứng đã xuất bản, mức độ sẵn sàng, quyền thao tác và ETag.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "handoverId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Handover package identifier (24-hex).",
          vi: "Mã định danh gói bàn giao (24-hex).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      handoverId: "69e923c77859fd1c702d4c55",
    },
  },
  {
    name: "continuum_preview_departing_handover",
    domain: "handover",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Preview unfinished tasks and eligible knowledge sources (work notes, documents, reports) of a departing project member.",
      vi: "Xem trước các công việc đang dở dang và nguồn tri thức hợp lệ (ghi chú, tài liệu, báo cáo) của nhân sự chuẩn bị bàn giao.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "departingUserId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "24-hex user ID of the departing project member.",
          vi: "Mã người dùng 24-hex của thành viên bàn giao.",
        },
      },
      {
        name: "handoverId",
        type: "string (24-hex)",
        required: false,
        description: {
          en: "Optional existing handover ID to diff against.",
          vi: "Mã gói bàn giao hiện có để đối chiếu (tùy chọn).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      departingUserId: "69e923c77859fd1c702d4c66",
    },
  },
  {
    name: "continuum_create_and_bundle_handover",
    domain: "handover",
    minScope: "FULL_OPERATIONS",
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Create a structured project handover package (A → Leader → Successor) and optionally auto-bundle & publish tasks and knowledge sources.",
      vi: "Tạo gói bàn giao tri thức dự án theo quy trình A → Trưởng nhóm → Người kế nhiệm và tùy chọn tự động đóng gói, xuất bản công việc cùng nguồn tri thức.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "departingUserId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Departing member user ID (24-hex).",
          vi: "Mã người dùng thành viên bàn giao (24-hex).",
        },
      },
      {
        name: "assignedLeaderId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Approving Project Leader user ID (24-hex).",
          vi: "Mã người dùng Trưởng nhóm thẩm định (24-hex).",
        },
      },
      {
        name: "targetCompletionDate",
        type: "string (ISO-8601)",
        required: true,
        description: {
          en: "ISO-8601 target completion date-time.",
          vi: "Mốc thời gian hoàn tất mục tiêu chuẩn ISO-8601.",
        },
      },
      {
        name: "title",
        type: "string",
        required: true,
        description: {
          en: "Handover package title (1..255 chars).",
          vi: "Tiêu đề gói bàn giao (1..255 ký tự).",
        },
      },
      {
        name: "successorUserId",
        type: "string (24-hex) | null",
        required: false,
        description: {
          en: "Receiving successor user ID (24-hex).",
          vi: "Mã người dùng nhân sự kế nhiệm tiếp nhận (24-hex).",
        },
      },
      {
        name: "taskIds",
        type: "string[]",
        required: false,
        description: {
          en: "24-hex task IDs to bundle into the handover.",
          vi: "Danh sách mã công việc 24-hex đưa vào gói bàn giao.",
        },
      },
      {
        name: "selectedSources",
        type: "Array<{ kind, id, version }>",
        required: false,
        description: {
          en: "Knowledge sources (TASK_NOTE, PROJECT_DOCUMENT, WORK_REPORT, KNOWLEDGE_OBJECT) to bundle.",
          vi: "Danh sách nguồn tri thức (TASK_NOTE, PROJECT_DOCUMENT, WORK_REPORT, KNOWLEDGE_OBJECT) đính kèm.",
        },
      },
      {
        name: "publishImmediately",
        type: "boolean",
        required: false,
        description: {
          en: "Publish bundled revision immediately when true.",
          vi: "Xuất bản ngay phiên bản đóng gói khi đặt true.",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      departingUserId: "69e923c77859fd1c702d4c66",
      assignedLeaderId: "69e923c77859fd1c702d4c77",
      successorUserId: "69e923c77859fd1c702d4c88",
      targetCompletionDate: "2026-12-15T10:00:00.000Z",
      title: "Backend Auth & MCP Gateway Handover",
      publishImmediately: true,
    },
  },
  {
    name: "continuum_act_on_handover",
    domain: "handover",
    minScope: "FULL_OPERATIONS",
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: true,
    },
    summary: {
      en: "Execute a 5-step handover lifecycle action (AUTO_BUNDLE, QUICK_TRANSFER_TASKS, QUICK_ACCEPT, COMPLETE, CANCEL) with automatic ETag resolution.",
      vi: "Thực thi thao tác vòng đời bàn giao 5 bước (AUTO_BUNDLE, QUICK_TRANSFER_TASKS, QUICK_ACCEPT, COMPLETE, CANCEL) kèm đồng bộ ETag tự động.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Project identifier (24-hex).",
          vi: "Mã định danh dự án (24-hex).",
        },
      },
      {
        name: "handoverId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Handover package identifier (24-hex).",
          vi: "Mã định danh gói bàn giao (24-hex).",
        },
      },
      {
        name: "action",
        type: '"AUTO_BUNDLE" | "QUICK_TRANSFER_TASKS" | "QUICK_ACCEPT" | "COMPLETE" | "CANCEL"',
        required: true,
        description: {
          en: "Streamlined handover lifecycle operation.",
          vi: "Thao tác chuyển bước bàn giao tinh gọn.",
        },
      },
      {
        name: "note",
        type: "string",
        required: false,
        description: {
          en: "Optional sign-off or bundle note.",
          vi: "Ghi chú đóng gói hoặc xác nhận bàn giao (tùy chọn).",
        },
      },
      {
        name: "reviewNote",
        type: "string",
        required: false,
        description: {
          en: "Optional review note for acceptance/completion.",
          vi: "Ghi chú thẩm định khi tiếp nhận hoặc hoàn tất.",
        },
      },
      {
        name: "ifMatch",
        type: "string",
        required: false,
        description: {
          en: "Optional strong ETag; auto-resolved if omitted.",
          vi: "ETag phiên bản; tự động nạp nếu bỏ trống.",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      handoverId: "69e923c77859fd1c702d4c55",
      action: "QUICK_ACCEPT",
      reviewNote: "All ADR work notes and integration specs verified.",
    },
  },

  // =========================================================================
  // 5. SAG Knowledge & Grounded AI Q&A (2)
  // =========================================================================
  {
    name: "continuum_search_knowledge",
    domain: "sag-knowledge",
    minScope: "READ_ONLY",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Run hybrid RRF semantic + lexical search over approved project knowledge in SAG and return ranked sections, citations, and grounded summary.",
      vi: "Chạy tìm kiếm lai RRF (ngữ nghĩa + từ khóa) trên kho tri thức dự án SAG, trả về các đoạn bằng chứng xếp hạng kèm trích dẫn.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Authorized Continuum project ID (24-hex).",
          vi: "Mã định danh dự án Continuum được cấp quyền (24-hex).",
        },
      },
      {
        name: "query",
        type: "string",
        required: true,
        description: {
          en: "Natural-language or technical search query (1..4000 chars).",
          vi: "Câu truy vấn kỹ thuật hoặc ngôn ngữ tự nhiên (1..4000 ký tự).",
        },
      },
      {
        name: "topK",
        type: "number",
        required: false,
        description: {
          en: "Maximum ranked evidence chunks to return (1..50).",
          vi: "Số đoạn bằng chứng tối đa trả về (1..50).",
        },
      },
      {
        name: "retrievalMode",
        type: '"EXACT" | "LOCAL_FACTUAL" | "ENTITY_RELATIONAL" | "TEMPORAL" | "GLOBAL_TOPIC" | "MULTI_HOP"',
        required: false,
        description: {
          en: "Optional SAG retrieval strategy hint.",
          vi: "Chiến lược truy xuất chuyên biệt trên bộ máy SAG (tùy chọn).",
        },
      },
      {
        name: "sourceIds",
        type: "string[]",
        required: false,
        description: {
          en: "Optional subset of authorized SAG source IDs.",
          vi: "Giới hạn danh sách nguồn dữ liệu SAG trong dự án (tùy chọn).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      query: "Why did we choose SHA-256 digest storage for MCP keys?",
      topK: 6,
      retrievalMode: "LOCAL_FACTUAL",
    },
  },
  {
    name: "continuum_ask_knowledge",
    domain: "sag-knowledge",
    minScope: "READ_ONLY",
    escalationNote: {
      en: "persistThread: true (creating a new persistent AI thread) requires READ_WRITE scope",
      vi: "persistThread: true (tạo luồng AI chat lưu dài hạn) yêu cầu quyền READ_WRITE",
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: false,
      destructiveHint: false,
    },
    summary: {
      en: "Ask a technical question to Continuum SAG for a project, returning synthesized answers with verifiable source citations.",
      vi: "Đặt câu hỏi chuyên sâu cho trợ lý AI Continuum SAG của dự án và nhận câu trả lời tổng hợp kèm trích dẫn nguồn xác thực.",
    },
    params: [
      {
        name: "projectId",
        type: "string (24-hex)",
        required: true,
        description: {
          en: "Authorized Continuum project ID (24-hex).",
          vi: "Mã định danh dự án Continuum (24-hex).",
        },
      },
      {
        name: "query",
        type: "string",
        required: true,
        description: {
          en: "Question requiring grounded synthesis with citations (1..4000 chars).",
          vi: "Câu hỏi cần tổng hợp tri thức kèm trích dẫn nguồn (1..4000 ký tự).",
        },
      },
      {
        name: "threadId",
        type: "string",
        required: false,
        description: {
          en: "Optional existing AI chat thread ID to continue a multi-turn session.",
          vi: "Mã luồng hội thoại AI sẵn có nếu muốn hỏi nối tiếp nhiều lượt.",
        },
      },
      {
        name: "persistThread",
        type: "boolean",
        required: false,
        description: {
          en: "When true and threadId is omitted, keeps the new SAG AI thread persisted so the returned threadId can be reused across turns (default false; requires READ_WRITE).",
          vi: "Khi bật true và không truyền threadId, giữ lại luồng AI chat mới trên SAG để tái sử dụng threadId cho các lượt hỏi tiếp theo (mặc định false; cần quyền READ_WRITE).",
        },
      },
    ],
    exampleArgs: {
      projectId: "69e923c77859fd1c702d4c21",
      query: "Summarize the token revocation edge cases in IAM.",
    },
  },

  // =========================================================================
  // 6. Human Chat & Notifications (2)
  // =========================================================================
  {
    name: "continuum_chat",
    domain: "chat-notifications",
    minScope: "READ_ONLY",
    escalationNote: {
      en: "READ_ONLY for list/search; requires FULL_OPERATIONS for SEND_MESSAGE",
      vi: "READ_ONLY khi xem/tìm kiếm; yêu cầu FULL_OPERATIONS khi SEND_MESSAGE",
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
    summary: {
      en: "List conversations, read message history, search team discussions (READ_ONLY), or send a chat message (SEND_MESSAGE requires FULL_OPERATIONS).",
      vi: "Liệt kê hội thoại, đọc lịch sử tin nhắn, tìm kiếm thảo luận (READ_ONLY) hoặc gửi tin nhắn nhóm (SEND_MESSAGE yêu cầu FULL_OPERATIONS).",
    },
    params: [
      {
        name: "action",
        type: '"LIST_CONVERSATIONS" | "LIST_MESSAGES" | "SEARCH_MESSAGES" | "SEND_MESSAGE"',
        required: true,
        description: {
          en: "Chat operation mode (SEND_MESSAGE requires FULL_OPERATIONS).",
          vi: "Chế độ thao tác trò chuyện (SEND_MESSAGE yêu cầu FULL_OPERATIONS).",
        },
      },
      {
        name: "conversationId",
        type: "string (24-hex)",
        required: false,
        description: {
          en: "Target 24-hex conversation ID when listing, searching, or sending messages.",
          vi: "Mã cuộc trò chuyện 24-hex khi đọc, tìm kiếm hoặc gửi tin nhắn.",
        },
      },
      {
        name: "query",
        type: "string",
        required: false,
        description: {
          en: "Message search query (2..80 chars) for SEARCH_MESSAGES.",
          vi: "Từ khóa tìm kiếm tin nhắn (2..80 ký tự) cho SEARCH_MESSAGES.",
        },
      },
      {
        name: "content",
        type: "string",
        required: false,
        description: {
          en: "Message content (1..8000 chars) when action is SEND_MESSAGE.",
          vi: "Nội dung tin nhắn (1..8000 ký tự) khi thực hiện SEND_MESSAGE.",
        },
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: {
          en: "Maximum items to return (1..100).",
          vi: "Số lượng kết quả tối đa trả về (1..100).",
        },
      },
    ],
    exampleArgs: {
      action: "LIST_CONVERSATIONS",
      limit: 20,
    },
  },
  {
    name: "continuum_notifications",
    domain: "chat-notifications",
    minScope: "READ_ONLY",
    escalationNote: {
      en: "READ_ONLY for list/unread; requires READ_WRITE to mark read",
      vi: "READ_ONLY khi xem danh sách; yêu cầu READ_WRITE khi đánh dấu đã đọc",
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
    summary: {
      en: "Inspect unread workspace notifications across tasks, handovers, and mentions, or mark notifications as read.",
      vi: "Kiểm tra thông báo chưa đọc về công việc, bàn giao và lượt nhắc tên, hoặc đánh dấu đã đọc.",
    },
    params: [
      {
        name: "action",
        type: '"LIST" | "UNREAD_COUNT" | "MARK_READ" | "MARK_ALL_READ"',
        required: true,
        description: {
          en: "Notification action (MARK_READ / MARK_ALL_READ require READ_WRITE).",
          vi: "Thao tác thông báo (MARK_READ / MARK_ALL_READ yêu cầu READ_WRITE).",
        },
      },
      {
        name: "notificationId",
        type: "string (24-hex)",
        required: false,
        description: {
          en: "24-hex notification ID when action is MARK_READ.",
          vi: "Mã thông báo 24-hex cần đánh dấu đã đọc khi dùng MARK_READ.",
        },
      },
      {
        name: "unreadOnly",
        type: "boolean",
        required: false,
        description: {
          en: "Return only unread notifications when action is LIST.",
          vi: "Chỉ lấy các thông báo chưa đọc khi thực hiện LIST.",
        },
      },
      {
        name: "limit",
        type: "number",
        required: false,
        description: {
          en: "Maximum notifications to return (1..50).",
          vi: "Số thông báo tối đa trả về (1..50).",
        },
      },
    ],
    exampleArgs: {
      action: "UNREAD_COUNT",
    },
  },
];
