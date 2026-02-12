"use client";

import { useMemo } from "react";
import { LayoutGrid, RotateCcw, Bot, Clock, AlertTriangle } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { useProfile } from "@/hooks/use-profile";

interface DashboardHeaderProps {
  onOpenPicker: () => void;
  onReset: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Guten Morgen";
  if (hour >= 12 && hour < 18) return "Guten Tag";
  if (hour >= 18 && hour < 23) return "Guten Abend";
  return "Gute Nacht";
}

export function DashboardHeader({ onOpenPicker, onReset }: DashboardHeaderProps) {
  const { profile } = useProfile();
  const { stats } = useDashboardStats();

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = profile?.display_name || "Lukas";

  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Greeting + Quick Stats */}
        <div>
          <h1 className="text-lg font-bold">
            {greeting}, {displayName}
          </h1>
          <div className="mt-0.5 flex items-center gap-4 text-xs text-muted-foreground">
            {stats && (
              <>
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3 text-[var(--agent-glow-color)]" />
                  {stats.active_agents} {stats.active_agents === 1 ? "Agent" : "Agenten"} aktiv
                </span>
                {stats.pending_inputs > 0 && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <AlertTriangle className="h-3 w-3" />
                    {stats.pending_inputs} {stats.pending_inputs === 1 ? "Genehmigung" : "Genehmigungen"} offen
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {stats.tasks_completed_this_week} Tasks diese Woche
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPicker}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Widget hinzufügen
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Layout zurücksetzen"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
