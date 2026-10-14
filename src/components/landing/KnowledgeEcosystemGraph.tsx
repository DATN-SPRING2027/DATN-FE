"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

export interface EcosystemNode {
  id: string;
  parentId?: string;
  label: string;
  shape: "core" | "sprout" | "leaf" | "seed" | "shield";
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  card?: {
    badge: string;
    title: string;
    description: string;
    ctaText: string;
    actionSectionId?: string;
  };
  subBranches?: { dx: number; dy: number; label: string }[];
}

export const defaultEcosystemNodes: EcosystemNode[] = [
  {
    id: "core",
    label: "Hạt tâm Tri thức",
    shape: "core",
    x: 50,
    y: 50,
  },
  {
    id: "branch-1",
    parentId: "core",
    label: "Thu thập & Bóc tách",
    shape: "sprout",
    x: 24,
    y: 26,
    card: {
      badge: "Giai đoạn 01 • Đầu vào",
      title: "Chắt lọc dữ liệu tự nhiên",
      description: "Ghi lại Work Notes, quyết định kỹ thuật và đính kèm bằng chứng (PR, commit, tài liệu) ngay khi công việc đang diễn ra.",
      ctaText: "Xem quy trình ghi nhận",
      actionSectionId: "giai-phap",
    },
    subBranches: [
      { dx: -8, dy: -6, label: "Work Notes" },
      { dx: -4, dy: 10, label: "Evidence PRs" },
    ],
  },
  {
    id: "branch-2",
    parentId: "core",
    label: "Mạng lưới Liên kết",
    shape: "leaf",
    x: 74,
    y: 22,
    card: {
      badge: "Giai đoạn 02 • Cấu trúc",
      title: "Kết nối ngữ cảnh thông minh",
      description: "AI phân tích và đề xuất liên kết các thông tin rời rạc từ các kho lưu trữ được phép thành hệ thống rễ tri thức liền mạch.",
      ctaText: "Khám phá liên kết AI",
      actionSectionId: "tinh-nang",
    },
    subBranches: [
      { dx: 7, dy: -8, label: "Graph Context" },
      { dx: 9, dy: 6, label: "Auto Link" },
    ],
  },
  {
    id: "branch-3",
    parentId: "core",
    label: "Kiểm chứng Thẩm định",
    shape: "shield",
    x: 82,
    y: 54,
    card: {
      badge: "Giai đoạn 03 • Bảo chứng",
      title: "Xác thực bởi người có trách nhiệm",
      description: "Nguyên tắc cốt lõi: AI chỉ gợi ý, Tech Lead hoặc người phụ trách luôn trực tiếp kiểm tra bằng chứng trước khi xác nhận.",
      ctaText: "Xem cơ chế kiểm duyệt",
      actionSectionId: "cach-hoat-dong",
    },
    subBranches: [
      { dx: 8, dy: -6, label: "Lead Review" },
      { dx: 7, dy: 8, label: "Human Verify" },
    ],
  },
  {
    id: "branch-4",
    parentId: "core",
    label: "Truy vấn Tức thì",
    shape: "seed",
    x: 68,
    y: 78,
    card: {
      badge: "Giai đoạn 04 • Khai thác",
      title: "Trích xuất câu trả lời có trích dẫn",
      description: "Người kế nhiệm đặt câu hỏi tự nhiên và nhận câu trả lời chính xác, hiển thị rõ nguồn tham chiếu và cảnh báo nếu thiếu dữ liệu.",
      ctaText: "Thử nghiệm hỏi đáp",
      actionSectionId: "demo",
    },
    subBranches: [
      { dx: 6, dy: 9, label: "RAG Citation" },
      { dx: -6, dy: 8, label: "Fact Check" },
    ],
  },
  {
    id: "branch-5",
    parentId: "core",
    label: "Sinh trưởng Kế thừa",
    shape: "leaf",
    x: 26,
    y: 72,
    card: {
      badge: "Giai đoạn 05 • Chuyển giao",
      title: "Gói bàn giao không đứt gãy",
      description: "Người tiếp nhận công việc nắm trọn vẹn trách nhiệm đang mở, câu hỏi chưa giải quyết và các tài liệu tham khảo trọng tâm.",
      ctaText: "Xem gói bàn giao",
      actionSectionId: "tinh-nang",
    },
    subBranches: [
      { dx: -8, dy: 6, label: "Handover Kit" },
      { dx: 6, dy: 9, label: "Open Tasks" },
    ],
  },
];

interface KnowledgeEcosystemGraphProps {
  nodes?: EcosystemNode[];
  onSelectNode?: (node: EcosystemNode) => void;
  className?: string;
}

