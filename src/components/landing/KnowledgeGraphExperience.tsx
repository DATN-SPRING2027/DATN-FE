"use client";

import React, { useState } from "react";
import {
  CheckCircleIcon,
  FileIcon,
  ArrowRightIcon,
  ShootingStarIcon,
  UserIcon,
  LockIcon,
  CheckLineIcon,
} from "@/icons";

export interface GraphEntity {
  id: string;
  cluster: "iam" | "gateway" | "payment";
  type: "decision" | "pr" | "benchmark" | "verification" | "handover";
  label: string;
  sublabel: string;
  actor: string;
  x: number; // percentage
  y: number; // percentage
  status: string;
  description: string;
  evidence: string[];
  ragCitation: string;
}

export const ENTITIES: GraphEntity[] = [
  // Cluster IAM & Caching (Sprint 24) - Central cluster
  {
    id: "iam-decision",
    cluster: "iam",
    type: "decision",
    label: "WN-104: Redis Pub/Sub",
    sublabel: "Quyết định kiến trúc Session",
    actor: "Nguyễn Văn A (Senior Backend)",
    x: 48,
    y: 44,
    status: "Đã thẩm định",
    description:
      "Tải 100k users gây nghẽn memory. Chuyển sang Redis Pub/Sub đồng bộ session giữa các pod, latency duy trì < 15ms.",
    evidence: ["Work Note WN-104", "Architecture RFC v2.3"],
    ragCitation:
      "Trích dẫn WN-104: 'Chọn Redis Pub/Sub do cụm session đã có sẵn, không tăng độ phức tạp hạ tầng.'",
  },
  {
    id: "iam-pr",
    cluster: "iam",
    type: "pr",
    label: "PR #88: feat(iam) pubsub",
    sublabel: "Pull Request đã merge",
    actor: "GitHub CI • Merged by Lead",
    x: 32,
    y: 28,
    status: "Code Lineage",
    description:
      "Triển khai adapter Pub/Sub với retry policy 3 lần và fallback local in-memory cache nếu Redis cluster failover.",
    evidence: ["GitHub PR #88", "Commit a3c9f2b"],
    ragCitation:
      "Trích dẫn PR #88: 'Commit a3c9f2b: Fix token revocation broadcast and socket reconnect.'",
  },
  {
    id: "iam-benchmark",
    cluster: "iam",
    type: "benchmark",
    label: "Benchmark_100k.pdf",
    sublabel: "12.4ms avg latency",
    actor: "Automated K8s Load Test",
    x: 64,
    y: 26,
    status: "Thực nghiệm",
    description:
      "Kịch bản thử nghiệm 100k concurrent websockets connection. P99 latency đạt 18.2ms, CPU spike < 25%.",
    evidence: ["Benchmark Report #104", "Grafana Snapshot"],
    ragCitation:
      "Trích dẫn Benchmark: 'Đạt SLA 15ms tại mức tải 100.000 active sessions.'",
  },
  {
    id: "iam-verify",
    cluster: "iam",
    type: "verification",
    label: "Trần Thị B (Tech Lead)",
    sublabel: "Thẩm định kiến trúc & Ký duyệt",
    actor: "Trần Thị B (Lead Architect)",
    x: 66,
    y: 62,
    status: "Human Verified",
    description:
      "Đối chiếu hạ tầng Kubernetes hiện tại. Phê duyệt đưa vào kho tri thức chuẩn của dự án.",
    evidence: ["Chữ ký số Tech Lead", "Architecture Board Sign-off"],
    ragCitation:
      "Tech Lead Review: 'Đã kiểm tra cấu hình Cluster và failover. Chấp thuận chuẩn hoá.'",
  },
  {
    id: "iam-handover",
    cluster: "iam",
    type: "handover",
    label: "Lê Minh B (Kế thừa)",
    sublabel: "Tra cứu RAG có trích dẫn",
    actor: "Lê Minh B (Kỹ sư mới tiếp nhận)",
    x: 34,
    y: 64,
    status: "Tiếp nối trọn vẹn",
    description:
      "Kỹ sư mới tra cứu lý do không chọn RabbitMQ hay Kafka, hệ thống dẫn xuất ngay Work Note WN-104 kèm PR #88.",
    evidence: ["Gói chuyển giao IAM Sprint 24", "Log tra cứu Continuum AI"],
    ragCitation:
      "RAG Query Response: Trả lời chính xác có dẫn nguồn tài liệu và PR trong 1.2s.",
  },

  // Cluster Gateway (Sprint 22) - Satellite cluster left
  {
    id: "gw-decision",
    cluster: "gateway",
    type: "decision",
    label: "WN-082: gRPC Routing",
    sublabel: "Tối ưu hóa Gateway v2",
    actor: "Hoàng Minh C (DevOps/Lead)",
    x: 16,
    y: 46,
    status: "Đã thẩm định",
    description:
      "Thay thế REST proxy bằng gRPC stream giữa API Gateway và Core Services để giảm overhead HTTP header.",
    evidence: ["WN-082", "PR #54"],
    ragCitation:
      "Trích dẫn WN-082: 'Giảm 35% độ trễ mạng inter-service khi chuyển sang gRPC.'",
  },

  // Cluster Payment (Sprint 23) - Satellite cluster right
  {
    id: "pay-decision",
    cluster: "payment",
    type: "decision",
    label: "WN-096: Idempotency Key",
    sublabel: "Chống trùng lặp giao dịch",
    actor: "Đỗ Mai D (Fintech Backend)",
    x: 82,
    y: 48,
    status: "Đã thẩm định",
    description:
      "Khóa phân tán Redis lock kết hợp Idempotency-Key trong 120s để triệt tiêu lỗi charge thẻ đúp.",
    evidence: ["WN-096", "PR #71", "Audit PCI-DSS"],
    ragCitation:
      "Trích dẫn WN-096: 'Đảm bảo tính nhất quán 100% trong kịch bản network timeout.'",
  },
];

