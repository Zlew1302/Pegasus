"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Bot, CheckCircle2, Wallet } from "lucide-react";
import { useDashboardStats, useActivity, useCosts, useProductivity } from "@/hooks/use-dashboard";
import { useDashboardLayout } from "@/components/dashboard/use-dashboard-layout";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WidgetPicker } from "@/components/dashboard/widget-picker";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartWidget } from "@/components/dashboard/chart-widget";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PendingInputWidget } from "@/components/dashboard/pending-input-widget";
import { TodoWidget } from "@/components/dashboard/todo-widget";
import { AgentShortcuts } from "@/components/dashboard/agent-shortcuts";
import { TeamWidget } from "@/components/dashboard/team-widget";
import { ProjectOverviewWidget } from "@/components/dashboard/project-overview-widget";
import { RecentDocumentsWidget } from "@/components/dashboard/recent-documents-widget";
import { NotificationsWidget } from "@/components/dashboard/notifications-widget";
import { ApprovalQueueWidget } from "@/components/dashboard/approval-queue-widget";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions-widget";
import { DecisionTracksWidget } from "@/components/dashboard/decision-tracks-widget";

// Measure container width with ResizeObserver
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = el.offsetWidth;
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

function DashboardGrid() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GridLayout } = require("react-grid-layout");

  const { stats } = useDashboardStats();
  const { activity } = useActivity();
  const { costs } = useCosts();
  const { productivity } = useProductivity();

  const { ref: containerRef, width: containerWidth } = useContainerWidth();

  const {
    layout,
    visibleWidgets,
    updateLayout,
    toggleWidget,
    removeWidget,
    resetLayout,
  } = useDashboardLayout();

  const [pickerOpen, setPickerOpen] = useState(false);

  const costChartData = useMemo(
    () => costs.map((c) => ({ date: c.date, value: c.cost_cents })),
    [costs]
  );
  const productivityChartData = useMemo(
    () => productivity.map((p) => ({ date: p.date, value: p.tasks_completed })),
    [productivity]
  );

  // Filter layout to only include visible widgets
  const activeLayout = layout.filter((l) => visibleWidgets.includes(l.i));

  // Stable ref for onLayoutChange — avoids re-renders since updateLayout is already stable
  const handleLayoutChange = useCallback(
    (newLayout: typeof layout) => {
      updateLayout(newLayout);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateLayout]
  );

  // Widget render map
  const renderWidget = (id: string) => {
    switch (id) {
      case "kpi-agents":
        return (
          <WidgetWrapper id={id} onRemove={removeWidget} noDragHeader>
            <KpiCard
              icon={Bot}
              label="Aktive Agenten"
              value={stats?.active_agents ?? 0}
              color="text-[var(--agent-glow-color)]"
            />
          </WidgetWrapper>
        );
      case "kpi-tasks":
        return (
          <WidgetWrapper id={id} onRemove={removeWidget} noDragHeader>
            <KpiCard
              icon={CheckCircle2}
              label="Tasks diese Woche"
              value={stats?.tasks_completed_this_week ?? 0}
              color="text-green-500"
            />
          </WidgetWrapper>
        );
      case "kpi-cost":
        return (
          <WidgetWrapper id={id} onRemove={removeWidget} noDragHeader>
            <KpiCard
              icon={Wallet}
              label="Token-Kosten 7T"
              value={`${((stats?.weekly_token_cost_cents ?? 0) / 100).toFixed(2)} €`}
              color="text-[hsl(var(--accent-orange))]"
            />
          </WidgetWrapper>
        );
      case "kpi-pending":
        return (
          <WidgetWrapper id={id} onRemove={removeWidget} noDragHeader>
            <PendingInputWidget count={stats?.pending_inputs ?? 0} />
          </WidgetWrapper>
        );
      case "chart-costs":
        return (
          <WidgetWrapper id={id} title="Token-Kosten" onRemove={removeWidget}>
            <ChartWidget
              title="Token-Kosten"
              data={costChartData}
              color="hsl(24 95% 53%)"
              valueLabel="Kosten"
              formatValue={(v) => `${(v / 100).toFixed(0)}€`}
              embedded
            />
          </WidgetWrapper>
        );
      case "chart-productivity":
        return (
          <WidgetWrapper id={id} title="Produktivität" onRemove={removeWidget}>
            <ChartWidget
              title="Produktivität"
              data={productivityChartData}
              color="hsl(142 71% 45%)"
              valueLabel="Tasks erledigt"
              embedded
            />
          </WidgetWrapper>
        );
      case "activity":
        return (
          <WidgetWrapper id={id} title="Agent-Aktivität" onRemove={removeWidget}>
            <ActivityFeed activity={activity} embedded />
          </WidgetWrapper>
        );
      case "todos":
        return (
          <WidgetWrapper id={id} title="Nächste Schritte" onRemove={removeWidget}>
            <TodoWidget embedded />
          </WidgetWrapper>
        );
      case "agents":
        return (
          <WidgetWrapper id={id} title="Agent-Schnellstart" onRemove={removeWidget}>
            <AgentShortcuts embedded />
          </WidgetWrapper>
        );
      case "teams":
        return (
          <WidgetWrapper id={id} title="Teams" onRemove={removeWidget}>
            <TeamWidget embedded />
          </WidgetWrapper>
        );
      case "projects":
        return (
          <WidgetWrapper id={id} title="Projekte" onRemove={removeWidget}>
            <ProjectOverviewWidget />
          </WidgetWrapper>
        );
      case "documents":
        return (
          <WidgetWrapper id={id} title="Letzte Dokumente" onRemove={removeWidget}>
            <RecentDocumentsWidget />
          </WidgetWrapper>
        );
      case "notifications":
        return (
          <WidgetWrapper id={id} title="Benachrichtigungen" onRemove={removeWidget}>
            <NotificationsWidget />
          </WidgetWrapper>
        );
      case "approvals":
        return (
          <WidgetWrapper id={id} title="Genehmigungen" onRemove={removeWidget}>
            <ApprovalQueueWidget />
          </WidgetWrapper>
        );
      case "quick-actions":
        return (
          <WidgetWrapper id={id} title="Schnellaktionen" onRemove={removeWidget}>
            <QuickActionsWidget />
          </WidgetWrapper>
        );
      case "decision-tracks":
        return (
          <WidgetWrapper id={id} title="Organisations-Map" onRemove={removeWidget}>
            <DecisionTracksWidget embedded />
          </WidgetWrapper>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader
        onOpenPicker={() => setPickerOpen(true)}
        onReset={resetLayout}
      />

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {containerWidth > 0 && (
          <GridLayout
            layout={activeLayout}
            cols={12}
            rowHeight={80}
            width={containerWidth - 32}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
            compactType="vertical"
            preventCollision={false}
            isResizable={true}
            margin={[12, 12] as [number, number]}
          >
            {visibleWidgets.map((id) => (
              <div key={id}>{renderWidget(id)}</div>
            ))}
          </GridLayout>
        )}
      </div>

      <WidgetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        visibleWidgets={visibleWidgets}
        onToggleWidget={toggleWidget}
      />
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Dashboard wird geladen...</p>
      </div>
    );
  }

  return <DashboardGrid />;
}
