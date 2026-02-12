"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Network, Loader2, Filter } from "lucide-react";
import { useEntityGraph } from "@/hooks/use-tracks";
import { ENTITY_TYPE_COLORS } from "@/types";

// ── Force-directed layout ──────────────────────────────────────────

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  name: string;
  occurrences: number;
  radius: number;
}

interface SimEdge {
  source: string;
  target: string;
  weight: number;
}

function runForceLayout(
  nodes: SimNode[],
  edges: SimEdge[],
  width: number,
  height: number,
  iterations = 80
): SimNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const repulsion = 2000 * alpha;
    const attraction = 0.01 * alpha;

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = attraction * dist * edge.weight;
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (width / 2 - node.x) * 0.001;
      node.vy += (height / 2 - node.y) * 0.001;
    }

    // Apply velocities with damping
    for (const node of nodes) {
      node.vx *= 0.8;
      node.vy *= 0.8;
      node.x += node.vx;
      node.y += node.vy;
      // Clamp to bounds
      node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
      node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
    }
  }

  return nodes;
}

// ── Component ──────────────────────────────────────────────────────

const TYPE_HEX: Record<string, string> = {
  Person: "#22d3ee",
  Organization: "#60a5fa",
  SoftwareApplication: "#fbbf24",
  SoftwareSourceCode: "#4ade80",
  DigitalDocument: "#c084fc",
  CommunicationChannel: "#f472b6",
  Project: "#818cf8",
};

interface EntityGraphProps {
  embedded?: boolean;
}

export function EntityGraph({ embedded = false }: EntityGraphProps) {
  const { graph, isLoading } = useEntityGraph(60);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.max(entry.contentRect.width, 200),
          height: Math.max(entry.contentRect.height, 200),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute layout
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!graph || graph.nodes.length === 0)
      return { layoutNodes: [], layoutEdges: [] };

    const filteredNodes = filterType
      ? graph.nodes.filter((n) => n.type === filterType)
      : graph.nodes;

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    const filteredEdges = graph.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    const maxOcc = Math.max(...filteredNodes.map((n) => n.occurrences), 1);

    const simNodes: SimNode[] = filteredNodes.map((n, i) => ({
      id: n.id,
      x: dimensions.width / 2 + (Math.random() - 0.5) * dimensions.width * 0.6,
      y:
        dimensions.height / 2 +
        (Math.random() - 0.5) * dimensions.height * 0.6,
      vx: 0,
      vy: 0,
      type: n.type,
      name: n.name,
      occurrences: n.occurrences,
      radius: 6 + (n.occurrences / maxOcc) * 18,
    }));

    const simEdges: SimEdge[] = filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    const ln = runForceLayout(
      simNodes,
      simEdges,
      dimensions.width,
      dimensions.height
    );

    return { layoutNodes: ln, layoutEdges: simEdges };
  }, [graph, dimensions, filterType]);

  // Connected nodes for hover highlight
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    connected.add(hoveredNode);
    for (const edge of layoutEdges) {
      if (edge.source === hoveredNode) connected.add(edge.target);
      if (edge.target === hoveredNode) connected.add(edge.source);
    }
    return connected;
  }, [hoveredNode, layoutEdges]);

  const nodeMap = useMemo(
    () => new Map(layoutNodes.map((n) => [n.id, n])),
    [layoutNodes]
  );

  // Available types for filter
  const availableTypes = useMemo(() => {
    if (!graph) return [];
    const types = new Set(graph.nodes.map((n) => n.type));
    return Array.from(types).sort();
  }, [graph]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Network className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-xs">Noch kein Entity-Graph</p>
      </div>
    );
  }

  const maxWeight = Math.max(...layoutEdges.map((e) => e.weight), 1);

  const content = (
    <div ref={containerRef} className="relative h-full w-full min-h-[200px]">
      {/* Type filter */}
      {availableTypes.length > 1 && (
        <div className="absolute left-1 top-1 z-10 flex flex-wrap gap-1">
          <button
            onClick={() => setFilterType(null)}
            className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
              filterType === null
                ? "bg-[hsl(var(--agent-glow))]/20 text-[hsl(var(--agent-glow))]"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}
          >
            Alle
          </button>
          {availableTypes.map((t) => {
            const colors = ENTITY_TYPE_COLORS[t] ?? {
              color: "text-slate-400",
              bg: "bg-slate-500/10",
            };
            return (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? null : t)}
                className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
                  filterType === t
                    ? `${colors.bg} ${colors.color}`
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      >
        {/* Edges */}
        {layoutEdges.map((edge, i) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;

          const isHighlighted =
            hoveredNode &&
            (edge.source === hoveredNode || edge.target === hoveredNode);
          const opacity = hoveredNode
            ? isHighlighted
              ? 0.6
              : 0.05
            : 0.15 + (edge.weight / maxWeight) * 0.4;

          return (
            <line
              key={`edge-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="hsl(var(--agent-glow))"
              strokeWidth={1 + (edge.weight / maxWeight) * 2}
              opacity={opacity}
            />
          );
        })}

        {/* Nodes */}
        {layoutNodes.map((node) => {
          const fill = TYPE_HEX[node.type] ?? "#94a3b8";
          const isHovered = hoveredNode === node.id;
          const isConnected = connectedNodes.has(node.id);
          const opacity = hoveredNode
            ? isConnected
              ? 1
              : 0.15
            : 0.8;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={fill}
                opacity={opacity}
                stroke={isHovered ? "#fff" : "transparent"}
                strokeWidth={isHovered ? 2 : 0}
              />
              {(isHovered || node.radius > 14) && (
                <text
                  x={node.x}
                  y={node.y + node.radius + 10}
                  textAnchor="middle"
                  fill="hsl(var(--foreground))"
                  fontSize={10}
                  opacity={opacity}
                >
                  {node.name.length > 20
                    ? node.name.slice(0, 18) + "..."
                    : node.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Network className="h-4 w-4 text-[hsl(var(--agent-glow))]" />
        Entity-Graph
      </h3>
      {content}
    </div>
  );
}
