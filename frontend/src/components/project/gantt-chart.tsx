"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { GanttToolbar } from "./gantt-toolbar";
import { apiFetch, fetcher } from "@/lib/api";
import useSWR from "swr";

interface TimelineTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  deadline: string | null;
  estimated_duration_minutes: number | null;
  parent_task_id: string | null;
  dependencies: string[];
}

const STATUS_COLORS: Record<string, string> = {
  backlog: "#64748b",
  todo: "#3b82f6",
  in_progress: "#f97316",
  review: "#a855f7",
  done: "#22c55e",
  blocked: "#ef4444",
};

type ZoomLevel = "week" | "month" | "quarter";
const PX_PER_DAY: Record<ZoomLevel, number> = {
  week: 40,
  month: 16,
  quarter: 6,
};

interface GanttChartProps {
  projectId: string;
}

export function GanttChart({ projectId }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [showCompleted, setShowCompleted] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ taskId: string; type: "move" | "resize"; startX: number; origStart: Date; origEnd: Date } | null>(null);

  const { data: tasks, mutate } = useSWR<TimelineTask[]>(
    `/projects/${projectId}/timeline?include_done=${showCompleted}`,
    fetcher
  );

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => !t.parent_task_id); // Only show top-level tasks
  }, [tasks]);

  const pxPerDay = PX_PER_DAY[zoom];
  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 48;
  const LEFT_WIDTH = 200;

  // Calculate date range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const now = new Date();
    let min = new Date(now);
    let max = new Date(now);
    min.setDate(min.getDate() - 14);
    max.setDate(max.getDate() + 60);

    for (const t of filteredTasks) {
      if (t.start_date) {
        const d = new Date(t.start_date);
        if (d < min) min = new Date(d);
      }
      if (t.deadline) {
        const d = new Date(t.deadline);
        if (d > max) max = new Date(d);
      }
    }

    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);

    const total = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
    return { minDate: min, maxDate: max, totalDays: total };
  }, [filteredTasks]);

  const dateToX = useCallback(
    (date: Date) => {
      const days = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      return days * pxPerDay;
    },
    [minDate, pxPerDay]
  );

  const getTaskBar = useCallback(
    (task: TimelineTask) => {
      const start = task.start_date ? new Date(task.start_date) : new Date();
      const durationDays = task.estimated_duration_minutes
        ? task.estimated_duration_minutes / (60 * 8) // Convert minutes to work days (8h)
        : 7; // Default 7 days
      const end = task.deadline ? new Date(task.deadline) : new Date(start.getTime() + durationDays * 86400000);
      const x = dateToX(start);
      const width = Math.max(dateToX(end) - x, pxPerDay);
      return { x, width, start, end };
    },
    [dateToX, pxPerDay]
  );

  // Generate month headers
  const monthHeaders = useMemo(() => {
    const headers: { label: string; x: number; width: number }[] = [];
    const current = new Date(minDate);
    current.setDate(1);
    if (current < minDate) current.setMonth(current.getMonth() + 1);

    while (current <= maxDate) {
      const x = dateToX(current);
      const nextMonth = new Date(current);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const width = dateToX(nextMonth) - x;
      headers.push({
        label: current.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        x,
        width,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return headers;
  }, [minDate, maxDate, dateToX]);

  // Today marker
  const todayX = dateToX(new Date());

  // Scroll to today on mount
  const scrollToToday = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = todayX - 300;
    }
  }, [todayX]);

  useEffect(() => {
    scrollToToday();
  }, [scrollToToday]);

  // Handle drag for move/resize
  const handleMouseDown = useCallback(
    (taskId: string, type: "move" | "resize", e: React.MouseEvent) => {
      e.stopPropagation();
      const task = filteredTasks.find((t) => t.id === taskId);
      if (!task) return;
      const bar = getTaskBar(task);
      setDragging({ taskId, type, startX: e.clientX, origStart: bar.start, origEnd: bar.end });
    },
    [filteredTasks, getTaskBar]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Visual feedback could be added here
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const daysDelta = Math.round(dx / pxPerDay);

      if (daysDelta === 0) {
        setDragging(null);
        return;
      }

      const updates: Record<string, string> = {};
      if (dragging.type === "move") {
        const newStart = new Date(dragging.origStart);
        newStart.setDate(newStart.getDate() + daysDelta);
        updates.start_date = newStart.toISOString();
        const newEnd = new Date(dragging.origEnd);
        newEnd.setDate(newEnd.getDate() + daysDelta);
        updates.deadline = newEnd.toISOString();
      } else {
        const newEnd = new Date(dragging.origEnd);
        newEnd.setDate(newEnd.getDate() + daysDelta);
        updates.deadline = newEnd.toISOString();
      }

      await apiFetch(`/tasks/${dragging.taskId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      mutate();
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, pxPerDay, mutate]);

  // Dependency arrows
  const depArrows = useMemo(() => {
    if (!filteredTasks) return [];
    const taskIndexMap = new Map(filteredTasks.map((t, i) => [t.id, i]));
    const arrows: { fromX: number; fromY: number; toX: number; toY: number }[] = [];

    for (const task of filteredTasks) {
      const toIdx = taskIndexMap.get(task.id);
      if (toIdx === undefined) continue;
      const toBar = getTaskBar(task);

      for (const depId of task.dependencies) {
        const fromIdx = taskIndexMap.get(depId);
        if (fromIdx === undefined) continue;
        const fromTask = filteredTasks[fromIdx];
        const fromBar = getTaskBar(fromTask);

        arrows.push({
          fromX: fromBar.x + fromBar.width,
          fromY: HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          toX: toBar.x,
          toY: HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
        });
      }
    }
    return arrows;
  }, [filteredTasks, getTaskBar]);

  if (!tasks) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Lade Timeline...</p>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Keine Tasks für die Timeline vorhanden</p>
      </div>
    );
  }

  const svgWidth = totalDays * pxPerDay;
  const svgHeight = HEADER_HEIGHT + filteredTasks.length * ROW_HEIGHT;

  return (
    <div className="flex h-full flex-col">
      <GanttToolbar
        zoom={zoom}
        onZoomChange={setZoom}
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted(!showCompleted)}
        onScrollToToday={scrollToToday}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Task names */}
        <div className="w-[200px] shrink-0 border-r border-border bg-card">
          <div className="flex h-12 items-center border-b border-border px-3">
            <span className="text-xs font-medium text-muted-foreground">Task</span>
          </div>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex h-9 items-center border-b border-border/30 px-3"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0 mr-2"
                style={{ backgroundColor: STATUS_COLORS[task.status] || "#64748b" }}
              />
              <span className="truncate text-xs">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Right: Gantt bars */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <svg width={svgWidth} height={svgHeight} className="select-none">
            {/* Month headers */}
            {monthHeaders.map((header, i) => (
              <g key={i}>
                <rect
                  x={header.x}
                  y={0}
                  width={header.width}
                  height={HEADER_HEIGHT}
                  fill={i % 2 === 0 ? "hsl(224 71% 4%)" : "hsl(222 47% 7%)"}
                />
                <text
                  x={header.x + header.width / 2}
                  y={HEADER_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {header.label}
                </text>
              </g>
            ))}

            {/* Row backgrounds */}
            {filteredTasks.map((_, i) => (
              <rect
                key={i}
                x={0}
                y={HEADER_HEIGHT + i * ROW_HEIGHT}
                width={svgWidth}
                height={ROW_HEIGHT}
                fill={i % 2 === 0 ? "transparent" : "hsl(222 47% 7% / 0.3)"}
              />
            ))}

            {/* Today marker */}
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={svgHeight}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.7}
            />

            {/* Dependency arrows */}
            {depArrows.map((arrow, i) => {
              const midX = (arrow.fromX + arrow.toX) / 2;
              return (
                <path
                  key={i}
                  d={`M ${arrow.fromX} ${arrow.fromY} C ${midX} ${arrow.fromY}, ${midX} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`}
                  fill="none"
                  stroke="hsl(215 16% 47%)"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                  opacity={0.5}
                />
              );
            })}

            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill="hsl(215 16% 47%)"
                  opacity={0.5}
                />
              </marker>
            </defs>

            {/* Task bars */}
            {filteredTasks.map((task, i) => {
              const bar = getTaskBar(task);
              const y = HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - 20) / 2;
              const color = STATUS_COLORS[task.status] || "#64748b";

              // Progress based on status
              let progress = 0;
              if (task.status === "done") progress = 1;
              else if (task.status === "review") progress = 0.8;
              else if (task.status === "in_progress") progress = 0.5;
              else if (task.status === "todo") progress = 0.1;

              return (
                <g key={task.id}>
                  {/* Background bar */}
                  <rect
                    x={bar.x}
                    y={y}
                    width={bar.width}
                    height={20}
                    rx={4}
                    fill={color}
                    opacity={0.2}
                    onMouseDown={(e) => handleMouseDown(task.id, "move", e)}
                    className="cursor-grab"
                  />
                  {/* Progress fill */}
                  <rect
                    x={bar.x}
                    y={y}
                    width={bar.width * progress}
                    height={20}
                    rx={4}
                    fill={color}
                    opacity={0.7}
                    onMouseDown={(e) => handleMouseDown(task.id, "move", e)}
                    className="cursor-grab"
                  />
                  {/* Resize handle */}
                  <rect
                    x={bar.x + bar.width - 6}
                    y={y}
                    width={6}
                    height={20}
                    rx={2}
                    fill="transparent"
                    onMouseDown={(e) => handleMouseDown(task.id, "resize", e)}
                    className="cursor-ew-resize"
                  />
                  {/* Status label */}
                  {bar.width > 60 && (
                    <text
                      x={bar.x + 6}
                      y={y + 14}
                      className="fill-foreground text-[10px] pointer-events-none"
                    >
                      {task.title.length > bar.width / 7
                        ? task.title.slice(0, Math.floor(bar.width / 7)) + "..."
                        : task.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