export default function KnowledgeEcosystemGraph({
  nodes = defaultEcosystemNodes,
  onSelectNode,
  className = "",
}: KnowledgeEcosystemGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeNodeId, setActiveNodeId] = useState<string>("branch-1");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mousePos = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  const coreNode = useMemo(() => nodes.find((n) => n.shape === "core") || nodes[0], [nodes]);
  const branchNodes = useMemo(() => nodes.filter((n) => n.id !== coreNode.id), [nodes, coreNode]);
  const activeNode = useMemo(() => nodes.find((n) => n.id === (hoveredNodeId || activeNodeId)), [
    nodes,
    hoveredNodeId,
    activeNodeId,
  ]);

  // Entrance animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Ambient floating spores particles canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle pool: 120 organic dust/spore particles
    const particleCount = 120;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.45) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 2 + 0.8,
      alpha: Math.random() * 0.45 + 0.15,
      pulse: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw gentle organic wind motion
      particles.forEach((p) => {
        p.pulse += 0.02;
        p.x += p.vx + Math.sin(p.pulse) * 0.15;
        p.y += p.vy + Math.cos(p.pulse) * 0.12;

        // Wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Subtle mouse repulsion
        const dx = mousePos.current.x - p.x;
        const dy = mousePos.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && dist > 0) {
          const force = (100 - dist) / 100;
          p.x -= (dx / dist) * force * 1.5;
          p.y -= (dy / dist) * force * 1.5;
        }

        // Draw soft emerald / warm pollen spore
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${p.alpha * 0.7})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseLeave = () => {
    mousePos.current = { x: -1000, y: -1000 };
    setHoveredNodeId(null);
  };

  // Helper to calculate smooth organic Bézier curve between core and a branch node
  const getBranchPath = (fromX: number, fromY: number, toX: number, toY: number) => {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    // Add an organic curvature offset perpendicular to the line
    const dx = toX - fromX;
    const dy = toY - fromY;
    const normalX = -dy * 0.22;
    const normalY = dx * 0.22;
    const cx = midX + normalX;
    const cy = midY + normalY;
    return `M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative h-[560px] sm:h-[620px] w-full select-none overflow-visible rounded-3xl bg-gradient-to-b from-[#F5FAF6] via-[#FAFDFB] to-[#F3F8F5] border border-[#E2ECE5] shadow-xl p-4 sm:p-6 transition-all ${className}`}
    >
      {/* Background Micro Spore Particles Canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full rounded-[inherit]" />

      {/* Subtle organic ambient radial glows */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-0 h-96 w-96 rounded-full bg-[#10B981]/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 right-1/4 -z-0 h-72 w-72 rounded-full bg-[#F59E0B]/10 blur-3xl"
        aria-hidden="true"
      />

      {/* SVG Layer for Organic Roots & Energy Pulse */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      >
        <defs>
          {/* Active Flow Gradient */}
          <linearGradient id="activeRootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="60%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          {/* Idle Root Gradient */}
          <linearGradient id="idleRootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.25" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Render each branch connection */}
        {branchNodes.map((node) => {
          const isActive = (hoveredNodeId || activeNodeId) === node.id;
          const path = getBranchPath(coreNode.x, coreNode.y, node.x, node.y);

          return (
            <g key={node.id} className="transition-all duration-500">
              {/* Base Idle Branch Curve */}
              <path
                d={path}
                fill="none"
                stroke={isActive ? "url(#activeRootGradient)" : "url(#idleRootGradient)"}
                strokeWidth={isActive ? 1.6 : 0.8}
                strokeLinecap="round"
                className={`transition-all duration-500 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  filter: isActive ? "url(#glow)" : "none",
                }}
              />

              {/* Dynamic Animated Pulse along the Active Root */}
              {isActive && (
                <path
                  d={path}
                  fill="none"
                  stroke="#34D399"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray="4, 16"
                  className="animate-[dashFlow_1.8s_linear_infinite]"
                  style={{ filter: "url(#glow)" }}
                />
              )}

              {/* Sprouting Sub-branches when Active */}
              {isActive &&
                node.subBranches?.map((sub, sIdx) => {
                  const subX = node.x + sub.dx;
                  const subY = node.y + sub.dy;
                  const subPath = getBranchPath(node.x, node.y, subX, subY);
                  return (
                    <g key={sIdx} className="animate-fadeIn">
                      <path
                        d={subPath}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={0.7}
                        strokeLinecap="round"
                        strokeDasharray="2, 2"
                        className="opacity-75"
                      />
                      <circle cx={subX} cy={subY} r={0.9} fill="#34D399" />
                      <text
                        x={subX + (sub.dx > 0 ? 1.5 : -1.5)}
                        y={subY + (sub.dy > 0 ? 2.5 : -1.5)}
                        fontSize="2.2"
                        fontWeight="600"
                        fill="#0F766E"
                        textAnchor={sub.dx > 0 ? "start" : "end"}
                        className="select-none font-sans"
                      >
                        {sub.label}
                      </text>
                    </g>
                  );
                })}
            </g>
          );
        })}
      </svg>

      {/* CORE SEED (Hạt tâm Tri thức) in Center */}
      <div
        style={{ left: `${coreNode.x}%`, top: `${coreNode.y}%` }}
        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-300 hover:scale-110"
        onClick={() => {
          setActiveNodeId("core");
          onSelectNode?.(coreNode);
        }}
      >
        <div className="relative flex items-center justify-center">
          {/* Breathing ambient aura */}
          <span className="absolute h-18 w-18 rounded-full bg-[#10B981]/25 animate-ping opacity-60" />
          <span className="absolute h-14 w-14 rounded-full bg-[#F59E0B]/20 animate-pulse" />

          {/* Core Seed Jewel */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#0F766E] via-[#059669] to-[#10B981] p-1 text-white shadow-lg ring-4 ring-white/80 dark:ring-gray-800">
            {/* Seed Sprout Icon */}
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>

          {/* Core Tag */}
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-[#065F46] shadow-sm border border-[#A7F3D0]">
            {coreNode.label}
          </span>
        </div>
      </div>

      {/* BRANCH NODES (Chồi non / Hạt mầm / Đốm lá) */}
      {branchNodes.map((node) => {
        const isActive = (hoveredNodeId || activeNodeId) === node.id;

        return (
          <div
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              setActiveNodeId(node.id);
              onSelectNode?.(node);
            }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
          >
            <div className="relative flex flex-col items-center">
              {/* Node Sprout Icon with Organic Shape */}
              <div
                className={`relative flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? "scale-125 ring-4 ring-[#10B981]/30 shadow-lg"
                    : "scale-100 hover:scale-115 ring-2 ring-white/90 shadow-md"
                } ${
                  node.shape === "sprout"
                    ? "h-10 w-10 rounded-2xl rounded-tr-none bg-gradient-to-tr from-[#059669] to-[#34D399] text-white"
                    : node.shape === "shield"
                    ? "h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0F766E] to-[#14B8A6] text-white"
                    : node.shape === "seed"
                    ? "h-10 w-10 rounded-full bg-gradient-to-tr from-[#D97706] to-[#F59E0B] text-white"
                    : "h-10 w-10 rounded-full rounded-bl-none bg-gradient-to-tr from-[#047857] to-[#10B981] text-white"
                }`}
              >
                {/* Micro Icon Representation */}
                {node.shape === "sprout" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V6m0 0l-4 4m4-4l4 4M5 19h14" />
                  </svg>
                )}
                {node.shape === "shield" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
                {node.shape === "seed" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                {node.shape === "leaf" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </div>

              {/* Pill Tag (Nhãn ngắn cạnh chồi lá) */}
              <span
                className={`mt-2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? "bg-[#065F46] text-white shadow-md scale-105"
                    : "bg-white/90 text-[#1E293B] shadow-xs border border-[#E2E8F0] group-hover:bg-white group-hover:border-[#10B981]"
                }`}
              >
                {node.label}
              </span>
            </div>
          </div>
        );
      })}

      {/* POPOVER CARD (Thẻ thông tin nổi tối giản khi tương tác) */}
      {activeNode && activeNode.card && (
        <div
          className="absolute z-30 transition-all duration-300 ease-out"
          style={{
            left: activeNode.x > 50 ? `${Math.max(10, activeNode.x - 38)}%` : `${Math.min(65, activeNode.x + 8)}%`,
            top: activeNode.y > 50 ? `${Math.max(8, activeNode.y - 36)}%` : `${Math.min(60, activeNode.y + 6)}%`,
          }}
        >
          <div className="w-[280px] sm:w-[320px] rounded-2xl border border-[#D1FAE5] bg-white/95 p-4.5 shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-scaleUp">
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                {activeNode.card.badge}
              </span>
              <span className="text-[10px] text-[#64748B]">Điểm nút sinh thái</span>
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-[#0F172A] leading-snug">
              {activeNode.card.title}
            </h4>

            {/* Description */}
            <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
              {activeNode.card.description}
            </p>

            {/* Action CTA link */}
            <div className="mt-3.5 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (activeNode.card?.actionSectionId) {
                    const el = document.getElementById(activeNode.card.actionSectionId);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#059669] hover:text-[#047857] transition-colors"
              >
                <span>{activeNode.card.ctaText}</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
              <span className="text-[10px] text-[#94A3B8]">Continuum AI</span>
            </div>
          </div>
        </div>
      )}

      {/* Instruction indicator at bottom */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1 text-[11px] font-medium text-[#475569] border border-[#E2ECE5] backdrop-blur-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
        <span>Rê chuột hoặc nhấp vào chồi hạt để khám phá dòng chảy tri thức</span>
      </div>
    </div>
  );
}
