"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

export interface EcosystemNode {
  id: string;
  parentId?: string;
  label: string;
  role: "upload" | "network" | "query" | "growth" | "verify" | "core";
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  colorScheme: {
    orbGradient: string;
    glowColor: string;
    shadowColor: string;
    ringColor: string;
    iconColor: string;
  };
  card?: {
    badge: string;
    title: string;
    description: string;
    ctaText: string;
    actionSectionId?: string;
  };
  depthTags?: { dx: number; dy: number; label: string; blur?: boolean }[];
}

export const defaultEcosystemNodes: EcosystemNode[] = [
  {
    id: "core",
    label: "Hạt tâm Tri thức",
    role: "core",
    x: 50,
    y: 50,
    colorScheme: {
      orbGradient: "from-blue-700 via-indigo-600 to-blue-500",
      glowColor: "rgba(37, 99, 235, 0.4)",
      shadowColor: "rgba(30, 58, 138, 0.5)",
      ringColor: "rgba(59, 130, 246, 0.3)",
      iconColor: "#FFFFFF",
    },
  },
  {
    id: "branch-1",
    parentId: "core",
    label: "Thu thập & Bóc tách",
    role: "upload",
    x: 24,
    y: 27,
    colorScheme: {
      orbGradient: "from-sky-400 via-blue-500 to-blue-600",
      glowColor: "rgba(56, 189, 248, 0.35)",
      shadowColor: "rgba(14, 165, 233, 0.4)",
      ringColor: "rgba(186, 230, 253, 0.5)",
      iconColor: "#FFFFFF",
    },
    card: {
      badge: "Giai đoạn 01 • Đầu vào",
      title: "Chắt lọc dữ liệu tự nhiên",
      description: "Tự động phân tích và làm sạch hàng ngàn tài liệu, Work Notes và PR kỹ thuật thành các khối tri thức cô đọng.",
      ctaText: "Xem quy trình",
      actionSectionId: "giai-phap",
    },
    depthTags: [
      { dx: -7, dy: -6, label: "Work Notes", blur: true },
      { dx: -4, dy: 9, label: "Evidence PRs", blur: false },
    ],
  },
  {
    id: "branch-2",
    parentId: "core",
    label: "Mạng lưới Liên kết",
    role: "network",
    x: 74,
    y: 24,
    colorScheme: {
      orbGradient: "from-blue-600 via-indigo-600 to-blue-700",
      glowColor: "rgba(37, 99, 235, 0.5)",
      shadowColor: "rgba(30, 58, 138, 0.6)",
      ringColor: "rgba(99, 102, 241, 0.4)",
      iconColor: "#FFFFFF",
    },
    card: {
      badge: "Giai đoạn 02 • Cấu trúc",
      title: "Kết nối ngữ cảnh thông minh",
      description: "Hình thành hệ thống rễ liên kết các thông tin rời rạc thành bức tranh tổng thể, sẵn sàng cho việc kế thừa.",
      ctaText: "Khám phá liên kết AI",
      actionSectionId: "tinh-nang",
    },
    depthTags: [
      { dx: 7, dy: -8, label: "Graph Context", blur: true },
      { dx: 9, dy: 7, label: "Auto Link", blur: false },
    ],
  },
  {
    id: "branch-3",
    parentId: "core",
    label: "Kiểm chứng Thẩm định",
    role: "verify",
    x: 82,
    y: 56,
    colorScheme: {
      orbGradient: "from-blue-600 via-cyan-600 to-teal-600",
      glowColor: "rgba(6, 182, 212, 0.35)",
      shadowColor: "rgba(8, 145, 178, 0.4)",
      ringColor: "rgba(165, 243, 252, 0.5)",
      iconColor: "#FFFFFF",
    },
    card: {
      badge: "Giai đoạn 03 • Bảo chứng",
      title: "Xác thực bởi người có trách nhiệm",
      description: "Nguyên tắc cốt lõi: AI chỉ đưa ra đề xuất, con người (Tech Lead/Maintainer) trực tiếp kiểm chứng trước khi xác nhận.",
      ctaText: "Xem cơ chế kiểm duyệt",
      actionSectionId: "cach-hoat-dong",
    },
    depthTags: [
      { dx: 8, dy: -6, label: "Lead Review", blur: false },
      { dx: 7, dy: 8, label: "Human Verify", blur: true },
    ],
  },
  {
    id: "branch-4",
    parentId: "core",
    label: "Truy vấn Tức thì",
    role: "query",
    x: 68,
    y: 78,
    colorScheme: {
      orbGradient: "from-amber-500 via-orange-500 to-amber-600",
      glowColor: "rgba(245, 158, 11, 0.45)",
      shadowColor: "rgba(217, 119, 6, 0.5)",
      ringColor: "rgba(254, 215, 170, 0.6)",
      iconColor: "#FFFFFF",
    },
    card: {
      badge: "Giai đoạn 04 • Khai thác",
      title: "Trích xuất câu trả lời chính xác",
      description: "Đặt câu hỏi bằng ngôn ngữ tự nhiên và nhận phản hồi tức thì kèm trích dẫn nguồn bằng chứng minh bạch.",
      ctaText: "Trải nghiệm ngay",
      actionSectionId: "demo",
    },
    depthTags: [
      { dx: 6, dy: 9, label: "RAG Citation", blur: false },
      { dx: -7, dy: 8, label: "Vector Search", blur: true },
    ],
  },
  {
    id: "branch-5",
    parentId: "core",
    label: "Sinh trưởng Kế thừa",
    role: "growth",
    x: 26,
    y: 72,
    colorScheme: {
      orbGradient: "from-indigo-600 via-blue-700 to-indigo-800",
      glowColor: "rgba(79, 70, 229, 0.4)",
      shadowColor: "rgba(49, 46, 129, 0.5)",
      ringColor: "rgba(199, 210, 254, 0.5)",
      iconColor: "#FFFFFF",
    },
    card: {
      badge: "Giai đoạn 05 • Chuyển giao",
      title: "Hệ sinh thái tự học hỏi & bàn giao",
      description: "Mỗi tương tác mới giúp mở rộng nhánh tri thức, người kế nhiệm tiếp quản trọn vẹn context công việc.",
      ctaText: "Tìm hiểu thêm",
      actionSectionId: "tinh-nang",
    },
    depthTags: [
      { dx: -8, dy: 6, label: "Handover Kit", blur: false },
      { dx: 7, dy: 9, label: "Knowledge DNA", blur: true },
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
  const [activeNodeId, setActiveNodeId] = useState<string>("branch-2");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const mousePos = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  const coreNode = useMemo(() => nodes.find((n) => n.role === "core") || nodes[0], [nodes]);
  const branchNodes = useMemo(() => nodes.filter((n) => n.id !== coreNode.id), [nodes, coreNode]);
  const activeNode = useMemo(
    () => nodes.find((n) => n.id === (hoveredNodeId || activeNodeId)) || branchNodes[0],
    [nodes, hoveredNodeId, activeNodeId, branchNodes]
  );

  // Atmospheric Cyber-Biophilic Particles (Royal Blue & Cyan glow)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 640);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 620);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle pool: 110 luminous blue & cyan data particles
    const particleCount = 110;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.5 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      color: Math.random() > 0.35 ? "rgba(37, 99, 235," : "rgba(6, 182, 212,",
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render cyber mesh / subtle grid coordinates
      ctx.strokeStyle = "rgba(226, 232, 240, 0.45)";
      ctx.lineWidth = 0.5;

      particles.forEach((p) => {
        p.pulse += 0.025;
        p.x += p.vx + Math.sin(p.pulse) * 0.2;
        p.y += p.vy + Math.cos(p.pulse) * 0.15;

        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Soft cursor repulsion
        const dx = mousePos.current.x - p.x;
        const dy = mousePos.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110 && dist > 0) {
          const force = (110 - dist) / 110;
          p.x -= (dx / dist) * force * 1.8;
          p.y -= (dy / dist) * force * 1.8;
        }

        // Draw particle with gentle glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.alpha * (0.7 + 0.3 * Math.sin(p.pulse))})`;
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

  // Natural organic Bézier optical fiber curve
  const getBranchPath = (fromX: number, fromY: number, toX: number, toY: number) => {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
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
      className={`relative h-[580px] sm:h-[640px] w-full select-none overflow-visible rounded-3xl bg-gradient-to-br from-white via-[#F8FAFC] to-[#EFF6FF]/70 border border-blue-100/80 shadow-[0_25px_60px_-15px_rgba(37,99,235,0.14),0_0_35px_rgba(59,130,246,0.08)] backdrop-blur-xl p-4 sm:p-6 transition-all ${className}`}
    >
      {/* Background Micro Spore Particles Canvas */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full rounded-[inherit]" />

      {/* Atmospheric Royal Blue Ambient Radial Glows */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-0 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/4 right-1/4 -z-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-1/4 left-1/4 -z-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
        aria-hidden="true"
      />

      {/* SVG Layer for Optical Fiber Paths & Animated Light Pulses */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      >
        <defs>
          {/* Active Optical Fiber Gradient (Royal Blue to Vibrant Cyan) */}
          <linearGradient id="activeFiberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>

          {/* Idle Fiber Gradient (Muted slate-blue optical line) */}
          <linearGradient id="idleFiberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.25" />
          </linearGradient>

          {/* Optical Fiber Glow Filter */}
          <filter id="fiberGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Faint Concentric Radar Ripple Circles around Center */}
        <circle cx={coreNode.x} cy={coreNode.y} r={16} fill="none" stroke="#3B82F6" strokeWidth={0.35} strokeDasharray="1, 3" className="opacity-40 animate-[spin_30s_linear_infinite]" />
        <circle cx={coreNode.x} cy={coreNode.y} r={32} fill="none" stroke="#60A5FA" strokeWidth={0.25} strokeDasharray="2, 4" className="opacity-30" />
        <circle cx={coreNode.x} cy={coreNode.y} r={46} fill="none" stroke="#93C5FD" strokeWidth={0.2} strokeDasharray="3, 5" className="opacity-20" />

        {/* Render Optical Fiber Connections */}
        {branchNodes.map((node) => {
          const isActive = (hoveredNodeId || activeNodeId) === node.id;
          const path = getBranchPath(coreNode.x, coreNode.y, node.x, node.y);

          return (
            <g key={node.id} className="transition-all duration-500">
              {/* Base Optical Fiber Track */}
              <path
                d={path}
                fill="none"
                stroke={isActive ? "url(#activeFiberGradient)" : "url(#idleFiberGradient)"}
                strokeWidth={isActive ? 1.8 : 0.9}
                strokeLinecap="round"
                style={{
                  filter: isActive ? "url(#fiberGlow)" : "none",
                }}
                className="transition-all duration-300"
              />

              {/* Real-time Moving Light Pulse along the Fiber (Data Flow) */}
              {isActive && (
                <path
                  d={path}
                  fill="none"
                  stroke="#67E8F9"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray="4, 18"
                  className="animate-[dashFlow_1.6s_linear_infinite]"
                  style={{ filter: "url(#fiberGlow)" }}
                />
              )}

              {/* Sub-branch optical veins radiating from Active Node */}
              {isActive &&
                node.depthTags?.map((tag, tIdx) => {
                  const tagX = node.x + tag.dx;
                  const tagY = node.y + tag.dy;
                  const tagPath = getBranchPath(node.x, node.y, tagX, tagY);
                  return (
                    <g key={tIdx} className="animate-fadeIn">
                      <path
                        d={tagPath}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth={0.7}
                        strokeLinecap="round"
                        strokeDasharray="1.5, 2"
                        className="opacity-70"
                      />
                      <circle cx={tagX} cy={tagY} r={0.8} fill="#38BDF8" />
                      <text
                        x={tagX + (tag.dx > 0 ? 1.6 : -1.6)}
                        y={tagY + (tag.dy > 0 ? 2.5 : -1.5)}
                        fontSize="2.1"
                        fontWeight="700"
                        fill="#1E40AF"
                        textAnchor={tag.dx > 0 ? "start" : "end"}
                        className={`select-none font-sans ${tag.blur ? "opacity-50 blur-[0.3px]" : "opacity-90"}`}
                      >
                        {tag.label}
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
          {/* Concentric Pulsing Ripples */}
          <span className="absolute h-20 w-20 rounded-full bg-blue-500/20 animate-ping opacity-75" />
          <span className="absolute h-16 w-16 rounded-full bg-indigo-500/25 animate-pulse" />

          {/* 3D Glossy Core Orb with layered light */}
          <div className="relative flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 p-1 text-white shadow-[0_10px_25px_-5px_rgba(37,99,235,0.6),inset_0_2px_4px_rgba(255,255,255,0.6)] ring-4 ring-white/90">
            {/* Core Center Emblem */}
            <svg className="h-6 w-6 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Core Glassmorphic Tag */}
          <span className="absolute -bottom-6.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-3 py-0.5 text-[11px] font-bold text-blue-900 shadow-sm border border-blue-200/80 backdrop-blur-md">
            {coreNode.label}
          </span>
        </div>
      </div>

      {/* 3D INTERACTIVE INTELLECTUAL SEED NODES */}
      {branchNodes.map((node) => {
        const isActive = (hoveredNodeId || activeNodeId) === node.id;
        const isNetworkNode = node.id === "branch-2";

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
              {/* Radar Ripple Effect for Active Focus Node ("Mạng lưới Liên kết") */}
              {isNetworkNode && (
                <>
                  <span className="absolute -inset-3 rounded-full bg-blue-500/20 animate-ping opacity-60 pointer-events-none" />
                  <span className="absolute -inset-6 rounded-full border border-blue-400/40 animate-pulse pointer-events-none" />
                </>
              )}

              {/* 3D Digital Seed Orb with glossy curvature */}
              <div
                className={`relative flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? "scale-125 ring-4 ring-blue-400/40 shadow-[0_12px_30px_-5px_rgba(37,99,235,0.55),inset_0_2px_4px_rgba(255,255,255,0.7)]"
                    : "scale-100 hover:scale-115 ring-2 ring-white/90 shadow-[0_8px_20px_-4px_rgba(30,58,138,0.35),inset_0_1.5px_3px_rgba(255,255,255,0.6)]"
                } ${
                  isNetworkNode ? "h-12 w-12" : "h-10.5 w-10.5"
                } rounded-full bg-gradient-to-tr ${node.colorScheme.orbGradient} text-white`}
              >
                {/* Specific 3D Vector Icons per User Spec */}
                {node.role === "upload" && (
                  /* Glowing Upload / Extract Icon */
                  <svg className="h-5 w-5 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}

                {node.role === "network" && (
                  /* 3D Chain-link Icon */
                  <svg className="h-6 w-6 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}

                {node.role === "verify" && (
                  /* Verified Shield Icon */
                  <svg className="h-5 w-5 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}

                {node.role === "query" && (
                  /* Glowing Search Icon */
                  <svg className="h-5 w-5 drop-shadow text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}

                {node.role === "growth" && (
                  /* Digitized Double-Helix / Sprout Icon */
                  <svg className="h-5 w-5 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                )}
              </div>

              {/* Glassmorphic Rounded Label Tag with Bold Typography */}
              <span
                className={`mt-2.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition-all duration-300 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 ring-1 ring-blue-300"
                    : "bg-white/95 text-slate-800 shadow-sm border border-slate-200/90 group-hover:bg-white group-hover:border-blue-400 group-hover:text-blue-600"
                }`}
              >
                {node.label}
              </span>
            </div>
          </div>
        );
      })}

      {/* RE-DESIGNED DETAIL CARD (Rich Hover Frosted Glassmorphism Card) */}
      {activeNode && activeNode.card && (
        <div
          className="absolute z-30 transition-all duration-300 ease-out"
          style={{
            left: activeNode.x > 50 ? `${Math.max(8, activeNode.x - 40)}%` : `${Math.min(64, activeNode.x + 8)}%`,
            top: activeNode.y > 50 ? `${Math.max(8, activeNode.y - 36)}%` : `${Math.min(60, activeNode.y + 6)}%`,
          }}
        >
          <div className="w-[290px] sm:w-[330px] rounded-2xl border border-blue-200/80 bg-white/95 p-4.5 sm:p-5 shadow-[0_20px_50px_rgba(30,58,138,0.18)] backdrop-blur-xl ring-1 ring-blue-900/5 animate-scaleUp">
            {/* Header Badge in Brand Blue */}
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/80">
                {activeNode.card.badge}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Active Node</span>
            </div>

            {/* Title with Perfect Vietnamese Typography Rendering */}
            <h4 className="text-sm sm:text-base font-extrabold text-[#0F172A] leading-snug">
              {activeNode.card.title}
            </h4>

            {/* Description */}
            <p className="mt-2 text-xs leading-relaxed text-[#334155]">
              {activeNode.card.description}
            </p>

            {/* Action CTA link in Vivid Brand Blue */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (activeNode.card?.actionSectionId) {
                    const el = document.getElementById(activeNode.card.actionSectionId);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <span>{activeNode.card.ctaText}</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
              <span className="text-[10px] font-medium text-slate-400">Continuum AI</span>
            </div>
          </div>
        </div>
      )}

      {/* Micro Tooltip with Tiny Glowing Blue Dot */}
      <div className="pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-white/85 px-4 py-1.5 text-[11px] font-semibold text-slate-600 border border-blue-100/90 shadow-sm backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-pulse" />
        <span>Rê chuột hoặc nhấp vào chồi hạt để khám phá dòng chảy tri thức</span>
      </div>
    </div>
  );
}