export default function KnowledgeGraphExperience() {
  const [activeCluster, setActiveCluster] = useState<string>("all");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("iam-decision");
  const [isSimulatingQuery, setIsSimulatingQuery] = useState<boolean>(false);
  const [queryAnswerVisible, setQueryAnswerVisible] = useState<boolean>(false);

  const selectedEntity =
    ENTITIES.find((e) => e.id === selectedEntityId) || ENTITIES[0];

  const handleSimulateQuery = () => {
    setIsSimulatingQuery(true);
    setQueryAnswerVisible(false);
    setSelectedEntityId("iam-decision");

    setTimeout(() => {
      setIsSimulatingQuery(false);
      setQueryAnswerVisible(true);
    }, 1200);
  };

  const filteredEntities = ENTITIES.filter((e) => {
    if (activeCluster === "all") return true;
    return e.cluster === activeCluster;
  });

  return (
    <section
      id="mang-luoi-tri-thuc"
      className="relative overflow-hidden bg-[#0B1120] py-20 lg:py-28 text-slate-100 border-y border-slate-800"
    >
      {/* Cinematic Ambient Vector Lighting */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-blue-600/15 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-10 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[100px]"
        aria-hidden="true"
      />

      {/* Vector Lattice Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #38BDF8 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-950/60 px-4 py-1 text-xs font-bold text-blue-300 shadow-md shadow-blue-500/10 mb-4 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            <span>MẠNG LƯỚI TRI THỨC SỐNG • VECTOR SPACE GRAPH</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Khám phá mạng lưới tri thức sống{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              của toàn dự án.
            </span>
          </h2>

          <p className="mt-3.5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Không còn là những trang tài liệu rời rạc. Continuum AI kết nối mọi quyết định kỹ thuật, mã nguồn PR, số liệu benchmark và chữ ký phê duyệt thành chuỗi ngữ cảnh đa chiều.
          </p>

          {/* Interactive Cluster Filters */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveCluster("all")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
                activeCluster === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
              }`}
            >
              Tất cả cụm mạng lưới
            </button>
            <button
              type="button"
              onClick={() => setActiveCluster("iam")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
                activeCluster === "iam"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
              }`}
            >
              Cụm 1: IAM & Caching (Sprint 24)
            </button>
            <button
              type="button"
              onClick={() => setActiveCluster("gateway")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
                activeCluster === "gateway"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
              }`}
            >
              Cụm 2: API Gateway & gRPC (Sprint 22)
            </button>
            <button
              type="button"
              onClick={() => setActiveCluster("payment")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
                activeCluster === "payment"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
              }`}
            >
              Cụm 3: Payment Orchestration (Sprint 23)
            </button>
          </div>
        </div>

        {/* 2D Full Interactive Knowledge Graph Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Main Graph Canvas (8 Cols) */}
          <div className="lg:col-span-8 relative min-h-[460px] sm:min-h-[520px] rounded-3xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl p-4 sm:p-6 shadow-2xl overflow-hidden flex flex-col justify-between">
            {/* Top HUD Metrics Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                <span className="font-mono text-cyan-300 font-bold uppercase text-[11px]">
                  Graph Engine v2.4
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 text-[11px]">
                  {filteredEntities.length} Nodes • 8 Semantic Edges
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-950 border border-blue-800 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
                  Semantic Distance: 0.12 (High Relevance)
                </span>
              </div>
            </div>

            {/* Interactive Graph Vector Canvas */}
            <div className="relative flex-1 w-full my-4">
              {/* SVG Connecting Edges */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="edgeGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="edgeGradCross" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#1E293B" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Central Cluster Connections */}
                {/* WN-104 (48%, 44%) to PR #88 (32%, 28%) */}
                <line
                  x1="48%"
                  y1="44%"
                  x2="32%"
                  y2="28%"
                  stroke="url(#edgeGradMain)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className={isSimulatingQuery ? "animate-pulse" : ""}
                />
                {/* WN-104 (48%, 44%) to Benchmark (64%, 26%) */}
                <line
                  x1="48%"
                  y1="44%"
                  x2="64%"
                  y2="26%"
                  stroke="url(#edgeGradMain)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {/* WN-104 (48%, 44%) to Tech Lead (66%, 62%) */}
                <line
                  x1="48%"
                  y1="44%"
                  x2="66%"
                  y2="62%"
                  stroke="url(#edgeGradMain)"
                  strokeWidth="2.5"
                  strokeDasharray="5 5"
                />
                {/* WN-104 (48%, 44%) to Lê Minh B (34%, 64%) */}
                <line
                  x1="48%"
                  y1="44%"
                  x2="34%"
                  y2="64%"
                  stroke="url(#edgeGradMain)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Cross Cluster Bridges (IAM to Gateway & Payment) */}
                <line
                  x1="32%"
                  y1="28%"
                  x2="16%"
                  y2="46%"
                  stroke="url(#edgeGradCross)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <line
                  x1="66%"
                  y1="62%"
                  x2="82%"
                  y2="48%"
                  stroke="url(#edgeGradCross)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              </svg>

              {/* Render Graph Nodes */}
              {filteredEntities.map((entity) => {
                const isSelected = selectedEntityId === entity.id;
                const isCenter = entity.type === "decision";

                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => setSelectedEntityId(entity.id)}
                    style={{ left: `${entity.x}%`, top: `${entity.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center rounded-2xl transition-all cursor-pointer select-none ${
                      isSelected
                        ? "scale-110 ring-4 ring-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.5)] z-30"
                        : "hover:scale-105 opacity-90 hover:opacity-100"
                    } ${
                      isCenter
                        ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-3 border border-cyan-400/60 shadow-xl shadow-blue-500/30"
                        : "bg-slate-900/95 text-slate-200 p-2.5 border border-slate-700 shadow-md backdrop-blur-md"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {entity.type === "decision" && (
                        <span className="flex h-2 w-2 rounded-full bg-cyan-300 animate-ping" />
                      )}
                      {entity.type === "pr" && (
                        <FileIcon className="h-3 w-3 text-blue-400" />
                      )}
                      {entity.type === "benchmark" && (
                        <ShootingStarIcon className="h-3 w-3 text-cyan-400" />
                      )}
                      {entity.type === "verification" && (
                        <CheckCircleIcon className="h-3 w-3 text-emerald-400" />
                      )}
                      {entity.type === "handover" && (
                        <UserIcon className="h-3 w-3 text-indigo-400" />
                      )}
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                        {entity.status}
                      </span>
                    </div>

                    <span className="text-xs font-black tracking-tight leading-tight">
                      {entity.label}
                    </span>

                    <span
                      className={`text-[9px] mt-0.5 font-medium ${
                        isCenter ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {entity.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Simulated RAG Query Bar */}
            <div className="relative z-20 rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/30 text-blue-400 shrink-0">
                    <ShootingStarIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                      Thử nghiệm RAG Query trên Graph
                    </span>
                    <span className="text-xs text-slate-200 font-medium">
                      &quot;Tại sao nhóm IAM chọn Redis Pub/Sub thay vì Kafka?&quot;
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateQuery}
                  disabled={isSimulatingQuery}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-cyan-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <span>
                    {isSimulatingQuery ? "Đang truy vết..." : "Truy vết tri thức"}
                  </span>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Real-time Simulated RAG Answer Card */}
              {queryAnswerVisible && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 animate-fadeIn">
                  <div className="flex items-start gap-2 rounded-xl bg-blue-950/40 border border-blue-500/40 p-2.5 text-xs">
                    <CheckLineIcon className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-slate-200 leading-relaxed text-[11px]">
                        <strong>Continuum AI:</strong> Theo{" "}
                        <span className="text-cyan-300 font-bold underline cursor-pointer">
                          Work Note WN-104
                        </span>{" "}
                        (Nguyễn Văn A, đã được Tech Lead Trần Thị B duyệt), nhóm chọn Redis Pub/Sub vì cụm Session đã có sẵn, giúp giảm độ trễ xuống <strong>12.4ms</strong> và tiết kiệm 40% chi phí vận hành so với dựng cụm Kafka riêng.
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-[9px] font-mono text-cyan-300">
                        <span className="rounded bg-blue-900/60 px-1.5 py-0.5 border border-blue-700/60">
                          Nguồn 1: WN-104
                        </span>
                        <span className="rounded bg-blue-900/60 px-1.5 py-0.5 border border-blue-700/60">
                          Nguồn 2: PR #88
                        </span>
                        <span className="rounded bg-blue-900/60 px-1.5 py-0.5 border border-blue-700/60">
                          Nguồn 3: Benchmark_100k
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Side Floating Inspector Panel (4 Cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-slate-800 bg-slate-950/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Node Inspector
                </span>
                <span className="rounded-full bg-blue-950 border border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  {selectedEntity.status}
                </span>
              </div>

              {/* Title & Actor */}
              <h3 className="text-lg font-extrabold text-white leading-snug">
                {selectedEntity.label}
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-1">
                Chủ thể: <strong className="text-slate-200">{selectedEntity.actor}</strong>
              </p>

              {/* Description */}
              <div className="mt-4 rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Nội dung chi tiết:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedEntity.description}
                </p>
              </div>

              {/* Evidence Lineage Chips */}
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Bằng chứng gắn kết (Evidence):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntity.evidence.map((ev, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-mono text-cyan-300"
                    >
                      <FileIcon className="h-3 w-3 text-cyan-400" />
                      {ev}
                    </span>
                  ))}
                </div>
              </div>

              {/* RAG Verification Quote */}
              <div className="mt-4 rounded-2xl border border-blue-900/60 bg-blue-950/30 p-3 text-xs italic text-blue-200">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300 not-italic mb-1 text-[11px]">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>Xác nhận & Trích dẫn RAG:</span>
                </div>
                {selectedEntity.ragCitation}
              </div>
            </div>

            {/* Bottom Trust Stamp */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 text-[11px]">
                <LockIcon className="h-3 w-3 text-cyan-400" />
                Immutable Audit Trail
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Hash: 0x9f4a...2c8e
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
