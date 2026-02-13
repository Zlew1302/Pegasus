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

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "Zu erledigen",
  in_progress: "In Bearbeitung",
  review: "Review",
  done: "Erledigt",
  blocked: "Blockiert",
};

type ZoomLevel = "week" | "month" | "quarter";
const PX_PER_DAY: Record<ZoomLevel, number> = {
  week: 40,
  month: 16,
  quarter: 6,
};

interface DragPreview {
  taskId: string;
  newX: number;
  newWidth: number;
  newStartDate: Date;
  newEndDate: Date;
}

interface HoverTooltip {
  taskId: string;
  mouseX: number;
  mouseY: number;
}

interface GanttChartProps {
  projectId: string;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export function GanttChart({ projectId, searchQuery = "", onSearchChange }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [showCompleted, setShowCompleted] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: "move" | "resize";
    startX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  const { data: tasks, mutate } = useSWR<TimelineTask[]>(
    `/projects/${projectId}/timeline?include_done=${showCompleted}`,
    fetcher
  );

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      if (t.parent_task_id) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, searchQuery]);

  const pxPerDay = PX_PER_DAY[zoom];
  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 48;

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

    const total = Math.ceil(
      (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { minDate: min, maxDate: max, totalDays: total };
  }, [filteredTasks]);

  const dateToX = useCallback(
    (date: Date) => {
      const days =
        (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      return days * pxPerDay;
    },
    [minDate, pxPerDay]
  );

  const getTaskBar = useCallback(
    (task: TimelineTask) => {
      const start = task.start_date ? new Date(task.start_date) : new Date();
      const durationDays = task.estimated_duration_minutes
        ? task.estimated_duration_minutes / (60 * 8)
        : 7;
      const end = task.deadline
        ? new Date(task.deadline)
        : new Date(start.getTime() + durationDays * 86400000);
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
        label: current.toLocaleDateString("de-DE", {
          month: "short",
          year: "2-digit",
        }),
        x,
        width,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return headers;
  }, [minDate, maxDate, dateToX]);

  // Generate week day markers (Monday lines) for week/month zoom
  const weekMarkers = useMemo(() => {
    if (zoom === "quarter") return [];
    const markers: { x: number; label: string }[] = [];
    const current = new Date(minDate);
    // Advance to next Monday
    const dayOfWeek = current.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    current.setDate(current.getDate() + daysUntilMonday);

    while (current <= maxDate) {
      markers.push({
        x: dateToX(current),
        label: current.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      });
      current.setDate(current.getDate() + 7);
    }
    return markers;
  }, [minDate, maxDate, dateToX, zoom]);

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
      setDragging({
        taskId,
        type,
        startX: e.clientX,
        origStart: bar.start,
        origEnd: bar.end,
      });
      // Clear hover tooltip during drag
      setHoverTooltip(null);
    },
    [filteredTasks, getTaskBar]
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const daysDelta = Math.round(dx / pxPerDay);

      if (dragging.type === "move") {
        const newStartDate = new Date(dragging.origStart);
        newStartDate.setDate(newStartDate.getDate() + daysDelta);
        const newEndDate = new Date(dragging.origEnd);
        newEndDate.setDate(newEndDate.getDate() + daysDelta);
        const newX = dateToX(newStartDate);
        const newWidth = Math.max(dateToX(newEndDate) - newX, pxPerDay);
        setDragPreview({
          taskId: dragging.taskId,
          newX,
          newWidth,
          newStartDate,
          newEndDate,
        });
      } else {
        // Resize: keep start, change end
        const newEndDate = new Date(dragging.origEnd);
        newEndDate.setDate(newEndDate.getDate() + daysDelta);
        const newX = dateToX(dragging.origStart);
        const newWidth = Math.max(dateToX(newEndDate) - newX, pxPerDay);
        setDragPreview({
          taskId: dragging.taskId,
          newX,
          newWidth,
          newStartDate: dragging.origStart,
          newEndDate,
        });
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const daysDelta = Math.round(dx / pxPerDay);

      setDragPreview(null);

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
  }, [dragging, pxPerDay, mutate, dateToX]);

  // Hover tooltip handler
  const handleBarMouseEnter = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      if (dragging) return;
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      setHoverTooltip({
        taskId,
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top,
      });
    },
    [dragging]
  );

  const handleBarMouseLeave = useCallback(() => {
    setHoverTooltip(null);
  }, []);

  // Dependency arrows
  const depArrows = useMemo(() => {
    if (!filteredTasks) return [];
    const taskIndexMap = new Map(filteredTasks.map((t, i) => [t.id, i]));
    const arrows: {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }[] = [];

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

  // Format date for display
  const formatDate = (date: Date) =>
    date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  // Calculate duration in days
  const getDurationDays = (start: Date, end: Date) => {
    return Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
  };

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
        <p className="text-sm text-muted-foreground">
          Keine Tasks für die Timeline vorhanden
        </p>
      </div>
    );
  }

  const svgWidth = totalDays * pxPerDay;
  const svgHeight = HEADER_HEIGHT + filteredTasks.length * ROW_HEIGHT;

  // Get hovered task data for tooltip
  const hoveredTask = hoverTooltip
    ? filteredTasks.find((t) => t.id === hoverTooltip.taskId)
    : null;
  const hoveredBar = hoveredTask ? getTaskBar(hoveredTask) : null;

  // Get drag preview task index for positioning
  const dragPreviewIdx = dragPreview
    ? filteredTasks.findIndex((t) => t.id === dragPreview.taskId)
    : -1;

  return (
    <div className="flex h-full flex-col">
      <GanttToolbar
        zoom={zoom}
        onZoomChange={setZoom}
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted(!showCompleted)}
        onScrollToToday={scrollToToday}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange ?? (() => {})}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Task names */}
        <div className="w-[200px] shrink-0 border-r border-border bg-card">
          <div className="flex h-12 items-center border-b border-border px-3">
            <span className="text-xs font-medium text-muted-foreground">
              Task
            </span>
          </div>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex h-9 items-center border-b border-border/30 px-3"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0 mr-2"
                style={{
                  backgroundColor: STATUS_COLORS[task.status] || "#64748b",
                }}
              />
              <span className="truncate text-xs">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Right: Gantt bars */}
        <div ref={scrollRef} className="relative flex-1 overflow-auto">
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            className="select-none"
          >
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
              {/* Text shadow filter for bar labels */}
              <filter id="textShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#000" floodOpacity="0.8" />
              </filter>
            </defs>

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
                fill={
                  i % 2 === 0 ? "transparent" : "hsl(222 47% 7% / 0.3)"
                }
              />
            ))}

            {/* Horizontal grid lines between rows */}
            {filteredTasks.map((_, i) => (
              <line
                key={`grid-${i}`}
                x1={0}
                y1={HEADER_HEIGHT + i * ROW_HEIGHT}
                x2={svgWidth}
                y2={HEADER_HEIGHT + i * ROW_HEIGHT}
                stroke="hsl(215 16% 47%)"
                strokeWidth={0.5}
                opacity={0.1}
              />
            ))}

            {/* Week day markers (Monday lines) */}
            {weekMarkers.map((marker, i) => (
              <g key={`week-${i}`}>
                <line
                  x1={marker.x}
                  y1={HEADER_HEIGHT}
                  x2={marker.x}
                  y2={svgHeight}
                  stroke="hsl(215 16% 47%)"
                  strokeWidth={0.5}
                  opacity={0.15}
                />
                {/* Show week label at top when zoom is "week" */}
                {zoom === "week" && (
                  <text
                    x={marker.x + 2}
                    y={HEADER_HEIGHT - 4}
                    className="text-[8px]"
                    fill="hsl(215 16% 47%)"
                    opacity={0.5}
                  >
                    {marker.label}
                  </text>
                )}
              </g>
            ))}

            {/* Today marker - more prominent */}
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={svgHeight}
              stroke="#ef4444"
              strokeWidth={2}
              opacity={0.9}
            />
            {/* "Heute" label on today marker */}
            <rect
              x={todayX - 18}
              y={2}
              width={36}
              height={14}
              rx={3}
              fill="#ef4444"
              opacity={0.9}
            />
            <text
              x={todayX}
              y={12}
              textAnchor="middle"
              className="text-[9px] font-semibold"
              fill="white"
            >
              Heute
            </text>

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

            {/* Task bars */}
            {filteredTasks.map((task, i) => {
              const bar = getTaskBar(task);
              const y =
                HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - 20) / 2;
              const color = STATUS_COLORS[task.status] || "#64748b";
              const isDragTarget =
                dragging?.taskId === task.id;

              // Progress based on status
              let progress = 0;
              if (task.status === "done") progress = 1;
              else if (task.status === "review") progress = 0.8;
              else if (task.status === "in_progress") progress = 0.5;
              else if (task.status === "todo") progress = 0.1;

              return (
                <g
                  key={task.id}
                  opacity={isDragTarget ? 0.4 : 1}
                >
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
                    onMouseEnter={(e) => handleBarMouseEnter(task.id, e)}
                    onMouseLeave={handleBarMouseLeave}
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
                    onMouseEnter={(e) => handleBarMouseEnter(task.id, e)}
                    onMouseLeave={handleBarMouseLeave}
                    className="cursor-grab"
                  />
                  {/* Resize handle */}
                  <rect
                    x={bar.x + bar.width - 8}
                    y={y}
                    width={8}
                    height={20}
                    rx={2}
                    fill="transparent"
                    onMouseDown={(e) =>
                      handleMouseDown(task.id, "resize", e)
                    }
                    className="cursor-ew-resize"
                  />
                  {/* Bar label - white with text shadow */}
                  {bar.width > 60 && (
                    <text
                      x={bar.x + 6}
                      y={y + 14}
                      className="text-[10px] pointer-events-none"
                      fill="white"
                      filter="url(#textShadow)"
                    >
                      {task.title.length > bar.width / 7
                        ? task.title.slice(
                            0,
                            Math.floor(bar.width / 7)
                          ) + "..."
                        : task.title}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Drag preview ghost bar */}
            {dragPreview && dragPreviewIdx >= 0 && (() => {
              const y =
                HEADER_HEIGHT +
                dragPreviewIdx * ROW_HEIGHT +
                (ROW_HEIGHT - 20) / 2;
              const task = filteredTasks[dragPreviewIdx];
              const color = STATUS_COLORS[task.status] || "#64748b";

              return (
                <g>
                  {/* Ghost bar - dashed border, semi-transparent */}
                  <rect
                    x={dragPreview.newX}
                    y={y}
                    width={dragPreview.newWidth}
                    height={20}
                    rx={4}
                    fill={color}
                    opacity={0.15}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    className="pointer-events-none"
                  />
                  {/* Date label on preview */}
                  <rect
                    x={dragPreview.newX}
                    y={y - 18}
                    width={Math.max(dragPreview.newWidth, 120)}
                    height={14}
                    rx={3}
                    fill="hsl(222 47% 11%)"
                    stroke="hsl(215 16% 30%)"
                    strokeWidth={0.5}
                    opacity={0.95}
                    className="pointer-events-none"
                  />
                  <text
                    x={dragPreview.newX + 4}
                    y={y - 8}
                    className="text-[9px] pointer-events-none"
                    fill="hsl(215 16% 70%)"
                  >
                    {formatDate(dragPreview.newStartDate)} — {formatDate(dragPreview.newEndDate)}
                    {" "}({getDurationDays(dragPreview.newStartDate, dragPreview.newEndDate)} Tage)
                  </text>
                </g>
              );
            })()}

            {/* Hover tooltip */}
            {hoverTooltip && hoveredTask && hoveredBar && !dragging && (() => {
              const tooltipW = 200;
              const tooltipH = 76;
              // Position tooltip above and to the right of the mouse
              let tx = hoverTooltip.mouseX + 12;
              let ty = hoverTooltip.mouseY - tooltipH - 8;
              // Clamp within SVG bounds
              if (tx + tooltipW > svgWidth) tx = hoverTooltip.mouseX - tooltipW - 12;
              if (ty < 0) ty = hoverTooltip.mouseY + 20;

              const duration = getDurationDays(hoveredBar.start, hoveredBar.end);

              return (
                <g className="pointer-events-none">
                  <rect
                    x={tx}
                    y={ty}
                    width={tooltipW}
                    height={tooltipH}
                    rx={6}
                    fill="hsl(222 47% 8%)"
                    stroke="hsl(215 16% 25%)"
                    strokeWidth={1}
                    opacity={0.97}
                  />
                  {/* Task title */}
                  <text
                    x={tx + 10}
                    y={ty + 16}
                    className="text-[11px] font-medium"
                    fill="white"
                  >
                    {hoveredTask.title.length > 28
                      ? hoveredTask.title.slice(0, 28) + "..."
                      : hoveredTask.title}
                  </text>
                  {/* Start */}
                  <text
                    x={tx + 10}
                    y={ty + 32}
                    className="text-[9px]"
                    fill="hsl(215 16% 60%)"
                  >
                    Start: {formatDate(hoveredBar.start)}
                  </text>
                  {/* End */}
                  <text
                    x={tx + 10}
                    y={ty + 46}
                    className="text-[9px]"
                    fill="hsl(215 16% 60%)"
                  >
                    Ende: {formatDate(hoveredBar.end)}
                  </text>
                  {/* Duration + Status */}
                  <text
                    x={tx + 10}
                    y={ty + 60}
                    className="text-[9px]"
                    fill="hsl(215 16% 60%)"
                  >
                    {duration} Tage
                  </text>
                  {/* Status badge */}
                  <rect
                    x={tx + 10 + duration.toString().length * 5 + 35}
                    y={ty + 52}
                    width={
                      (STATUS_LABELS[hoveredTask.status] || hoveredTask.status)
                        .length *
                        5.5 +
                      10
                    }
                    height={13}
                    rx={3}
                    fill={STATUS_COLORS[hoveredTask.status] || "#64748b"}
                    opacity={0.25}
                  />
                  <text
                    x={tx + 10 + duration.toString().length * 5 + 40}
                    y={ty + 61}
                    className="text-[8px] font-medium"
                    fill={STATUS_COLORS[hoveredTask.status] || "#64748b"}
                  >
                    {STATUS_LABELS[hoveredTask.status] || hoveredTask.status}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}
