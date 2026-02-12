"use client";

import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { ActivityEntry } from "@/types";

interface ActivityFeedProps {
  activity: ActivityEntry[];
  /** When inside WidgetWrapper, don't render own border/title */
  embedded?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  running: "bg-blue-500",
  initializing: "bg-yellow-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
  paused: "bg-orange-500",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Laufend",
  initializing: "Startet",
  completed: "Fertig",
  failed: "Fehler",
  cancelled: "Abgebrochen",
  paused: "Pausiert",
  waiting_input: "Wartet",
};

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const router = useRouter();

  const timeAgo = entry.started_at
    ? formatDistanceToNow(new Date(entry.started_at), {
        locale: de,
        addSuffix: true,
      })
    : null;

  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-md bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50"
      onClick={() => router.push("/projects")}
    >
      <Bot className="h-4 w-4 shrink-0 text-[var(--agent-glow-color)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{entry.agent_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.task_title}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              STATUS_COLORS[entry.status] ?? "bg-gray-500"
            }`}
          />
          <span className="text-[10px] text-muted-foreground">
            {STATUS_LABELS[entry.status] ?? entry.status}
          </span>
        </div>
        {entry.status === "running" && (
          <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-[var(--agent-glow-color)] transition-all"
              style={{ width: `${entry.progress_percent}%` }}
            />
          </div>
        )}
        {timeAgo && (
          <span className="text-[10px] text-muted-foreground/60">
            {timeAgo}
          </span>
        )}
      </div>
    </div>
  );
}

export function ActivityFeed({ activity, embedded = false }: ActivityFeedProps) {
  const content = (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {activity.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Keine Aktivität
        </p>
      ) : (
        activity.map((entry) => (
          <ActivityItem key={entry.instance_id} entry={entry} />
        ))
      )}
    </div>
  );

  if (embedded) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Agent-Aktivität</h3>
      {content}
    </div>
  );
}
