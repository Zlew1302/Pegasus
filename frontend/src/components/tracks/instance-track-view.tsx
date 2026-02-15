"use client";

import {
  Globe,
  Database,
  BookOpen,
  Search,
  Eye,
  Pencil,
  MessageSquare,
  PlusCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useInstanceTracks } from "@/hooks/use-tracks";
import { ENTITY_TYPE_COLORS } from "@/types";
import type { TrackPointEntry } from "@/types";

const SYSTEM_ICONS: Record<string, typeof Globe> = {
  web: Globe,
  github: Globe,
  internal_db: Database,
  knowledge_base: BookOpen,
  slack: MessageSquare,
  email: MessageSquare,
  drive: BookOpen,
  jira: Database,
  unknown: Search,
};

const ACTION_ICONS: Record<string, typeof Search> = {
  SearchAction: Search,
  ReadAction: Eye,
  WriteAction: Pencil,
  CreateAction: PlusCircle,
  CommunicateAction: MessageSquare,
};

const ACTION_LABELS: Record<string, string> = {
  SearchAction: "Suche",
  ReadAction: "Lesen",
  WriteAction: "Schreiben",
  CreateAction: "Erstellen",
  UpdateAction: "Aktualisieren",
  DeleteAction: "Löschen",
  CommunicateAction: "Kommunikation",
  AssessAction: "Bewertung",
};

function SignalBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color =
    score >= 0.7
      ? "bg-green-500"
      : score >= 0.5
        ? "bg-yellow-500"
        : "bg-red-500/70";

  return (
    <div className="flex items-center gap-1" title={`Signal: ${pct}%`}>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

function TrackPointRow({ point }: { point: TrackPointEntry }) {
  const [expanded, setExpanded] = useState(false);

  const SystemIcon = SYSTEM_ICONS[point.system_type] ?? Search;
  const ActionIcon = ACTION_ICONS[point.action_type] ?? Search;
  const actionLabel = ACTION_LABELS[point.action_type] ?? point.action_type;

  return (
    <div className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary/30"
      >
        {/* Timeline dot + line */}
        <div className="flex flex-col items-center">
          <div className="h-2 w-2 rounded-full bg-[hsl(var(--agent-glow))]" />
        </div>

        {/* System icon */}
        <SystemIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

        {/* System + Action */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-xs font-medium">{point.system_type}</span>
          <ActionIcon className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">
            {actionLabel}
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            ({point.tool_name})
          </span>
        </div>

        {/* Signal + Duration */}
        <SignalBar score={point.signal_score} />
        {point.duration_ms != null && (
          <span className="text-[9px] text-muted-foreground">
            {point.duration_ms}ms
          </span>
        )}

        {/* Expand icon */}
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="ml-6 mt-1 space-y-1 rounded-md bg-secondary/20 p-2 text-[10px]">
          {/* Entities */}
          {point.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {point.entities.map((e, i) => {
                const colors = ENTITY_TYPE_COLORS[e.type] ?? {
                  color: "text-slate-400",
                  bg: "bg-slate-500/10",
                };
                return (
                  <span
                    key={i}
                    className={`rounded px-1.5 py-0.5 ${colors.bg} ${colors.color}`}
                  >
                    {e.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* Input */}
          {point.input_summary && (
            <div>
              <span className="text-muted-foreground">Input: </span>
              <span className="text-foreground/70">{point.input_summary}</span>
            </div>
          )}

          {/* Output */}
          {point.output_summary && (
            <div>
              <span className="text-muted-foreground">Output: </span>
              <span className="text-foreground/70">
                {point.output_summary.slice(0, 200)}
                {point.output_summary.length > 200 ? "..." : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface InstanceTrackViewProps {
  instanceId: string;
}

export function InstanceTrackView({ instanceId }: InstanceTrackViewProps) {
  const { tracks, isLoading } = useInstanceTracks(instanceId);
  const [collapsed, setCollapsed] = useState(true);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Decision Tracks laden...
      </div>
    );
  }

  if (!tracks || tracks.total_points === 0) {
    return null; // Don't show if no tracks
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        Decision Tracks ({tracks.total_points} Punkte)
      </button>

      {!collapsed && (
        <div className="mt-1 space-y-0.5">
          {tracks.track_points.map((point) => (
            <TrackPointRow key={point.id} point={point} />
          ))}
        </div>
      )}
    </div>
  );
}
