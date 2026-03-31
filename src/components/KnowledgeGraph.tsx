"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocale } from "@/components/LocaleProvider";

interface GraphNode {
  id: string;
  label: string;
  category: string;
  tags: string[];
  selected: boolean;
  // Layout computed at render
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string | null;
  strength: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  factual: "#3b82f6",
  skills: "#eab308",
  experience: "#22c55e",
  relational: "#a855f7",
  media: "#ec4899",
  opinion: "#f97316",
  meta: "#06b6d4",
  workflow: "#10b981",
  framework: "#6366f1",
};

const RELATION_LABELS: Record<string, string> = {
  used_in: "应用于",
  belongs_to: "属于",
  requires: "依赖",
  produced: "产出",
  collaborated_with: "协作",
  led_to: "发展为",
  part_of: "包含于",
};

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0, scale: 1 });
  const animRef = useRef<number>(0);
  const { locale } = useLocale();

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-graph");
      if (!res.ok) return;
      const data = await res.json();
      const { nodes: rawNodes, edges: rawEdges } = data as { nodes: Array<{ id: string; label: string; category: string; tags: string[]; selected: boolean }>; edges: GraphEdge[] };

      // Initialize positions in a circle
      const cx = 400, cy = 300;
      const radius = Math.min(250, rawNodes.length * 12);
      const nodes: GraphNode[] = rawNodes.map((n, i) => {
        const angle = (i / rawNodes.length) * Math.PI * 2;
        return {
          ...n,
          x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
          y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
        };
      });

      nodesRef.current = nodes;
      edgesRef.current = rawEdges;
      setStats({ nodes: nodes.length, edges: rawEdges.length });
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // Force-directed layout simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes.length === 0) return;

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (400 - node.x) * 0.001;
      node.vy += (300 - node.y) * 0.001;
    }

    // Apply velocity with damping
    for (const node of nodes) {
      if (dragRef.current?.node.id === node.id) continue;
      node.vx *= 0.85;
      node.vy *= 0.85;
      node.x += node.vx;
      node.y += node.vy;
    }
  }, []);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      if (canvas.width !== rect.width * 2 || canvas.height !== rect.height * 2) {
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.height + "px";
      }
    }

    const dpr = 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { x: panX, y: panY, scale } = panRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Draw edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = hovered && (hovered.id === a.id || hovered.id === b.id)
        ? "rgba(99, 102, 241, 0.6)"
        : "rgba(150, 150, 180, 0.15)";
      ctx.lineWidth = hovered && (hovered.id === a.id || hovered.id === b.id) ? 2 : 1;
      ctx.stroke();

      // Edge label at midpoint
      if (hovered && (hovered.id === a.id || hovered.id === b.id)) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const label = locale === "zh" ? (RELATION_LABELS[edge.type] || edge.type) : edge.type;
        ctx.font = "9px -apple-system, sans-serif";
        ctx.fillStyle = "rgba(99, 102, 241, 0.8)";
        ctx.textAlign = "center";
        ctx.fillText(label, mx, my - 4);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const color = CATEGORY_COLORS[node.category] || "#6b7280";
      const isHovered = hovered?.id === node.id;
      const isConnected = hovered && edges.some(e =>
        (e.source === hovered.id && e.target === node.id) ||
        (e.target === hovered.id && e.source === node.id)
      );
      const dimmed = hovered && !isHovered && !isConnected;

      const r = isHovered ? 10 : 7;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dimmed ? `${color}33` : color;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node label
      if (!dimmed) {
        ctx.font = `${isHovered ? "bold " : ""}10px -apple-system, sans-serif`;
        ctx.fillStyle = dimmed ? "rgba(100,100,120,0.3)" : "rgba(30,30,50,0.85)";
        ctx.textAlign = "center";
        const label = node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label;
        ctx.fillText(label, node.x, node.y + r + 12);
      }
    }

    ctx.restore();

    // Simulate physics
    simulate();
    animRef.current = requestAnimationFrame(render);
  }, [hovered, simulate, locale]);

  useEffect(() => {
    if (loading) return;
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [loading, render]);

  // Mouse interaction
  const getNodeAt = useCallback((mx: number, my: number): GraphNode | null => {
    const { x: panX, y: panY, scale } = panRef.current;
    const x = (mx - panX) / scale;
    const y = (my - panY) / scale;
    for (const node of nodesRef.current) {
      const dx = node.x - x, dy = node.y - y;
      if (dx * dx + dy * dy < 144) return node; // 12px radius
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (dragRef.current) {
      const { x: panX, y: panY, scale } = panRef.current;
      dragRef.current.node.x = (mx - panX) / scale;
      dragRef.current.node.y = (my - panY) / scale;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
      return;
    }

    const node = getNodeAt(mx, my);
    setHovered(node);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? "grab" : "default";
    }
  }, [getNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) {
      dragRef.current = { node, offsetX: 0, offsetY: 0 };
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    panRef.current.scale = Math.max(0.3, Math.min(3, panRef.current.scale * delta));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-xs text-gray-500">{locale === "zh" ? "加载知识图谱..." : "Loading knowledge graph..."}</p>
        </div>
      </div>
    );
  }

  if (stats.nodes === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
            <span className="text-2xl opacity-30">🕸️</span>
          </div>
          <p className="text-gray-500">{locale === "zh" ? "暂无知识节点。上传数据源后会自动生成图谱。" : "No knowledge nodes yet. Upload sources to generate the graph."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Legend + stats */}
      <div className="shrink-0 px-4 py-2 border-b border-gray-200/60 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
            const count = nodesRef.current.filter(n => n.category === cat).length;
            if (count === 0) return null;
            return (
              <span key={cat} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {cat} ({count})
              </span>
            );
          })}
        </div>
        <span className="text-[10px] text-gray-400">
          {stats.nodes} {locale === "zh" ? "节点" : "nodes"} · {stats.edges} {locale === "zh" ? "关联" : "edges"}
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-white">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full"
        />

        {/* Hover tooltip */}
        {hovered && (
          <div className="absolute top-3 right-3 max-w-xs bg-white border border-gray-200 rounded-xl shadow-lg p-3 pointer-events-none">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[hovered.category] }} />
              <span className="text-xs font-semibold text-gray-800 truncate">{hovered.label}</span>
            </div>
            <span className="text-[10px] text-gray-500">{hovered.category}</span>
            {hovered.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {hovered.tags.slice(0, 5).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tag}</span>
                ))}
              </div>
            )}
            {/* Connected edges */}
            {edgesRef.current.filter(e => e.source === hovered.id || e.target === hovered.id).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[9px] text-gray-400 mb-1">{locale === "zh" ? "关联：" : "Relations:"}</p>
                {edgesRef.current
                  .filter(e => e.source === hovered.id || e.target === hovered.id)
                  .slice(0, 5)
                  .map(e => {
                    const other = nodesRef.current.find(n => n.id === (e.source === hovered.id ? e.target : e.source));
                    const dir = e.source === hovered.id ? "→" : "←";
                    const relLabel = locale === "zh" ? (RELATION_LABELS[e.type] || e.type) : e.type;
                    return (
                      <p key={e.id} className="text-[9px] text-gray-500 truncate">
                        {dir} {relLabel} {other?.label || "?"}
                      </p>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
