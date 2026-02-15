"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WidgetLayout } from "@/types";
import { WIDGET_REGISTRY, WIDGET_MAP } from "./widget-registry";

const STORAGE_KEY = "crewboard-dashboard-v4";

interface DashboardLayoutState {
  layout: WidgetLayout[];
  visibleWidgets: string[];
}

// Build the default layout from registry
function buildDefaultLayout(): DashboardLayoutState {
  const visibleWidgets = WIDGET_REGISTRY.filter((w) => w.defaultVisible).map(
    (w) => w.id
  );

  // Arrange default-visible widgets in the 12-column grid (rowHeight=70)
  const layout: WidgetLayout[] = [
    // Row 0: KPI cards (2 row units = 140px — fits vertical layout with sparkline)
    { i: "kpi-agents", x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    { i: "kpi-tasks", x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    { i: "kpi-cost", x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    { i: "kpi-pending", x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 2 },
    // Row 2: Charts (4 units = 280px)
    { i: "chart-costs", x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3, maxW: 12, maxH: 8 },
    { i: "chart-productivity", x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3, maxW: 12, maxH: 8 },
    // Row 6: Activity + Approvals + Agents — 3 equal columns
    { i: "activity", x: 0, y: 6, w: 4, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 10 },
    { i: "approvals", x: 4, y: 6, w: 4, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 8 },
    { i: "agents", x: 8, y: 6, w: 4, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 10 },
    // Row 10: Projects + Todos — 2 equal columns
    { i: "projects", x: 0, y: 10, w: 6, h: 4, minW: 4, minH: 3, maxW: 12, maxH: 10 },
    { i: "todos", x: 6, y: 10, w: 6, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 10 },
  ];

  return { layout, visibleWidgets };
}

function loadState(): DashboardLayoutState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.layout && parsed.visibleWidgets) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveState(state: DashboardLayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

export function useDashboardLayout() {
  const [state, setState] = useState<DashboardLayoutState>(buildDefaultLayout);

  // Use a ref to access current state in callbacks without re-creating them
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load persisted state on mount (fallback to defaults if saved state is empty/broken)
  useEffect(() => {
    const saved = loadState();
    if (saved && saved.visibleWidgets.length > 0 && saved.layout.length > 0) {
      setState(saved);
    }
  }, []);

  const updateLayout = useCallback((newLayout: WidgetLayout[]) => {
    const current = stateRef.current;
    // Only keep layout items for visible widgets, preserve min/max constraints
    const mapped = newLayout
      .filter((l) => current.visibleWidgets.includes(l.i))
      .map((l) => {
        const def = WIDGET_MAP[l.i];
        return {
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: def?.defaultLayout.minW,
          minH: def?.defaultLayout.minH,
          maxW: def?.defaultLayout.maxW,
          maxH: def?.defaultLayout.maxH,
        };
      });

    // Check if layout actually changed to avoid unnecessary re-renders
    const layoutChanged = mapped.some((item, idx) => {
      const old = current.layout[idx];
      if (!old) return true;
      return item.i !== old.i || item.x !== old.x || item.y !== old.y || item.w !== old.w || item.h !== old.h;
    }) || mapped.length !== current.layout.length;

    if (layoutChanged) {
      const next = { ...current, layout: mapped };
      setState(next);
      saveState(next);
    }
  }, []);

  const addWidget = useCallback((widgetId: string) => {
    const current = stateRef.current;
    if (current.visibleWidgets.includes(widgetId)) return;
    const def = WIDGET_MAP[widgetId];
    if (!def) return;

    // Find the max Y position to append at the bottom
    const maxY = current.layout.reduce(
      (max, l) => Math.max(max, l.y + l.h),
      0
    );

    const newItem: WidgetLayout = {
      i: widgetId,
      x: 0,
      y: maxY,
      w: def.defaultLayout.w,
      h: def.defaultLayout.h,
      minW: def.defaultLayout.minW,
      minH: def.defaultLayout.minH,
      maxW: def.defaultLayout.maxW,
      maxH: def.defaultLayout.maxH,
    };

    const next = {
      layout: [...current.layout, newItem],
      visibleWidgets: [...current.visibleWidgets, widgetId],
    };
    setState(next);
    saveState(next);
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    const current = stateRef.current;
    const next = {
      layout: current.layout.filter((l) => l.i !== widgetId),
      visibleWidgets: current.visibleWidgets.filter((id) => id !== widgetId),
    };
    setState(next);
    saveState(next);
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    const current = stateRef.current;
    if (current.visibleWidgets.includes(widgetId)) {
      removeWidget(widgetId);
    } else {
      addWidget(widgetId);
    }
  }, [addWidget, removeWidget]);

  const resetLayout = useCallback(() => {
    const defaults = buildDefaultLayout();
    setState(defaults);
    saveState(defaults);
  }, []);

  return {
    layout: state.layout,
    visibleWidgets: state.visibleWidgets,
    updateLayout,
    addWidget,
    removeWidget,
    toggleWidget,
    resetLayout,
  };
}
