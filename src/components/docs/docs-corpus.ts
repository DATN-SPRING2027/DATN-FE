import type { DocsLanguage, DocsLocalizedCorpus } from "./docs-types";

export const DOCS_CORPUS: Record<DocsLanguage, DocsLocalizedCorpus> = {
  en: {
    metaTitle: "Developer & MCP Docs · Continuum",
    ui: {
      headerBadge: "Docs · MCP v1.0",
      searchPlaceholder: "Search docs & 36 MCP tools (press / to focus)…",
      searchAriaLabel: "Search developer documentation and MCP tools",
      clearSearchAria: "Clear documentation search",
      langGroupAria: "Documentation language",
      langViLabel: "VI",
      langEnLabel: "EN",
      manageKeysCta: "Manage MCP Keys",
      workspaceCta: "Workspace",
      signInCta: "Sign in",
      getStartedCta: "Get started",
      tocHeading: "On this page",
      mobileTocToggle: "On this page ({count} sections)",
      copyCta: "Copy",
      copiedCta: "Copied",
      copyJsonRpcCta: "Copy tools/call JSON-RPC",
      copiedJsonRpcCta: "Copied JSON-RPC",
      expandAllTools: "Expand all schemas",
      collapseAllTools: "Collapse all",
      inspectSchemaCta: "Inspect schema & payload",
      hideSchemaCta: "Hide schema",
      paramsHeading: "Input parameters",
      noParamsNote: "No arguments required — uses caller authentication context.",
      paramColName: "Parameter",
      paramColType: "Type",
      paramColRequired: "Req",
      paramColDesc: "Description",
      requiredYes: "Required",
      requiredNo: "Optional",
      examplePayloadHeading: "JSON-RPC 2.0 Request (POST /api/v1/mcp)",
      allDomainsLabel: "All Subsystems",
      allScopesLabel: "All Scopes",
      matchingToolsCount: "Showing {count} of {total} MCP tools",
      jumpToMatchingTools: "Jump to {count} tools ↓",
      emptyToolsTitle: "No MCP tools match the current filters",
      emptyToolsDesc:
        "Clear your search keyword or switch the subsystem and scope filters back to All.",
      resetFiltersCta: "Reset tool filters",
      endpointDirectLabel: "Direct API (/api/v1/mcp)",
      endpointBffLabel: "Same-Origin BFF (/api/backend/mcp)",
      targetFileLabel: "Target:",
      subsystemToolsCount: "{count} tools",
      endpointCardHeading: "MCP Endpoint",
      endpointModeAriaLabel: "MCP endpoint routing mode",
      filterDomainAriaLabel: "Filter tools by subsystem",
      filterScopeAriaLabel: "Filter tools by capability scope",
      footerCopyright: "© 2026 Continuum AI · MCP Specification 2025-03-26",
      footerHomeLink: "Home",
      footerIntegrationsLink: "MCP API Keys",
      footerTermsLink: "Terms of Use",
      footerPrivacyLink: "Privacy Policy",
    },
    sections: [
      {
        id: "overview",
        number: "01",
        shortTitle: "System Architecture",
        title: "Overview & 6-Subsystem MCP Architecture",
      },
      {
        id: "quickstart",
        number: "02",
        shortTitle: "60-Second Quickstart",
        title: "Quickstart & 7-Client Configurator",
      },
      {
        id: "security",
        number: "03",
        shortTitle: "Authentication & Scopes",
        title: "Authentication, Scopes & Access Boundaries",
      },
      {
        id: "tools",
        number: "04",
        shortTitle: "36-Tool Reference",
        title: "36-Tool Reference Explorer",
      },
      {
        id: "resources-prompts",
        number: "05",
        shortTitle: "Resources & Playbooks",
        title: "MCP Resources, Prompts & Multi-Step Playbooks",
      },
    ],
    hero: {
      eyebrow: "MODEL CONTEXT PROTOCOL (MCP) · STREAMABLE HTTP",
      title: "Continuum System-Wide MCP Gateway",
      subtitle:
        "One Streamable HTTP JSON-RPC 2.0 endpoint connecting project access, sprint tasks, evidence-backed work notes, 5-step knowledge handover (A → D → B), and cited SAG hybrid search directly inside your IDE.",
      protocolStatLabel: "Protocol",
      protocolStatValue: "2025-03-26",
      toolsStatLabel: "System Tools",
      toolsStatValue: "36 Tools",
      subsystemsStatLabel: "Subsystems",
      subsystemsStatValue: "6 Subsystems",
      authStatLabel: "Authentication",
      authStatValue: "SHA-256 + RBAC",
    },
    overview: {
      rationaleTitle: "Why a single Continuum MCP gateway?",
      rationaleParagraphs: [
        "Software teams lose engineering context when AI coding assistants work disconnected from sprint tasks, design work notes, and member handovers. Conversely, exposing raw internal microservices or unscoped vector stores directly to external LLM clients breaks organization isolation and project RBAC.",
        "Continuum provides a single stateless Streamable HTTP MCP endpoint (/api/v1/mcp and same-origin /api/backend/mcp). Every JSON-RPC 2.0 call authenticates through Continuum IAM, verifies live organization and project membership, resolves ETag concurrency versions automatically, and scopes SAG hybrid search strictly to authorized projects.",
      ],
      subsystemsTitle: "6 subsystems behind /api/v1/mcp",
      subsystems: [
        {
          code: "01",
          domain: "iam-projects",
          name: "IAM & Projects",
          toolCount: 7,
          summary:
            "Caller identity inspection, project creation/settings, member rosters, and leader governance.",
        },
        {
          code: "02",
          domain: "tasks-sprints",
          name: "Tasks & Sprints",
          toolCount: 8,
          summary:
            "Backlog queries, sprint progress summaries, task creation, ETag-checked updates, status transitions, and comments.",
        },
        {
          code: "03",
          domain: "capture",
          name: "Work Notes, Documents & Reports",
          toolCount: 12,
          summary:
            "Work notes, binary/Markdown project documents, review/approval decisions, periodic reports, and SAG sync controls.",
        },
        {
          code: "04",
          domain: "handover",
          name: "5-Step Knowledge Handover",
          toolCount: 5,
          summary:
            "Departing member readiness previews, artifact bundling, and structured A → D → B sign-off actions.",
        },
        {
          code: "05",
          domain: "sag-knowledge",
          name: "SAG Hybrid Knowledge Search",
          toolCount: 2,
          summary:
            "Project-scoped semantic + lexical search and technical Q&A with verifiable source citations.",
        },
        {
          code: "06",
          domain: "chat-notifications",
          name: "Team Chat & Notifications",
          toolCount: 2,
          summary:
            "Conversation history, discussion search, status updates, and workspace notification management.",
        },
      ],
      pipelineTitle: "Request lifecycle",
      pipelineSubtitle:
        "Select any stage along the request path to inspect how Continuum validates and executes an AI Agent tool call.",
      stages: [
        {
          id: "stage-host",
          step: "01",
          title: "IDE & AI Agent Host",
          protocolTag: "Antigravity · Claude Code · Cursor · VS Code · Windsurf",
          summary:
            "A developer prompts their IDE assistant with a coding or project task. The MCP client connects directly over HTTPS without local background daemons.",
          invariants: [
            "No local Python or Node sidecar required for native Streamable HTTP hosts",
            "Negotiates MCP protocol versions 2025-03-26, 2025-06-18, and 2024-11-05",
            "Authenticates via Authorization: Bearer ctm_mcp_<43-char-base64url>",
          ],
        },
        {
          id: "stage-transport",
          step: "02",
          title: "Streamable HTTP JSON-RPC 2.0",
          protocolTag: "POST /api/v1/mcp · /api/backend/mcp",
          summary:
            "Stateless JSON-RPC 2.0 transport handles initialize, tools/list, tools/call, resources/read, and prompts/get with cache-control: no-store headers.",
          invariants: [
            "GET /api/v1/mcp returns server discovery metadata (or 405 on passive SSE stream probes)",
            "One-way notifications (notifications/initialized) return 202 Accepted",
            "Next.js BFF (/api/backend/mcp) forwards mcp-session-id and mcp-protocol-version headers",
          ],
        },
        {
          id: "stage-guard",
          step: "03",
          title: "SHA-256 Digest & Live RBAC Gate",
          protocolTag: "IAM · Default-Deny",
          summary:
            "The bearer token is hashed with SHA-256 in memory and matched against mcp_api_keys. Live organization membership, key expiration, scope tier, and project allowlists are checked on every call.",
          invariants: [
            "Raw ctm_mcp_ secrets are never stored in MongoDB or server logs",
            "Removing a member from an organization or project revokes MCP access immediately",
            "Mutating REST routes outside /api/v1/mcp reject ctm_mcp_ tokens (MCP_KEY_DIRECT_MUTATION_FORBIDDEN)",
          ],
        },
        {
          id: "stage-domains",
          step: "04",
          title: "Domain Services & SAG Bridge",
          protocolTag: "ETag If-Match · Project-Scoped SAG",
          summary:
            "Authorized calls invoke Continuum domain services directly, resolving fresh ETags before writes and restricting SAG retrieval to verified projects.",
          invariants: [
            "Automatic ETag lookup prevents lost updates during concurrent task and handover edits",
            "SAG POST /api/v1/search and Q&A enforce organizationId + projectId isolation",
            "Compact structured responses minimize context-window token usage",
          ],
        },
      ],
    },
    quickstart: {
      subtitle:
        "Connect your IDE or CLI to Continuum in under a minute with a personal Streamable HTTP key.",
      steps: [
        {
          step: "01",
          title: "Create a personal ctm_mcp_ key",
          body: "Open Organization → Integrations (/organization/integrations), select READ_ONLY, READ_WRITE, or FULL_OPERATIONS, optionally limit access to selected projects, and copy the one-time secret.",
        },
        {
          step: "02",
          title: "Add the client configuration",
          body: "Choose your IDE or CLI, select Same-Origin BFF (/api/backend/mcp) or Direct API (/api/v1/mcp), and paste the snippet into your MCP configuration file.",
        },
        {
          step: "03",
          title: "Verify identity and project access",
          body: "Ask your AI Agent to call continuum_get_context or continuum_list_projects to confirm your active organization roles and visible projects.",
        },
      ],
      configuratorTitle: "7-client configuration generator",
      configuratorSubtitle:
        "Select an MCP host and endpoint mode to copy a ready-to-use configuration.",
    },
    security: {
      subtitle:
        "Every Continuum MCP key enforces SHA-256 credential hashing, live RBAC intersection, and per-project access boundaries.",
      controls: [
        {
          code: "01",
          title: "ctm_mcp_ prefix & SHA-256 one-way hashing",
          body: "Keys are generated from 32 bytes of CSPRNG entropy as ctm_mcp_<43-char-base64url>. Continuum stores only a 16-character display prefix and the SHA-256 digest.",
        },
        {
          code: "02",
          title: "Live RBAC intersection (no stale role grants)",
          body: "MCP keys never cache permissions. Every request intersects the key's capability scope and allowedProjectIds with the owner's current organization and project roles.",
        },
        {
          code: "03",
          title: "REST mutation boundary (MCP_KEY_DIRECT_MUTATION_FORBIDDEN)",
          body: "Personal ctm_mcp_ tokens cannot call mutating REST endpoints (POST, PATCH, DELETE) outside /api/v1/mcp, keeping every AI Agent write inside MCP scope checks.",
        },
        {
          code: "04",
          title: "ETag concurrency control (If-Match)",
          body: "Continuum task and handover services enforce versioned ETags. MCP write handlers resolve current resource versions automatically and report conflicts clearly.",
        },
      ],
      tiersTitle: "Capability scopes & tool counts",
      tiers: [
        {
          scope: "READ_ONLY",
          title: "Read Only",
          badge: "READ_ONLY · 20 tools",
          summary:
            "Read-only visibility across projects, tasks, sprints, work notes, full document contents, handovers, and cited SAG search.",
          capabilities: [
            "Read caller context, projects, members, tasks, sprints, notes, full documents & reports",
            "Run hybrid SAG search and cited technical Q&A",
            "Inspect chat conversations and unread notification counts without modifying state",
          ],
        },
        {
          scope: "READ_WRITE",
          title: "Read & Write",
          badge: "READ_WRITE · 26 tools (+6 write tools)",
          summary:
            "Day-to-day engineering work: create, update, and transition tasks, log work notes, save report drafts, and mark notifications read.",
          capabilities: [
            "All 20 tools in READ_ONLY",
            "Create, update, transition, and comment on project tasks (+4 tools)",
            "Create structured work notes, save report drafts (submit: false), and mark notifications read (+2 tools)",
          ],
        },
        {
          scope: "FULL_OPERATIONS",
          title: "Full Operations",
          badge: "FULL_OPERATIONS · All 36 tools (+10 full-ops tools)",
          summary:
            "Complete workflow operations: project/member administration, binary document upload & approval, work-note/report review, 5-step handovers, and team chat.",
          capabilities: [
            "All 26 tools in READ_WRITE",
            "Create/update projects, manage members/leaders, upload document files, review/approve docs/notes/reports, and sync SAG",
            "Create, bundle, and act on 5-step handovers + send team chat messages",
          ],
        },
      ],
    },
    toolsExplorer: {
      subtitle:
        "Filter all 36 Continuum MCP tools by subsystem, minimum capability scope, or keyword, and inspect input parameters and JSON-RPC 2.0 payloads.",
      domainLabels: {
        "iam-projects": "IAM & Projects",
        "tasks-sprints": "Tasks & Sprints",
        capture: "Work Notes & Reports",
        handover: "Handover",
        "sag-knowledge": "SAG Knowledge & AI",
        "chat-notifications": "Chat & Notifications",
      },
      hintLabels: {
        readOnly: "readOnlyHint",
        mutating: "mutating",
        idempotent: "idempotentHint",
        destructive: "destructiveHint",
      },
    },
    resourcesAndPrompts: {
      subtitle:
        "Alongside tools, Continuum provides MCP Resources for context snapshots and built-in Prompts for recurring engineering workflows.",
      resourcesHeading: "MCP resources & URI templates",
      resources: [
        {
          uri: "continuum://context/current",
          kind: "STATIC",
          mimeType: "application/json",
          title: "Current user & organization context",
          description:
            "Live JSON snapshot of the authenticated user, active organization, effective roles, MCP capability scope, and allowedProjectIds.",
        },
        {
          uri: "continuum://projects/{projectId}/overview",
          kind: "TEMPLATE",
          mimeType: "application/json",
          title: "Project & sprint overview",
          description:
            "Parameterized resource template returning project metadata, designated project leaders, task status summary, and sprints.",
        },
      ],
      promptsHeading: "Built-in MCP prompts (4)",
      prompts: [
        {
          name: "daily-standup-brief",
          argumentsSignature: "(projectId: string)",
          title: "Daily standup brief",
          description:
            "Summarizes in-progress tasks, blockers, and recent work notes into an evidence-backed standup update.",
        },
        {
          name: "handover-readiness-audit",
          argumentsSignature: "(projectId: string, departingUserId?: string)",
          title: "Handover readiness review",
          description:
            "Reviews open tasks, undocumented decisions, and missing verification notes before starting an A → D → B handover.",
        },
        {
          name: "task-triage-assistant",
          argumentsSignature: "(projectId: string)",
          title: "Task triage assistant",
          description:
            "Compares backlog tasks against SAG architecture docs to suggest priorities, sprint placement, and assignees.",
        },
        {
          name: "project-onboarding-pack",
          argumentsSignature: "(projectId: string)",
          title: "Project onboarding pack",
          description:
            "Compiles a cited architecture, sprint, and handover briefing for engineers joining a Continuum project.",
        },
      ],
      playbooksHeading: "Multi-step AI Agent playbooks",
      playbooksSubtitle:
        "End-to-end tool sequences showing how IDE assistants combine Continuum subsystems.",
      playbooks: [
        {
          id: "playbook-bugfix",
          badge: "01 · Daily Engineering",
          title: "Investigate bug + check SAG design rationale + log Work Note + move to IN_REVIEW",
          scenario:
            "Developer asks Cursor or Claude Code: \"Pick up task-104, check why we designed token rotation that way in SAG, implement the fix, log a Work Note, and move the task to IN_REVIEW.\"",
          steps: [
            {
              tool: "continuum_get_task",
              detail: "Reads acceptance criteria and current workflow status for task-104.",
            },
            {
              tool: "continuum_search_knowledge",
              detail: "Finds approved ADR sections explaining refresh token rotation rules.",
            },
            {
              tool: "continuum_create_work_note",
              detail: "Records root-cause analysis and test evidence linked to task-104.",
            },
            {
              tool: "continuum_transition_task",
              detail: "Moves task-104 to IN_REVIEW and posts the commit summary via continuum_add_task_comment.",
            },
          ],
        },
        {
          id: "playbook-handover",
          badge: "02 · Knowledge Handover (A → D → B)",
          title: "Review departing work + bundle verified sources + complete 5-step handover",
          scenario:
            "A Project Leader or departing engineer prepares a structured handover package so key design decisions carry forward cleanly.",
          steps: [
            {
              tool: "continuum_preview_departing_handover",
              detail: "Lists unfinished tasks and eligible work notes owned by the departing member.",
            },
            {
              tool: "continuum_ask_knowledge",
              detail: "Confirms key subsystem decisions are indexed in SAG with citations.",
            },
            {
              tool: "continuum_create_and_bundle_handover",
              detail: "Creates and publishes the handover package linking tasks, selectedSources, and successorUserId.",
            },
            {
              tool: "continuum_act_on_handover",
              detail: "Runs action: QUICK_TRANSFER_TASKS and QUICK_ACCEPT to complete task transfer and sign-off.",
            },
          ],
        },
        {
          id: "playbook-standup",
          badge: "03 · Weekly Sprint Digest",
          title: "Summarize sprint progress + save Work Report draft + share in Team Chat",
          scenario:
            "At the end of a sprint week, an engineer compiles completed work into a report draft and posts a short update in the team room.",
          steps: [
            {
              tool: "continuum_get_project_task_summary",
              detail: "Counts completed, in-review, and overdue tasks across the project.",
            },
            {
              tool: "continuum_list_work_notes",
              detail: "Collects engineering work notes recorded during the sprint.",
            },
            {
              tool: "continuum_save_work_report_draft",
              detail: "Saves a structured Markdown work report draft for review before submission.",
            },
            {
              tool: "continuum_chat",
              detail: "Posts a concise progress summary to the project room via action: SEND_MESSAGE.",
            },
          ],
        },
      ],
    },
  },

  vi: {
    metaTitle: "Tài liệu nhà phát triển & MCP · Continuum",
    ui: {
      headerBadge: "Docs · MCP v1.0",
      searchPlaceholder: "Tìm tài liệu & 36 công cụ MCP (nhấn / để tìm)…",
      searchAriaLabel: "Tìm kiếm tài liệu nhà phát triển và công cụ MCP",
      clearSearchAria: "Xóa từ khóa tìm kiếm",
      langGroupAria: "Ngôn ngữ tài liệu",
      langViLabel: "VI",
      langEnLabel: "EN",
      manageKeysCta: "Quản lý khóa MCP",
      workspaceCta: "Không gian làm việc",
      signInCta: "Đăng nhập",
      getStartedCta: "Bắt đầu ngay",
      tocHeading: "Trên trang này",
      mobileTocToggle: "Trên trang này ({count} mục)",
      copyCta: "Sao chép",
      copiedCta: "Đã chép",
      copyJsonRpcCta: "Chép JSON-RPC tools/call",
      copiedJsonRpcCta: "Đã chép JSON-RPC",
      expandAllTools: "Mở rộng tất cả schema",
      collapseAllTools: "Thu gọn tất cả",
      inspectSchemaCta: "Xem tham số & JSON-RPC",
      hideSchemaCta: "Ẩn schema",
      paramsHeading: "Tham số đầu vào",
      noParamsNote: "Không yêu cầu tham số — tự động lấy ngữ cảnh từ khóa xác thực.",
      paramColName: "Tham số",
      paramColType: "Kiểu dữ liệu",
      paramColRequired: "Bắt buộc",
      paramColDesc: "Mô tả",
      requiredYes: "Bắt buộc",
      requiredNo: "Tùy chọn",
      examplePayloadHeading: "Mẫu yêu cầu JSON-RPC 2.0 (POST /api/v1/mcp)",
      allDomainsLabel: "Tất cả phân hệ",
      allScopesLabel: "Tất cả tầng quyền",
      matchingToolsCount: "Đang hiển thị {count} / {total} công cụ MCP",
      jumpToMatchingTools: "Xem {count} công cụ ↓",
      emptyToolsTitle: "Không có công cụ MCP nào khớp bộ lọc",
      emptyToolsDesc:
        "Hãy xóa từ khóa tìm kiếm hoặc đặt lại bộ lọc phân hệ và tầng quyền về Tất cả.",
      resetFiltersCta: "Đặt lại bộ lọc",
      endpointDirectLabel: "API trực tiếp (/api/v1/mcp)",
      endpointBffLabel: "BFF cùng miền (/api/backend/mcp)",
      targetFileLabel: "Đích:",
      subsystemToolsCount: "{count} công cụ",
      endpointCardHeading: "Điểm cuối MCP",
      endpointModeAriaLabel: "Chế độ định tuyến điểm cuối MCP",
      filterDomainAriaLabel: "Lọc công cụ theo phân hệ",
      filterScopeAriaLabel: "Lọc công cụ theo tầng quyền",
      footerCopyright: "© 2026 Continuum AI · Chuẩn giao thức MCP 2025-03-26",
      footerHomeLink: "Trang chủ",
      footerIntegrationsLink: "Khóa API MCP",
      footerTermsLink: "Điều khoản sử dụng",
      footerPrivacyLink: "Chính sách bảo mật",
    },
    sections: [
      {
        id: "overview",
        number: "01",
        shortTitle: "Kiến trúc hệ thống",
        title: "Tổng quan & kiến trúc MCP kết nối 6 phân hệ",
      },
      {
        id: "quickstart",
        number: "02",
        shortTitle: "Thiết lập trong 60 giây",
        title: "Thiết lập nhanh & cấu hình cho 7 IDE/CLI",
      },
      {
        id: "security",
        number: "03",
        shortTitle: "Xác thực & phân quyền",
        title: "Xác thực, tầng quyền & giới hạn phạm vi dự án",
      },
      {
        id: "tools",
        number: "04",
        shortTitle: "Tra cứu 36 công cụ",
        title: "Danh mục chi tiết 36 công cụ MCP",
      },
      {
        id: "resources-prompts",
        number: "05",
        shortTitle: "Resources & kịch bản",
        title: "MCP Resources, Prompts & kịch bản AI Agent nhiều bước",
      },
    ],
    hero: {
      eyebrow: "MODEL CONTEXT PROTOCOL (MCP) · STREAMABLE HTTP",
      title: "Cổng tích hợp Continuum MCP",
      subtitle:
        "Một điểm cuối JSON-RPC 2.0 chuẩn Streamable HTTP kết nối phân quyền dự án, công việc sprint, ghi chú kỹ thuật có dẫn chứng, bàn giao tri thức 5 bước (A → D → B) và tìm kiếm lai SAG ngay trong IDE của bạn.",
      protocolStatLabel: "Phiên bản giao thức",
      protocolStatValue: "2025-03-26",
      toolsStatLabel: "Công cụ hệ thống",
      toolsStatValue: "36 công cụ",
      subsystemsStatLabel: "Phân hệ kết nối",
      subsystemsStatValue: "6 phân hệ",
      authStatLabel: "Cơ chế xác thực",
      authStatValue: "SHA-256 + RBAC",
    },
    overview: {
      rationaleTitle: "Vì sao Continuum dùng một cổng MCP thống nhất?",
      rationaleParagraphs: [
        "Đội ngũ kỹ thuật dễ đánh mất ngữ cảnh quan trọng khi trợ lý lập trình AI hoạt động tách rời khỏi danh sách công việc sprint, ghi chú quyết định thiết kế và hồ sơ bàn giao nhân sự. Ngược lại, nếu mở trực tiếp từng microservice nội bộ hoặc cơ sở dữ liệu vector chưa phân quyền cho LLM bên ngoài, hệ thống sẽ làm lộ dữ liệu đa tổ chức (multi-tenant) và phá vỡ RBAC dự án.",
        "Continuum giải quyết bài toán này bằng một cổng Streamable HTTP MCP phi trạng thái duy nhất (/api/v1/mcp và BFF cùng miền /api/backend/mcp). Mọi lệnh gọi JSON-RPC 2.0 đều đi qua Continuum IAM, đối chiếu tư cách thành viên tổ chức và dự án theo thời gian thực, tự động kiểm soát đồng thời bằng ETag (If-Match), và giới hạn truy vấn SAG đúng phạm vi dự án được cấp quyền.",
      ],
      subsystemsTitle: "6 phân hệ phía sau /api/v1/mcp",
      subsystems: [
        {
          code: "01",
          domain: "iam-projects",
          name: "IAM & dự án",
          toolCount: 7,
          summary:
            "Kiểm tra danh tính người gọi, tạo/cập nhật dự án, quản lý thành viên và trưởng nhóm theo RBAC thực.",
        },
        {
          code: "02",
          domain: "tasks-sprints",
          name: "Công việc & sprint",
          toolCount: 8,
          summary:
            "Truy vấn backlog, thống kê tiến độ sprint, tạo và cập nhật công việc có kiểm tra ETag, chuyển trạng thái và bình luận.",
        },
        {
          code: "03",
          domain: "capture",
          name: "Ghi chú, tài liệu & báo cáo",
          toolCount: 12,
          summary:
            "Ghi chú công việc, tải tệp đính kèm tài liệu (base64), phê duyệt/từ chối tài liệu/ghi chú/báo cáo và điều khiển đồng bộ SAG.",
        },
        {
          code: "04",
          domain: "handover",
          name: "Bàn giao tri thức 5 bước",
          toolCount: 5,
          summary:
            "Rà soát mức độ sẵn sàng bàn giao, đóng gói minh chứng và thực hiện quy trình ký nhận A → D → B.",
        },
        {
          code: "05",
          domain: "sag-knowledge",
          name: "Tìm kiếm tri thức lai SAG",
          toolCount: 2,
          summary:
            "Tìm kiếm kết hợp ngữ nghĩa + từ khóa theo từng dự án và hỏi đáp kỹ thuật kèm trích dẫn nguồn.",
        },
        {
          code: "06",
          domain: "chat-notifications",
          name: "Trò chuyện nhóm & thông báo",
          toolCount: 2,
          summary:
            "Xem hội thoại, tìm kiếm thảo luận kỹ thuật, gửi tin nhắn cập nhật tiến độ và quản lý thông báo.",
        },
      ],
      pipelineTitle: "Chu trình xử lý một lệnh gọi MCP",
      pipelineSubtitle:
        "Chọn từng chặng trên đường truyền để xem cách Continuum xác thực và thực thi yêu cầu từ AI Agent.",
      stages: [
        {
          id: "stage-host",
          step: "01",
          title: "IDE & AI Agent",
          protocolTag: "Antigravity · Claude Code · Cursor · VS Code · Windsurf",
          summary:
            "Lập trình viên giao yêu cầu ngay trong IDE. Máy khách MCP kết nối trực tiếp qua HTTPS mà không cần cài đặt dịch vụ trung gian cục bộ.",
          invariants: [
            "Không cần cài thêm tiến trình Python/Node phụ trợ trên các IDE hỗ trợ Streamable HTTP",
            "Tương thích phiên bản giao thức MCP 2025-03-26, 2025-06-18 và 2024-11-05",
            "Gửi header xác thực Authorization: Bearer ctm_mcp_<43-ký-tự-base64url>",
          ],
        },
        {
          id: "stage-transport",
          step: "02",
          title: "Giao vận Streamable HTTP JSON-RPC 2.0",
          protocolTag: "POST /api/v1/mcp · /api/backend/mcp",
          summary:
            "Tầng giao vận JSON-RPC 2.0 phi trạng thái xử lý initialize, tools/list, tools/call, resources/read và prompts/get kèm chính sách cache-control: no-store.",
          invariants: [
            "GET /api/v1/mcp trả về thông tin máy chủ (hoặc 405 với yêu cầu mở luồng SSE thụ động)",
            "Thông báo một chiều (notifications/initialized) trả về chuẩn 202 Accepted",
            "Next.js BFF (/api/backend/mcp) chuyển tiếp nguyên vẹn mcp-session-id và mcp-protocol-version",
          ],
        },
        {
          id: "stage-guard",
          step: "03",
          title: "Băm SHA-256 & kiểm tra RBAC trực tiếp",
          protocolTag: "IAM · từ chối mặc định (default-deny)",
          summary:
            "Khóa gốc được băm SHA-256 ngay trên bộ nhớ để đối chiếu với mcp_api_keys. Tư cách thành viên tổ chức, thời hạn khóa, tầng quyền và danh sách dự án cho phép được kiểm tra trên từng yêu cầu.",
          invariants: [
            "Chuỗi khóa gốc ctm_mcp_ không bao giờ lưu thô trong MongoDB hay nhật ký hệ thống",
            "Gỡ thành viên khỏi tổ chức hoặc dự án sẽ thu hồi quyền truy cập MCP ngay lập tức",
            "Các API REST thay đổi dữ liệu ngoài /api/v1/mcp đều từ chối khóa ctm_mcp_ (MCP_KEY_DIRECT_MUTATION_FORBIDDEN)",
          ],
        },
        {
          id: "stage-domains",
          step: "04",
          title: "Thực thi nghiệp vụ & cầu nối SAG",
          protocolTag: "ETag If-Match · cô lập đa tổ chức (multi-tenant)",
          summary:
            "Yêu cầu hợp lệ gọi trực tiếp tầng dịch vụ Continuum, tự động lấy ETag mới nhất trước khi ghi và cô lập truy vấn SAG trong đúng dự án đã xác thực.",
          invariants: [
            "Tự động đối chiếu ETag giúp tránh ghi đè mất dữ liệu khi người dùng và AI Agent cùng cập nhật",
            "Truy vấn SAG POST /api/v1/search và hỏi đáp luôn khóa chặt theo organizationId + projectId",
            "Dữ liệu trả về gọn và có cấu trúc rõ ràng để tiết kiệm ngữ cảnh token cho mô hình",
          ],
        },
      ],
    },
    quickstart: {
      subtitle:
        "Kết nối IDE hoặc CLI với Continuum trong chưa đầy một phút bằng khóa cá nhân chuẩn Streamable HTTP.",
      steps: [
        {
          step: "01",
          title: "Tạo khóa cá nhân ctm_mcp_",
          body: "Mở Tổ chức → Tích hợp (/organization/integrations), chọn tầng quyền READ_ONLY, READ_WRITE hoặc FULL_OPERATIONS, giới hạn dự án nếu cần và sao chép khóa bí mật hiển thị một lần.",
        },
        {
          step: "02",
          title: "Dán cấu hình vào IDE hoặc CLI",
          body: "Chọn công cụ lập trình bên dưới, chọn BFF cùng miền (/api/backend/mcp) hoặc API trực tiếp (/api/v1/mcp), rồi sao chép đoạn cấu hình vào tệp MCP tương ứng.",
        },
        {
          step: "03",
          title: "Kiểm tra kết nối & quyền truy cập",
          body: "Nhờ trợ lý AI gọi continuum_get_context hoặc continuum_list_projects để xác nhận vai trò hiện tại và danh sách dự án được phép truy cập.",
        },
      ],
      configuratorTitle: "Tạo cấu hình cho 7 máy khách MCP",
      configuratorSubtitle:
        "Chọn IDE/CLI và chế độ điểm cuối để sao chép đoạn cấu hình dùng ngay.",
    },
    security: {
      subtitle:
        "Mọi khóa Continuum MCP đều áp dụng băm mật mã một chiều, đối chiếu RBAC thời gian thực và giới hạn phạm vi theo từng dự án.",
      controls: [
        {
          code: "01",
          title: "Tiền tố ctm_mcp_ & mã băm một chiều SHA-256",
          body: "Khóa được sinh từ 32 byte ngẫu nhiên mật mã học dưới dạng ctm_mcp_<43-ký-tự-base64url>. Hệ thống chỉ lưu tiền tố nhận diện 16 ký tự và mã băm SHA-256 trong continuum_iam.",
        },
        {
          code: "02",
          title: "Đối chiếu RBAC trực tiếp (không lưu đệm quyền cũ)",
          body: "Khóa MCP không bao giờ cấp vượt quyền thực tế của người sở hữu. Mỗi yêu cầu đều lấy phần giao giữa tầng quyền của khóa, allowedProjectIds và vai trò hiện hành của người dùng.",
        },
        {
          code: "03",
          title: "Chặn gọi trực tiếp API REST ghi dữ liệu (MCP_KEY_DIRECT_MUTATION_FORBIDDEN)",
          body: "Khóa ctm_mcp_ bị từ chối nếu gọi trực tiếp các API REST thay đổi dữ liệu (POST, PATCH, DELETE) bên ngoài /api/v1/mcp, đảm bảo mọi thao tác ghi của AI Agent đều đi qua cổng kiểm tra quyền MCP.",
        },
        {
          code: "04",
          title: "Kiểm soát đồng thời bằng ETag (If-Match)",
          body: "Các dịch vụ công việc và bàn giao của Continuum bắt buộc đối chiếu phiên bản ETag khi cập nhật. Trình xử lý MCP tự động nạp phiên bản mới nhất và báo lỗi rõ ràng nếu xảy ra xung đột.",
        },
      ],
      tiersTitle: "3 tầng quyền truy cập & số lượng công cụ",
      tiers: [
        {
          scope: "READ_ONLY",
          title: "Chỉ đọc (Read Only)",
          badge: "READ_ONLY · 20 công cụ",
          summary:
            "Tra cứu ngữ cảnh dự án, công việc, sprint, ghi chú, toàn văn tài liệu, bàn giao và tìm kiếm SAG mà không thay đổi dữ liệu.",
          capabilities: [
            "Đọc ngữ cảnh tài khoản, dự án, thành viên, công việc, sprint, ghi chú, chi tiết tài liệu & báo cáo",
            "Chạy tìm kiếm lai SAG và hỏi đáp kỹ thuật kèm trích dẫn nguồn",
            "Xem phòng trò chuyện và số thông báo chưa đọc mà không làm đổi trạng thái",
          ],
        },
        {
          scope: "READ_WRITE",
          title: "Đọc & ghi công việc",
          badge: "READ_WRITE · 26 công cụ (+6 công cụ ghi)",
          summary:
            "Phục vụ công việc kỹ thuật hằng ngày: tạo, cập nhật, chuyển trạng thái công việc, lưu ghi chú kỹ thuật, lưu nháp báo cáo và đánh dấu thông báo.",
          capabilities: [
            "Bao gồm toàn bộ 20 công cụ của tầng READ_ONLY",
            "Tạo mới, cập nhật, chuyển trạng thái và bình luận trên công việc dự án (+4 công cụ)",
            "Tạo ghi chú kỹ thuật, lưu nháp báo cáo (submit: false) và đánh dấu đã đọc thông báo (+2 công cụ)",
          ],
        },
        {
          scope: "FULL_OPERATIONS",
          title: "Toàn quyền vận hành",
          badge: "FULL_OPERATIONS · Đủ 36 công cụ (+10 công cụ vận hành)",
          summary:
            "Mở khóa trọn bộ thao tác: tạo/sửa dự án, quản trị thành viên, tải tệp đính kèm, phê duyệt tài liệu/ghi chú/báo cáo, đồng bộ SAG, bàn giao 5 bước và gửi chat.",
          capabilities: [
            "Bao gồm toàn bộ 26 công cụ của tầng READ_WRITE",
            "Tạo/sửa dự án, thêm/gỡ thành viên & trưởng nhóm, tải tệp lên tài liệu, duyệt & đồng bộ SAG",
            "Tạo, đóng gói và thực hiện bàn giao tri thức 5 bước + gửi tin nhắn vào phòng chat",
          ],
        },
      ],
    },
    toolsExplorer: {
      subtitle:
        "Lọc 36 công cụ Continuum MCP theo phân hệ, tầng quyền tối thiểu hoặc từ khóa; mở từng công cụ để xem tham số đầu vào và mẫu JSON-RPC 2.0.",
      domainLabels: {
        "iam-projects": "IAM & dự án",
        "tasks-sprints": "Công việc & sprint",
        capture: "Ghi chú & báo cáo",
        handover: "Bàn giao",
        "sag-knowledge": "Tri thức SAG & AI",
        "chat-notifications": "Trò chuyện & thông báo",
      },
      hintLabels: {
        readOnly: "readOnlyHint",
        mutating: "ghi dữ liệu",
        idempotent: "idempotentHint",
        destructive: "destructiveHint",
      },
    },
    resourcesAndPrompts: {
      subtitle:
        "Bên cạnh 36 công cụ, Continuum cung cấp MCP Resources để nạp nhanh ngữ cảnh dự án và bộ Prompts dựng sẵn cho các tác vụ kỹ thuật lặp lại.",
      resourcesHeading: "MCP Resources & mẫu URI",
      resources: [
        {
          uri: "continuum://context/current",
          kind: "STATIC",
          mimeType: "application/json",
          title: "Ngữ cảnh người dùng & tổ chức hiện hành",
          description:
            "Bản chụp JSON trực tiếp chứa thông tin người dùng xác thực, tổ chức đang chọn, vai trò hiệu lực, tầng quyền MCP và danh sách allowedProjectIds.",
        },
        {
          uri: "continuum://projects/{projectId}/overview",
          kind: "TEMPLATE",
          mimeType: "application/json",
          title: "Tổng quan dự án & tiến độ sprint",
          description:
            "Mẫu tài nguyên có tham số trả về thông tin dự án, danh sách Trưởng nhóm được chỉ định, thống kê trạng thái công việc và danh sách sprint.",
        },
      ],
      promptsHeading: "MCP Prompts dựng sẵn (4)",
      prompts: [
        {
          name: "daily-standup-brief",
          argumentsSignature: "(projectId: string)",
          title: "Tóm tắt họp nhanh hằng ngày (daily standup)",
          description:
            "Tổng hợp các công việc đang làm, vướng mắc và ghi chú kỹ thuật gần nhất thành bản cập nhật standup có dẫn chứng.",
        },
        {
          name: "handover-readiness-audit",
          argumentsSignature: "(projectId: string, departingUserId?: string)",
          title: "Rà soát mức độ sẵn sàng bàn giao",
          description:
            "Rà soát các đầu việc còn dang dở, quyết định thiết kế chưa ghi chép và minh chứng còn thiếu trước khi tạo gói bàn giao A → D → B.",
        },
        {
          name: "task-triage-assistant",
          argumentsSignature: "(projectId: string)",
          title: "Hỗ trợ phân loại & sắp xếp ưu tiên backlog",
          description:
            "Đối chiếu các công việc tồn đọng trong backlog với tài liệu kiến trúc trên SAG để gợi ý độ ưu tiên, sprint và người phụ trách.",
        },
        {
          name: "project-onboarding-pack",
          argumentsSignature: "(projectId: string)",
          title: "Tài liệu hội nhập dự án cho thành viên mới",
          description:
            "Tổng hợp bức tranh kiến trúc, tiến độ sprint và các quyết định kỹ thuật trọng yếu kèm trích dẫn nguồn cho kỹ sư mới tham gia dự án.",
        },
      ],
      playbooksHeading: "Kịch bản phối hợp nhiều bước cho AI Agent",
      playbooksSubtitle:
        "Chuỗi lệnh gọi công cụ thực tế minh họa cách trợ lý IDE kết hợp các phân hệ Continuum.",
      playbooks: [
        {
          id: "playbook-bugfix",
          badge: "01 · Kỹ thuật hằng ngày",
          title: "Tìm nguyên nhân lỗi qua SAG + lưu ghi chú kỹ thuật + chuyển công việc sang IN_REVIEW",
          scenario:
            "Lập trình viên nhắn với Cursor hoặc Claude Code: \"Nhận task-104, tra trên SAG xem vì sao cơ chế xoay vòng token được thiết kế như vậy, sửa lỗi, lưu Work Note và chuyển task sang IN_REVIEW.\"",
          steps: [
            {
              tool: "continuum_get_task",
              detail: "Đọc mô tả yêu cầu, tiêu chí nghiệm thu và trạng thái hiện tại của task-104.",
            },
            {
              tool: "continuum_search_knowledge",
              detail: "Tìm các đoạn ghi chú kiến trúc (ADR) đã duyệt giải thích quy tắc xoay vòng refresh token.",
            },
            {
              tool: "continuum_create_work_note",
              detail: "Ghi lại phân tích nguyên nhân gốc và kết quả kiểm thử gắn với task-104.",
            },
            {
              tool: "continuum_transition_task",
              detail: "Chuyển task-104 sang IN_REVIEW và đính kèm mã commit qua continuum_add_task_comment.",
            },
          ],
        },
        {
          id: "playbook-handover",
          badge: "02 · Bàn giao tri thức (A → D → B)",
          title: "Rà soát công việc bàn giao + đóng gói minh chứng + hoàn tất bàn giao 5 bước",
          scenario:
            "Trưởng nhóm hoặc kỹ sư chuẩn bị chuyển vai trò lập gói bàn giao có cấu trúc để người kế nhiệm nắm rõ toàn bộ mạch quyết định kỹ thuật.",
          steps: [
            {
              tool: "continuum_preview_departing_handover",
              detail: "Liệt kê các công việc chưa hoàn tất và ghi chú đủ điều kiện đóng gói của thành viên bàn giao.",
            },
            {
              tool: "continuum_ask_knowledge",
              detail: "Kiểm tra các quyết định thiết kế quan trọng đã có trích dẫn đầy đủ trên kho SAG.",
            },
            {
              tool: "continuum_create_and_bundle_handover",
              detail: "Tạo và xuất bản gói bàn giao liên kết danh sách công việc, selectedSources và successorUserId.",
            },
            {
              tool: "continuum_act_on_handover",
              detail: "Gọi action: QUICK_TRANSFER_TASKS và QUICK_ACCEPT để chuyển giao đầu việc và xác nhận tiếp nhận.",
            },
          ],
        },
        {
          id: "playbook-standup",
          badge: "03 · Tổng kết tuần sprint",
          title: "Tổng hợp tiến độ sprint + lưu nháp báo cáo công việc + gửi tóm tắt vào nhóm chat",
          scenario:
            "Cuối tuần sprint, kỹ sư tổng hợp các hạng mục đã hoàn thành vào bản nháp báo cáo công việc và chia sẻ bản tóm tắt ngắn cho cả nhóm.",
          steps: [
            {
              tool: "continuum_get_project_task_summary",
              detail: "Thống kê số công việc hoàn thành, đang chờ duyệt và quá hạn trong dự án.",
            },
            {
              tool: "continuum_list_work_notes",
              detail: "Tập hợp các ghi chú kỹ thuật đã lưu trong kỳ sprint.",
            },
            {
              tool: "continuum_save_work_report_draft",
              detail: "Lưu bản nháp báo cáo Markdown để xem lại trước khi nộp chính thức.",
            },
            {
              tool: "continuum_chat",
              detail: "Gửi bản tóm tắt tiến độ vào phòng chat dự án với action: SEND_MESSAGE.",
            },
          ],
        },
      ],
    },
  },
};
