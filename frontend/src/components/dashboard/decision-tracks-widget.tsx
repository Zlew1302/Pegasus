"use client";

import { Network, Users, FileSearch, Loader2 } from "lucide-react";
import { useOrgInsights } from "@/hooks/use-tracks";
import { ENTITY_TYPE_COLORS } from "@/types";

interface DecisionTracksWidgetProps {
  embedded?: boolean;
}

export function DecisionTracksWidget({
  embedded = false,
}: DecisionTracksWidgetProps) {
  const { insights, isLoading } = useOrgInsights();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!insights || insights.summary.total_track_points === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Network className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-xs">Noch keine Organisations-Daten</p>
        <p className="mt-1 text-[10px] opacity-60">
          Starte Agenten, um die Organisations-Map aufzubauen
        </p>
      </div>
    );
  }

  const { summary, top_entities, top_relationships } = insights;

  const kpis = [
    { icon: Users, label: "Entitaeten", value: summary.total_entities },
    { icon: Network, label: "Beziehungen", value: summary.total_relationships },
    {
      icon: FileSearch,
      label: "TrackPoints",
      value: summary.total_track_points,
    },
  ];

  const content = (
    <div className="flex h-full flex-col gap-3">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-md bg-secondary/30 px-2 py-1.5 text-center"
          >
            <kpi.icon className="mx-auto mb-0.5 h-3.5 w-3.5 text-[hsl(var(--agent-glow))]" />
            <p className="text-lg font-semibold">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Top Entities */}
      {top_entities.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Haeufigste Entitaeten
          </p>
          <div className="space-y-0.5">
            {top_entities.slice(0, 5).map((entity) => {
              const colors = ENTITY_TYPE_COLORS[entity.type] ?? {
                color: "text-slate-400",
                bg: "bg-slate-500/10",
              };
              return (
                <div
                  key={entity.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className={`inline-block rounded px-1 py-0 text-[9px] ${colors.bg} ${colors.color}`}
                  >
                    {entity.type}
                  </span>
                  <span className="flex-1 truncate">{entity.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {entity.occurrences}x
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Relationships */}
      {top_relationships.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Staerkste Verbindungen
          </p>
          <div className="space-y-0.5">
            {top_relationships.slice(0, 3).map((rel, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className="truncate">{rel.source.name}</span>
                <span className="shrink-0 text-muted-foreground/40">—</span>
                <span className="truncate">{rel.target.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {rel.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Network className="h-4 w-4 text-[hsl(var(--agent-glow))]" />
        Organisations-Map
      </h3>
      {content}
    </div>
  );
}
