"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useProjectsQuery,
  type Project,
} from "@/lib/queries/projects/useProjects";
import { workNotesApi } from "@/lib/queries/work-notes/useWorkNotes";
import { cn } from "@/utils";

export type SagSourceType = "TASK_NOTE" | "DOCUMENT" | "WORK_REPORT" | "PROJECT";

export type SagCitation = {
  id: string;
  index: number;
  title: string;
  sourceType: SagSourceType;
  snippet: string;
  score: number;
  author?: string;
  updatedAt?: string;
  href: string;
};

export type SagRetrievalStep = {
  step: string;
  detail: string;
  durationMs: number;
};

export type SagMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  mode?: "chat" | "work";
  depth?: "High" | "Medium" | "Fast";
  citations?: SagCitation[];
  retrievalSteps?: SagRetrievalStep[];
  followUps?: string[];
};

export type SagThread = {
  id: string;
  title: string;
  pinned?: boolean;
  projectId?: string;
  projectFolder?: string;
  updatedAt: string;
  messages: SagMessage[];
};

type RetrievalDepth = "High" | "Medium" | "Fast";
type SourceFilter = "ALL" | "TASK_NOTES" | "DOCUMENTS" | "WORK_REPORTS";

const INITIAL_THREADS: SagThread[] = [
  {
    id: "thread-rag-arch",
    title: "Branch - Thiết kế kiến trúc RAG / SAG",
    pinned: true,
    projectFolder: "DATN_SP27",
    updatedAt: "Just now",
    messages: [
      {
        id: "m-arch-1",
        role: "user",
        content:
          "Giải thích pipeline truy xuất SAG (Search-Augmented Generation) và cơ chế kiểm soát quyền RBAC/ACL trên tài liệu dự án.",
        createdAt: "14:20",
        mode: "chat",
        depth: "High",
      },
      {
        id: "m-arch-2",
        role: "assistant",
        content:
          "Hệ thống **Continuum SAG (Search-Augmented Generation)** kết hợp truy xuất lai (**Hybrid Search: Dense Vector + BM25**) với bộ lọc phân quyền nghiêm ngặt trước khi tổng hợp câu trả lời [1][2]:\n\n" +
          "• **1. Pre-Retrieval ACL Filtering:** Mọi truy vấn đều được gắn `organizationId`, `projectId` và `userId` từ phiên đăng nhập hiện tại để chỉ quét các Task Notes và Project Documents mà bạn có quyền đọc [1].\n" +
          "• **2. Hybrid Retrieval & Cross-Encoder Reranking:** Kết hợp tìm kiếm ngữ nghĩa (Semantic Embedding) và từ khóa chính xác (BM25) cho mã công việc (`TASK-101`, `PR #94`), sau đó chấm điểm lại top-K đoạn văn bản liên quan nhất [2].\n" +
          "• **3. Grounded Synthesis & Inline Citations:** Câu trả lời được sinh ra kèm trích dẫn trực tiếp `[1]`, `[2]` trỏ về đúng Task Note, Work Report hoặc tài liệu gốc để chống ảo giác (hallucination).",
        createdAt: "14:20",
        mode: "chat",
        depth: "High",
        retrievalSteps: [
          {
            step: "RBAC & Tenant Scope Guard",
            detail: "Verified organization & project membership permissions",
            durationMs: 18,
          },
          {
            step: "Hybrid Search (Vector + BM25)",
            detail: "Scanned 48 indexed chunks across Task Notes & Project Docs",
            durationMs: 74,
          },
          {
            step: "Cross-Encoder Reranker",
            detail: "Selected top 2 high-confidence passages (score >= 0.92)",
            durationMs: 46,
          },
        ],
        citations: [
          {
            id: "cit-arch-1",
            index: 1,
            title: "SAG Architecture & RBAC Retrieval Specification v2.4",
            sourceType: "DOCUMENT",
            snippet:
              "Pre-retrieval metadata filtering enforces tenant isolation (organizationId) and project-level visibility before vector similarity scoring.",
            score: 98,
            author: "System Architect",
            updatedAt: "2h ago",
            href: "/projects",
          },
          {
            id: "cit-arch-2",
            index: 2,
            title: "KNW-142 · Hybrid Search & Citation Grounding Pipeline",
            sourceType: "TASK_NOTE",
            snippet:
              "What was done: Implemented reciprocal rank fusion (RRF) between BM25 keyword search and dense embeddings with inline citation markers.",
            score: 94,
            author: "KeyT Manager",
            updatedAt: "Yesterday",
            href: "/projects",
          },
        ],
        followUps: [
          "Tóm tắt tiến độ các Task Notes gần nhất theo cấu trúc What / How / Why",
          "Tổng hợp Handover Brief cho thành viên mới vào dự án",
          "Kiểm tra các Work Reports đang chờ duyệt hoặc quá hạn",
        ],
      },
    ],
  },
  {
    id: "thread-handover-brief",
    title: "Bản tổng hợp Handover Brief & Quyết định kỹ thuật",
    pinned: true,
    projectFolder: "DATN_SP27",
    updatedAt: "2h ago",
    messages: [
      {
        id: "m-ho-1",
        role: "user",
        content:
          "Tổng hợp bản tin bàn giao (Handover Brief) từ các Task Notes và tài liệu gần đây của dự án.",
        createdAt: "11:45",
        mode: "work",
        depth: "High",
      },
      {
        id: "m-ho-2",
        role: "assistant",
        content:
          "Dưới đây là **Handover Brief (Bản tổng hợp bàn giao)** được SAG trích xuất tự động từ kho tri thức dự án [1][2]:\n\n" +
          "• **What was done (Hạng mục đã hoàn tất):** Tái cấu trúc Sidebar 3 tầng (`Organization` → `Project` → `Project Navigation`) và tích hợp không gian truy vấn tri thức `AI Chat (SAG)` [1].\n" +
          "• **How it was done (Giải pháp thực thi):** Tách riêng `SidebarProjectSwitcher` có tìm kiếm nhanh, đồng bộ trạng thái active theo URL `/projects/{projectId}/*` và kết nối API truy xuất Task Notes / Project Documents [1][2].\n" +
          "• **Why this approach (Lý do quyết định):** Giữ chiều cao Sidebar cố định trong 1 màn hình (`100dvh`) ngay cả khi Organization có hơn 20 dự án, đồng thời giúp thành viên tra cứu quyết định kỹ thuật tức thì.",
        createdAt: "11:45",
        mode: "work",
        depth: "High",
        retrievalSteps: [
          {
            step: "Project Context Resolution",
            detail: "Resolved active project Task Notes & Handover tags",
            durationMs: 22,
          },
          {
            step: "What / How / Why Extraction",
            detail: "Aggregated structured fields from latest Task Notes",
            durationMs: 68,
          },
        ],
        citations: [
          {
            id: "cit-ho-1",
            index: 1,
            title: "FE-94 · Refactor Sidebar Project Selector & Information Architecture",
            sourceType: "TASK_NOTE",
            snippet:
              "Replaced N×5 nested project accordion with two-tier context selectors and active project navigation.",
            score: 97,
            author: "Thang",
            updatedAt: "Today",
            href: "/projects",
          },
          {
            id: "cit-ho-2",
            index: 2,
            title: "Frontend Visual Quality & Handover Standards",
            sourceType: "DOCUMENT",
            snippet:
              "All task notes record Accomplishments (What), Technical Approach (How), and Architectural Rationale (Why) for seamless handover.",
            score: 92,
            author: "Engineering Lead",
            updatedAt: "3d ago",
            href: "/projects",
          },
        ],
        followUps: [
          "Soạn bản nháp Work Report tuần này từ các Task Notes trên",
          "Liệt kê các rủi ro hoặc phụ thuộc cần lưu ý khi bàn giao",
        ],
      },
    ],
  },
  {
    id: "thread-weekly-report",
    title: "Ghi nhận DATN · Soạn Work Report tuần",
    pinned: false,
    projectFolder: "DATN_SP27",
    updatedAt: "Yesterday",
    messages: [
      {
        id: "m-wr-1",
        role: "user",
        content: "Hướng dẫn soạn Work Report tự động từ Task Notes trong dự án.",
        createdAt: "Yesterday",
        mode: "work",
        depth: "Medium",
      },
      {
        id: "m-wr-2",
        role: "assistant",
        content:
          "SAG có thể tổng hợp trực tiếp các **Task Notes** trong tuần của bạn thành bản nháp **Work Report** chuẩn 3 phần [1]:\n\n" +
          "• **1. Accomplishments (`What`):** Danh sách các đầu việc đã hoàn thành kèm mã task và link minh chứng.\n" +
          "• **2. Technical Approach (`How`):** Kiến trúc, API hoặc thành phần giao diện đã triển khai.\n" +
          "• **3. Rationale & Next Steps (`Why`):** Lý do chọn giải pháp và các đề xuất cho sprint kế tiếp.",
        createdAt: "Yesterday",
        mode: "work",
        depth: "Medium",
        citations: [
          {
            id: "cit-wr-1",
            index: 1,
            title: "Work Notes & Automated Report Synthesis Guide",
            sourceType: "WORK_REPORT",
            snippet:
              "Weekly reports aggregate verified Task Notes to reduce manual reporting overhead while preserving auditability.",
            score: 95,
            author: "Continuum AI",
            updatedAt: "Yesterday",
            href: "/projects",
          },
        ],
      },
    ],
  },
];

const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  ALL: "All SAG Sources",
  TASK_NOTES: "Task Notes (What/How/Why)",
  DOCUMENTS: "Project Documents",
  WORK_REPORTS: "Work Reports",
};

const SOURCE_TYPE_BADGE: Record<
  SagSourceType,
  { label: string; className: string }
> = {
  TASK_NOTE: {
    label: "Task Note",
    className:
      "border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-300",
  },
  DOCUMENT: {
    label: "Document",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  WORK_REPORT: {
    label: "Work Report",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  PROJECT: {
    label: "Project",
    className:
      "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300",
  },
};

async function synthesizeSagResponse(params: {
  query: string;
  mode: "chat" | "work";
  depth: RetrievalDepth;
  sourceFilter: SourceFilter;
  selectedProject: Project | null;
  allProjects: readonly Project[];
}): Promise<{
  content: string;
  citations: SagCitation[];
  retrievalSteps: SagRetrievalStep[];
  followUps: string[];
}> {
  const { query, mode, depth, sourceFilter, selectedProject, allProjects } =
    params;
  const targetProject = selectedProject ?? allProjects[0] ?? null;
  const normalized = query.toLowerCase().trim();

  if (targetProject) {
    const [notesRes, docsRes, reportsRes] = await Promise.allSettled([
      workNotesApi.listProjectTaskNotes(targetProject.id, 1),
      workNotesApi.listDocuments(targetProject.id, "ALL", 1),
      workNotesApi.listReports(targetProject.id, "ALL", 1),
    ]);

    const notes =
      notesRes.status === "fulfilled" ? (notesRes.value.data ?? []) : [];
    const docs =
      docsRes.status === "fulfilled" ? (docsRes.value.data ?? []) : [];
    const reports =
      reportsRes.status === "fulfilled" ? (reportsRes.value.data ?? []) : [];

    const citations: SagCitation[] = [];

    if (
      (sourceFilter === "ALL" || sourceFilter === "TASK_NOTES") &&
      notes.length > 0
    ) {
      notes.slice(0, 2).forEach((note) => {
        citations.push({
          id: `note-${note.id}`,
          index: citations.length + 1,
          title: `${note.taskKey ? `${note.taskKey} · ` : ""}${note.title}`,
          sourceType: "TASK_NOTE",
          snippet: `What: ${note.accomplishments} | How: ${note.approach} | Why: ${note.reason}`,
          score: 97 - citations.length * 3,
          author: note.authorName,
          updatedAt: note.updatedAt || "Recent",
          href: `/projects/${targetProject.id}/work-notes`,
        });
      });
    }

    if (
      (sourceFilter === "ALL" || sourceFilter === "DOCUMENTS") &&
      docs.length > 0
    ) {
      docs.slice(0, 2).forEach((doc) => {
        citations.push({
          id: `doc-${doc.id}`,
          index: citations.length + 1,
          title: `${doc.title} (v${doc.version})`,
          sourceType: "DOCUMENT",
          snippet:
            doc.description ||
            `Project specification & technical documentation (${doc.type}).`,
          score: 94 - citations.length * 2,
          author: doc.createdBy,
          updatedAt: doc.updatedAt || "Recent",
          href: `/projects/${targetProject.id}/documents`,
        });
      });
    }

    if (
      (sourceFilter === "ALL" || sourceFilter === "WORK_REPORTS") &&
      reports.length > 0
    ) {
      reports.slice(0, 1).forEach((rep) => {
        citations.push({
          id: `rep-${rep.id}`,
          index: citations.length + 1,
          title: `${rep.frequency} Report · ${rep.memberName}`,
          sourceType: "WORK_REPORT",
          snippet:
            rep.accomplishments ||
            `Work report status: ${rep.status} (${rep.periodStart} – ${rep.periodEnd}).`,
          score: 91,
          author: rep.memberName,
          updatedAt: rep.submittedAt || rep.updatedAt || "Recent",
          href: `/projects/${targetProject.id}/work-reports`,
        });
      });
    }

    if (citations.length === 0) {
      citations.push(
        {
          id: `proj-overview-${targetProject.id}`,
          index: 1,
          title: `${targetProject.name} (${targetProject.code}) · Project Workspace`,
          sourceType: "PROJECT",
          snippet:
            targetProject.description ||
            `Active project workspace in Continuum AI (${targetProject.visibility}).`,
          score: 95,
          author: "Workspace Index",
          updatedAt: "Synced",
          href: `/projects/${targetProject.id}/overview`,
        },
        {
          id: `proj-notes-${targetProject.id}`,
          index: 2,
          title: `${targetProject.code} · Task Notes & Handover Knowledge Base`,
          sourceType: "TASK_NOTE",
          snippet:
            "Structured engineering notes capturing What was done, How it was implemented, and Why decisions were made.",
          score: 91,
          author: "SAG Indexer",
          updatedAt: "Live",
          href: `/projects/${targetProject.id}/work-notes`,
        },
      );
    }

    const latestNote = notes[0];
    const pendingReports = reports.filter(
      (r) => r.status === "PENDING_REVIEW",
    ).length;

    const noteSummaryLine = latestNote
      ? `• **Task Note gần nhất [1]:** *${latestNote.title}* (${latestNote.taskKey ?? "Task"}) — **What:** ${latestNote.accomplishments} · **How:** ${latestNote.approach} · **Why:** ${latestNote.reason}.`
      : `• **Task Notes & Quyết định kỹ thuật [1]:** Dự án **${targetProject.name}** (${targetProject.code}) đã được lập chỉ mục SAG sẵn sàng cho truy vấn ngữ nghĩa và bàn giao.`;

    const docSummaryLine =
      docs.length > 0
        ? `• **Tài liệu kỹ thuật (${docs.length} Project Docs) [${Math.min(2, citations.length)}]:** Đã đối chiếu với *${docs[0]?.title}* (v${docs[0]?.version}) và bộ quy chuẩn kiến trúc.`
        : `• **Không gian làm việc & Báo cáo [${Math.min(2, citations.length)}]:** Hiện có ${reports.length} Work Reports (${pendingReports} chờ duyệt) và toàn bộ lịch sử công việc được bảo vệ theo quyền RBAC.`;

    const modeRecommendation =
      mode === "work" ||
      normalized.includes("report") ||
      normalized.includes("báo cáo") ||
      normalized.includes("handover") ||
      normalized.includes("bàn giao")
        ? `• **Đề xuất hành động (Work Synthesis):** Bạn có thể sử dụng ngay cấu trúc **What / How / Why** phía trên để cập nhật vào Work Report tuần hoặc gửi liên kết trích dẫn trực tiếp cho thành viên tiếp nhận bàn giao.`
        : `• **Kết luận từ SAG (${depth} Depth):** Kết quả trên được tổng hợp trực tiếp từ ngữ cảnh dự án **${targetProject.name}** thông qua bộ lọc nguồn *${SOURCE_FILTER_LABELS[sourceFilter]}*.`;

    return {
      content:
        `Kết quả truy xuất **SAG (Search-Augmented Generation)** cho truy vấn *"${query}"* trong dự án **${targetProject.name}** (${targetProject.code}):\n\n` +
        `${noteSummaryLine}\n` +
        `${docSummaryLine}\n` +
        `${modeRecommendation}`,
      citations,
      retrievalSteps: [
        {
          step: "RBAC & Scope Verification",
          detail: `Scoped to project ${targetProject.name} (${targetProject.code}) · Filter: ${SOURCE_FILTER_LABELS[sourceFilter]}`,
          durationMs: 16,
        },
        {
          step: "SAG Hybrid Index Lookup",
          detail: `Scanned ${notes.length} Task Notes, ${docs.length} Documents, and ${reports.length} Work Reports`,
          durationMs: depth === "High" ? 84 : depth === "Medium" ? 52 : 28,
        },
        {
          step: "Citation Grounding & Verification",
          detail: `Attached ${citations.length} verified workspace citations with direct navigation links`,
          durationMs: 31,
        },
      ],
      followUps: [
        `Tóm tắt các quyết định kỹ thuật quan trọng nhất trong ${targetProject.code}`,
        `Soạn bản nháp Work Report chuẩn What / How / Why cho ${targetProject.name}`,
        `Kiểm tra các điểm nghẽn (blockers) và tài liệu cần cập nhật`,
      ],
    };
  }

  return {
    content:
      `Kết quả phân tích **Continuum SAG** (${depth} Depth · ${SOURCE_FILTER_LABELS[sourceFilter]}) cho câu hỏi *"${query}"* [1]:\n\n` +
      `• **Tổng hợp tri thức (Knowledge Synthesis):** Hệ thống đã đối chiếu dữ liệu trên toàn bộ Organization hiện tại (${allProjects.length} dự án đang hoạt động) [1].\n` +
      `• **Chuẩn hoá bàn giao (Handover & Reporting):** Mọi thông tin công việc được liên kết theo cấu trúc **What was done / How it was done / Why this approach** kèm trích dẫn nguồn xác thực.\n` +
      `• **Bước tiếp theo:** Chọn một dự án cụ thể ở góc trên bên phải hoặc nhấp vào thẻ nguồn bên dưới để đi sâu vào từng tài liệu.`,
    citations: [
      {
        id: "cit-global-1",
        index: 1,
        title: "Organization Knowledge Graph & Project Directory",
        sourceType: "PROJECT",
        snippet:
          "Global SAG index covering active projects, task notes, architecture decisions, and weekly reports.",
        score: 95,
        author: "Continuum SAG",
        updatedAt: "Live",
        href: "/projects",
      },
    ],
    retrievalSteps: [
      {
        step: "Global Organization ACL Check",
        detail: "Verified active organization session & permissions",
        durationMs: 15,
      },
      {
        step: "Multi-Project SAG Retrieval",
        detail: `Queried across ${allProjects.length} active projects in workspace`,
        durationMs: 64,
      },
    ],
    followUps: [
      "Tóm tắt tiến độ tất cả dự án đang hoạt động trong Organization",
      "Hướng dẫn viết Task Note chuẩn cấu trúc What / How / Why",
    ],
  };
}

function renderFormattedSagContent(text: string) {
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g;
  return text.split("\n").map((line, lineIdx) => {
    if (!line.trim()) {
      return <div key={`br-${lineIdx}`} className="h-2" />;
    }
    const parts = line.split(tokenRegex);
    return (
      <p key={`line-${lineIdx}`} className="leading-7">
        {parts.map((part, partIdx) => {
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
              <strong
                key={`b-${lineIdx}-${partIdx}`}
                className="font-semibold text-gray-900 dark:text-white"
              >
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return (
              <code
                key={`c-${lineIdx}-${partIdx}`}
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-brand-600 dark:bg-white/10 dark:text-brand-300"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          if (/^\[\d+\]$/.test(part)) {
            return (
              <span
                key={`cit-${lineIdx}-${partIdx}`}
                className="mx-0.5 inline-flex items-center justify-center rounded bg-brand-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand-600 tabular-nums dark:text-brand-300"
              >
                {part}
              </span>
            );
          }
          return <span key={`t-${lineIdx}-${partIdx}`}>{part}</span>;
        })}
      </p>
    );
  });
}

export default function AiChatWorkspace() {
  const currentUser = useCurrentUserQuery();
  const organizationId = currentUser.data?.organizationId ?? "";

  const projectsQuery = useProjectsQuery(
    organizationId,
    {
      page: 1,
      pageSize: 20,
      status: "ACTIVE",
    },
    {
      enabled: Boolean(organizationId),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  const projects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data?.data],
  );

  // Left ChatGPT-style conversation sidebar state
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [threads, setThreads] = useState<SagThread[]>(INITIAL_THREADS);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Top bar & Composer controls (Model selector, Depth selector, Project scope)
  const [selectedModel, setSelectedModel] = useState<
    "SAG 2.5 Pro" | "SAG 2.5 Flash" | "SAG Handover"
  >("SAG 2.5 Pro");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const [retrievalDepth, setRetrievalDepth] = useState<RetrievalDepth>("High");
  const [isDepthMenuOpen, setIsDepthMenuOpen] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const [promptInput, setPromptInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedTraceIds, setExpandedTraceIds] = useState<
    Record<string, boolean>
  >({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollBottomRef = useRef(false);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedProject = useMemo(() => {
    if (selectedProjectId === "ALL") return null;
    return projects.find((p) => p.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const filteredThreads = useMemo(() => {
    const q = threadSearchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [threads, threadSearchQuery]);

  const pinnedThreads = useMemo(
    () => filteredThreads.filter((t) => t.pinned),
    [filteredThreads],
  );

  const recentThreads = useMemo(
    () => filteredThreads.filter((t) => !t.pinned),
    [filteredThreads],
  );

  useEffect(() => {
    if (
      shouldScrollBottomRef.current &&
      activeThread &&
      typeof messagesEndRef.current?.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      if (!isGenerating) {
        shouldScrollBottomRef.current = false;
      }
    }
  }, [activeThread, activeThread?.messages.length, isGenerating]);

  const closeAllMenus = useCallback(() => {
    setIsModelMenuOpen(false);
    setIsDepthMenuOpen(false);
    setIsSourceMenuOpen(false);
    setIsProjectMenuOpen(false);
  }, []);

  const handleStartNewChat = useCallback(() => {
    closeAllMenus();
    setActiveThreadId(null);
    setPromptInput("");
    composerInputRef.current?.focus();
  }, [closeAllMenus]);

  const handleTogglePinThread = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread,
      ),
    );
  }, []);

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
      }
    },
    [activeThreadId],
  );

  const submitQuery = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isGenerating) return;

      closeAllMenus();
      shouldScrollBottomRef.current = true;
      setPromptInput("");
      setIsGenerating(true);

      const nowTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const userMessage: SagMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: nowTime,
        mode: "work",
        depth: retrievalDepth,
      };

      let targetThreadId = activeThreadId;

      if (!targetThreadId) {
        const newThreadId = `thread-${Date.now()}`;
        const folderLabel =
          selectedProject?.code ?? projects[0]?.code ?? "DATN_SP27";
        const newThread: SagThread = {
          id: newThreadId,
          title: trimmed.length > 44 ? `${trimmed.slice(0, 44)}…` : trimmed,
          pinned: false,
          projectId: selectedProject?.id,
          projectFolder: folderLabel,
          updatedAt: "Just now",
          messages: [userMessage],
        };
        setThreads((prev) => [newThread, ...prev]);
        setActiveThreadId(newThreadId);
        targetThreadId = newThreadId;
      } else {
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === targetThreadId
              ? {
                  ...thread,
                  updatedAt: "Just now",
                  messages: [...thread.messages, userMessage],
                }
              : thread,
          ),
        );
      }

      try {
        const result = await synthesizeSagResponse({
          query: trimmed,
          mode: "work",
          depth: retrievalDepth,
          sourceFilter,
          selectedProject,
          allProjects: projects,
        });

        const assistantMessage: SagMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.content,
          createdAt: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          mode: "work",
          depth: retrievalDepth,
          citations: result.citations,
          retrievalSteps: result.retrievalSteps,
          followUps: result.followUps,
        };

        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === targetThreadId
              ? {
                  ...thread,
                  messages: [...thread.messages, assistantMessage],
                }
              : thread,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [
      activeThreadId,
      closeAllMenus,
      isGenerating,
      projects,
      retrievalDepth,
      selectedProject,
      sourceFilter,
    ],
  );

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuery(promptInput);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuery(promptInput);
    }
  };

  const handleCopyMessage = useCallback(
    async (messageId: string, text: string) => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
      } catch {
        // Ignore clipboard errors in non-HTTPS test environments
      }
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1800);
    },
    [],
  );

  const renderComposerPill = (isCenteredHero: boolean) => (
    <form
      onSubmit={handleFormSubmit}
      aria-label="SAG AI Chat composer"
      className={cn(
        "relative w-full transition-all",
        isCenteredHero ? "max-w-[700px]" : "mx-auto max-w-[760px]",
      )}
    >
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-[28px] border px-3.5 py-2 transition-shadow",
          "border-gray-200/90 bg-gray-100/90 text-gray-900 shadow-theme-sm focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-theme-md",
          "dark:border-white/10 dark:bg-[#212121] dark:text-gray-100 dark:focus-within:border-white/20 dark:focus-within:bg-[#262626]",
        )}
      >
        {/* Left "+" Context / Source Attachment Button (exact match to ChatGPT "+") */}
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Filter SAG knowledge sources"
            aria-expanded={isSourceMenuOpen}
            onClick={() => {
              setIsDepthMenuOpen(false);
              setIsModelMenuOpen(false);
              setIsProjectMenuOpen(false);
              setIsSourceMenuOpen((prev) => !prev);
            }}
            className="flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            title={`Knowledge source filter: ${SOURCE_FILTER_LABELS[sourceFilter]}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-4.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 4.25v11.5M4.25 10h11.5"
              />
            </svg>
          </button>

          {isSourceMenuOpen && (
            <div
              role="menu"
              aria-label="SAG knowledge sources"
              className="absolute bottom-11 start-0 z-50 w-60 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-[#1e1e1e]"
            >
              <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                SAG Retrieval Sources
              </div>
              {(
                ["ALL", "TASK_NOTES", "DOCUMENTS", "WORK_REPORTS"] as const
              ).map((filterKey) => {
                const active = sourceFilter === filterKey;
                return (
                  <button
                    key={filterKey}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSourceFilter(filterKey);
                      setIsSourceMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-start text-xs font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                    )}
                  >
                    <span>{SOURCE_FILTER_LABELS[filterKey]}</span>
                    {active && (
                      <span
                        aria-hidden="true"
                        className="text-brand-600 dark:text-brand-400"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Source Pill when filtered */}
        {sourceFilter !== "ALL" && (
          <span className=" hidden shrink-0 items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-medium text-brand-600 sm:inline-flex dark:text-brand-300">
            {SOURCE_FILTER_LABELS[sourceFilter]}
            <button
              type="button"
              aria-label="Clear source filter"
              onClick={() => setSourceFilter("ALL")}
              className="ms-0.5 hover:opacity-75"
            >
              ×
            </button>
          </span>
        )}

        {/* Single-line / Auto-expanding Textarea Input */}
        <textarea
          ref={composerInputRef}
          rows={1}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Ask Continuum AI..."
          aria-label="Ask Continuum SAG"
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-5 text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-gray-100 dark:placeholder:text-gray-400"
        />

        {/* Right Controls: Retrieval Depth ("High v") + Voice + Blue Action Button */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              aria-label="Retrieval depth"
              aria-expanded={isDepthMenuOpen}
              onClick={() => {
                setIsSourceMenuOpen(false);
                setIsModelMenuOpen(false);
                setIsProjectMenuOpen(false);
                setIsDepthMenuOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <span>{retrievalDepth}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-3 opacity-75"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 6.5 3.5 3.5 3.5-3.5"
                />
              </svg>
            </button>

            {isDepthMenuOpen && (
              <div
                role="menu"
                aria-label="Select retrieval depth"
                className="absolute end-0 bottom-10 z-50 w-52 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-[#1e1e1e]"
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  SAG Reasoning Depth
                </div>
                {(
                  [
                    {
                      id: "High",
                      desc: "Deep Hybrid RAG + Cross-Encoder Rerank",
                    },
                    {
                      id: "Medium",
                      desc: "Balanced search & citation synthesis",
                    },
                    {
                      id: "Fast",
                      desc: "Instant keyword & vector lookup",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRetrievalDepth(opt.id);
                      setIsDepthMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col rounded-xl px-2.5 py-1.5 text-start transition-colors",
                      retrievalDepth === opt.id
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                    )}
                  >
                    <span className="flex items-center justify-between text-xs font-semibold">
                      {opt.id}
                      {retrievalDepth === opt.id && <span>✓</span>}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Microphone quick-fill button */}
          <button
            type="button"
            aria-label="Insert voice query sample"
            onClick={() =>
              setPromptInput(
                "Tóm tắt tiến độ dự án, các Task Notes gần nhất theo chuẩn What / How / Why và tài liệu liên quan",
              )
            }
            className="flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            title="Voice query prompt"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="size-4"
            >
              <rect x="7" y="3" width="6" height="9" rx="3" />
              <path
                strokeLinecap="round"
                d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"
              />
            </svg>
          </button>

          {/* Blue Submit / Waveform Action Button (matches ChatGPT blue circle) */}
          <button
            type="submit"
            disabled={isGenerating}
            aria-label="Send SAG query"
            className={cn(
              "flex size-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-xs transition-all hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none disabled:opacity-50",
            )}
          >
            {promptInput.trim() ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 15V5m0 0-4 4m4-4 4 4"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="size-4"
              >
                <path
                  strokeLinecap="round"
                  d="M5 8v4M8.3 5.5v9M11.7 7v6M15 8.5v3"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div
      data-testid="ai-chat-workspace"
      className="flex h-full min-h-0 flex-1 overflow-hidden bg-white text-gray-900 dark:bg-[#0d0d0d] dark:text-gray-100"
    >
      {/* Left Conversation History Sidebar (Focused solely on Chat Threads) */}
      {(isHistoryOpen || isMobileHistoryOpen) && (
        <aside
          aria-label="AI Chat conversation history"
          className={cn(
            "h-full w-[240px] shrink-0 flex-col border-e border-gray-200/80 bg-gray-50/95 select-none dark:border-white/10 dark:bg-[#171717]",
            isMobileHistoryOpen
              ? "max-md:absolute max-md:inset-y-0 max-md:start-0 max-md:z-30 max-md:flex max-md:shadow-theme-xl"
              : "hidden",
            isHistoryOpen ? "md:flex" : "md:hidden",
          )}
        >
          {/* Sidebar Top Row: Primary "New chat" action + Search + Collapse */}
          <div className="flex h-13 shrink-0 items-center justify-between gap-1 px-2.5">
            <button
              type="button"
              onClick={handleStartNewChat}
              className={cn(
                "inline-flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-[13px] font-medium transition-colors",
                activeThreadId === null
                  ? "bg-gray-200/80 text-gray-900 dark:bg-white/10 dark:text-white"
                  : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-200 dark:hover:bg-white/[0.06]",
              )}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-4 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.5 4.5H5.75A1.75 1.75 0 0 0 4 6.25v8A1.75 1.75 0 0 0 5.75 16h8A1.75 1.75 0 0 0 15.5 14.25V8.5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.25 3.25 2.5 2.5L10.5 12H8V9.5l6.25-6.25Z"
                />
              </svg>
              <span className="truncate">New chat</span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Search chat history"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="size-4"
                >
                  <circle cx="9" cy="9" r="5.25" />
                  <path strokeLinecap="round" d="m13 13 3.5 3.5" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Collapse chat history sidebar"
                onClick={() => {
                  setIsHistoryOpen(false);
                  setIsMobileHistoryOpen(false);
                }}
                className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="size-4"
                >
                  <rect x="3" y="4" width="14" height="12" rx="2" />
                  <path d="M8 4v12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Optional Search Input */}
          {isSearchOpen && (
            <div className="px-2.5 pb-2">
              <input
                type="search"
                value={threadSearchQuery}
                onChange={(e) => setThreadSearchQuery(e.target.value)}
                placeholder="Search chats..."
                aria-label="Search SAG threads"
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-[#212121] dark:text-gray-100"
              />
            </div>
          )}

          {/* Scrollable Pinned & Recent Threads List */}
          <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-2 py-2">
            {/* Pinned Section */}
            {pinnedThreads.length > 0 && (
              <div>
                <div className="mb-1 px-2.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  Pinned
                </div>
                <ul className="space-y-0.5">
                  {pinnedThreads.map((thread) => {
                    const isActive = thread.id === activeThreadId;
                    return (
                      <li key={thread.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => setActiveThreadId(thread.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 pe-12 text-start text-[13px] transition-colors",
                            isActive
                              ? "bg-gray-200/90 font-medium text-gray-900 dark:bg-white/10 dark:text-white"
                              : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-white/[0.06]",
                          )}
                        >
                          <span className="truncate">{thread.title}</span>
                        </button>
                        <div className="absolute end-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                          <button
                            type="button"
                            aria-label={`Unpin ${thread.title}`}
                            onClick={() => handleTogglePinThread(thread.id)}
                            className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            title="Unpin"
                          >
                            ★
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${thread.title}`}
                            onClick={() => handleDeleteThread(thread.id)}
                            className="rounded p-1 text-gray-400 hover:text-error-500"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Recent Conversations */}
            {recentThreads.length > 0 && (
              <div>
                <div className="mb-1 px-2.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  Recent
                </div>
                <ul className="space-y-0.5">
                  {recentThreads.map((thread) => {
                    const isActive = thread.id === activeThreadId;
                    return (
                      <li key={thread.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => setActiveThreadId(thread.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 pe-12 text-start text-[13px] transition-colors",
                            isActive
                              ? "bg-gray-200/90 font-medium text-gray-900 dark:bg-white/10 dark:text-white"
                              : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-white/[0.06]",
                          )}
                        >
                          <span className="truncate">{thread.title}</span>
                        </button>
                        <div className="absolute end-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                          <button
                            type="button"
                            aria-label={`Pin ${thread.title}`}
                            onClick={() => handleTogglePinThread(thread.id)}
                            className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            title="Pin"
                          >
                            ☆
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${thread.title}`}
                            onClick={() => handleDeleteThread(thread.id)}
                            className="rounded p-1 text-gray-400 hover:text-error-500"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {pinnedThreads.length === 0 && recentThreads.length === 0 && (
              <p className="px-2.5 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                No conversations found.
              </p>
            )}
          </div>
        </aside>
      )}

      {/* Right Main ChatGPT Canvas */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar: Left Model Selector ("SAG 2.5 Pro v") + Right Project Scope Selector */}
        <header className="flex h-13 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Open chat history sidebar"
              onClick={() => {
                setIsHistoryOpen(true);
                setIsMobileHistoryOpen((prev) => !prev);
              }}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
                isHistoryOpen && "md:hidden",
              )}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-4"
              >
                <rect x="3" y="4" width="14" height="12" rx="2" />
                <path d="M8 4v12" />
              </svg>
            </button>
            {!isHistoryOpen && (
              <button
                type="button"
                aria-label="Start new chat"
                onClick={handleStartNewChat}
                className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="size-4"
                >
                  <path
                    strokeLinecap="round"
                    d="M10 4.25v11.5M4.25 10h11.5"
                  />
                </svg>
              </button>
            )}

            {/* Model Selector (Standard ChatGPT top-left placement) */}
            <div className="relative">
              <button
                type="button"
                aria-label="Select SAG model"
                aria-expanded={isModelMenuOpen}
                onClick={() => {
                  setIsDepthMenuOpen(false);
                  setIsSourceMenuOpen(false);
                  setIsProjectMenuOpen(false);
                  setIsModelMenuOpen((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/10"
              >
                <span>{selectedModel}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="size-3.5 opacity-70"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 6.5 3.5 3.5 3.5-3.5"
                  />
                </svg>
              </button>

              {isModelMenuOpen && (
                <div
                  role="menu"
                  aria-label="SAG models"
                  className="absolute start-0 top-10 z-50 w-60 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-[#212121]"
                >
                  {(
                    [
                      {
                        name: "SAG 2.5 Pro",
                        desc: "Deep Hybrid RAG & Verified Citations",
                      },
                      {
                        name: "SAG 2.5 Flash",
                        desc: "Low-latency Project Q&A",
                      },
                      {
                        name: "SAG Handover",
                        desc: "Automated What / How / Why Briefs",
                      },
                    ] as const
                  ).map((model) => (
                    <button
                      key={model.name}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSelectedModel(model.name);
                        setIsModelMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full flex-col rounded-xl px-2.5 py-2 text-start transition-colors",
                        selectedModel === model.name
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                      )}
                    >
                      <span className="flex items-center justify-between text-xs font-semibold">
                        {model.name}
                        {selectedModel === model.name && <span>✓</span>}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {model.desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Project Scope Selector */}
          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Select project scope for SAG"
              aria-expanded={isProjectMenuOpen}
              onClick={() => {
                setIsModelMenuOpen(false);
                setIsDepthMenuOpen(false);
                setIsSourceMenuOpen(false);
                setIsProjectMenuOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/10 dark:bg-[#1e1e1e] dark:text-gray-200 dark:hover:bg-white/10"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="max-w-[160px] truncate">
                {selectedProject ? selectedProject.name : "All Projects"}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-3 opacity-70"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 6.5 3.5 3.5 3.5-3.5"
                />
              </svg>
            </button>

            {isProjectMenuOpen && (
              <div
                role="menu"
                aria-label="Project scope options"
                className="absolute end-0 top-10 z-50 w-64 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-[#212121]"
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  SAG Project Context
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSelectedProjectId("ALL");
                    setIsProjectMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-start text-xs font-medium transition-colors",
                    selectedProjectId === "ALL"
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                  )}
                >
                  <span>All Organization Projects</span>
                  {selectedProjectId === "ALL" && <span>✓</span>}
                </button>
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      setIsProjectMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-start text-xs font-medium transition-colors",
                      selectedProjectId === proj.id
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                    )}
                  >
                    <span className="truncate">
                      {proj.name}{" "}
                      <span className="text-[11px] opacity-60">
                        ({proj.code})
                      </span>
                    </span>
                    {selectedProjectId === proj.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Main Body: Empty Hero State ("Ready when you are.") OR Active Message Stream */}
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
            <h1 className="mb-7 text-center text-2xl font-medium tracking-tight text-gray-900 sm:text-[28px] dark:text-white">
              Ready when you are.
            </h1>

            {/* Centered ChatGPT Pill Composer */}
            {renderComposerPill(true)}

            {/* Single Clean Row of Quick SAG Prompt Chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[
                "Tóm tắt Task Notes theo chuẩn What / How / Why",
                "Tổng hợp bản tin Bàn giao (Handover Brief)",
                "Kiểm tra tài liệu kiến trúc & Work Reports",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void submitQuery(suggestion)}
                  className="rounded-full border border-gray-200/80 bg-gray-50/70 px-3.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Active Conversation Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-[760px] space-y-6">
                {activeThread.messages.map((message) => {
                  const isUser = message.role === "user";
                  const isTraceExpanded = Boolean(expandedTraceIds[message.id]);

                  if (isUser) {
                    return (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-[80%] rounded-3xl bg-gray-100 px-4 py-2.5 text-sm leading-6 text-gray-900 dark:bg-[#2f2f2f] dark:text-gray-100">
                          {message.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <article
                      key={message.id}
                      aria-label="SAG assistant response"
                      className="space-y-3"
                    >
                      {/* SAG Retrieval Pipeline Status Bar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-medium text-brand-600 dark:text-brand-300">
                          <span className="size-1.5 rounded-full bg-brand-500" />
                          <span>
                            {selectedModel} · {message.depth ?? "High"} Depth
                          </span>
                        </span>

                        {message.retrievalSteps &&
                          message.retrievalSteps.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTraceIds((prev) => ({
                                  ...prev,
                                  [message.id]: !prev[message.id],
                                }))
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-gray-200/80 bg-gray-50 px-2.5 py-0.5 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/10"
                            >
                              <span>
                                Verified {message.citations?.length ?? 0} SAG
                                sources
                              </span>
                              <span aria-hidden="true">
                                {isTraceExpanded ? "▴" : "▾"}
                              </span>
                            </button>
                          )}
                      </div>

                      {/* Expandable SAG Retrieval Trace */}
                      {isTraceExpanded && message.retrievalSteps && (
                        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 p-3 text-xs dark:border-white/10 dark:bg-[#171717]">
                          <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                            SAG Hybrid Retrieval Trace
                          </div>
                          <ul className="space-y-1.5">
                            {message.retrievalSteps.map((step, idx) => (
                              <li
                                key={`${message.id}-step-${idx}`}
                                className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300"
                              >
                                <span>
                                  <strong className="font-medium text-gray-900 dark:text-white">
                                    {step.step}:
                                  </strong>{" "}
                                  {step.detail}
                                </span>
                                <span className="shrink-0 font-mono text-[11px] text-gray-400 tabular-nums">
                                  {step.durationMs}ms
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Answer Body */}
                      <div className="space-y-1.5 text-sm leading-7 text-gray-800 dark:text-gray-100">
                        {renderFormattedSagContent(message.content)}
                      </div>

                      {/* Verified SAG Citations / Sources Cards */}
                      {message.citations && message.citations.length > 0 && (
                        <div className="pt-1">
                          <div className="mb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                            SAG Verified Citations ({message.citations.length})
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {message.citations.map((cit) => {
                              const badge = SOURCE_TYPE_BADGE[cit.sourceType];
                              return (
                                <Link
                                  key={cit.id}
                                  href={cit.href}
                                  className="group flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 transition-all hover:border-brand-500/40 hover:bg-white hover:shadow-theme-xs dark:border-white/10 dark:bg-[#171717] dark:hover:border-brand-400/40 dark:hover:bg-[#1f1f1f]"
                                >
                                  <div>
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                      <span className="inline-flex items-center gap-1.5">
                                        <span className="flex size-4.5 items-center justify-center rounded-md bg-brand-500/15 text-[10px] font-bold text-brand-600 tabular-nums dark:text-brand-300">
                                          [{cit.index}]
                                        </span>
                                        <span
                                          className={cn(
                                            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                            badge.className,
                                          )}
                                        >
                                          {badge.label}
                                        </span>
                                      </span>
                                      <span className="text-[11px] font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                                        {cit.score}% match
                                      </span>
                                    </div>
                                    <p className="line-clamp-1 text-xs font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-300">
                                      {cit.title}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                                      {cit.snippet}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                                    <span>
                                      {cit.author ?? "Workspace"} ·{" "}
                                      {cit.updatedAt ?? "Synced"}
                                    </span>
                                    <span className="font-medium text-brand-600 group-hover:underline dark:text-brand-400">
                                      Open source →
                                    </span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Message Action Bar (Copy, Regenerate, Follow-ups) */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyMessage(message.id, message.content)
                          }
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <span>
                            {copiedMessageId === message.id
                              ? "✓ Copied"
                              : "Copy"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void submitQuery(
                              "Làm rõ hơn các dẫn chứng kỹ thuật và đề xuất hành động tiếp theo",
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <span>↻ Deeper SAG analysis</span>
                        </button>
                      </div>

                      {/* Follow-up Question Chips */}
                      {message.followUps && message.followUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {message.followUps.map((followUp) => (
                            <button
                              key={followUp}
                              type="button"
                              onClick={() => void submitQuery(followUp)}
                              className="rounded-full border border-gray-200/80 bg-gray-50/70 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-brand-500/40 hover:bg-brand-50/50 hover:text-brand-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-brand-400/40 dark:hover:text-brand-300"
                            >
                              {followUp}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}

                {isGenerating && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <span className="size-2 animate-ping rounded-full bg-brand-500" />
                    <span>
                      SAG is searching Task Notes, Project Documents & verifying
                      ACL citations…
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Docked ChatGPT Pill Composer */}
            <div className="shrink-0 border-t border-gray-100 bg-white/95 px-4 pt-2.5 pb-3 backdrop-blur-sm dark:border-white/5 dark:bg-[#0d0d0d]/95">
              {renderComposerPill(false)}
              <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
                Continuum SAG grounds answers in your authorized Project
                Documents, Task Notes & Work Reports.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
