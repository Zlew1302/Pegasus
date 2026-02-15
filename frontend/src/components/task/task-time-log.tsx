"use client";

import { Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useTimeTracking } from "@/hooks/use-time-tracking";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} Min`;
}

interface TaskTimeLogProps {
  taskId: string;
}

export function TaskTimeLog({ taskId }: TaskTimeLogProps) {
  const { entries, isLoading, deleteEntry } = useTimeTracking(taskId);

  const finishedEntries = entries.filter((e) => !e.is_running);

  if (isLoading || finishedEntries.length === 0) return null;

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        Zeiteinträge
      </h3>
      <div className="space-y-1">
        {finishedEntries.map((entry) => (
          <div
            key={entry.id}
            className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/50 text-xs"
          >
            <span className="font-medium">{formatDuration(entry.duration_minutes)}</span>
            {entry.note && (
              <span className="flex-1 truncate text-muted-foreground">{entry.note}</span>
            )}
            <span className="text-[10px] text-muted-foreground/60 shrink-0">
              {formatDistanceToNow(new Date(entry.created_at), {
                locale: de,
                addSuffix: true,
              })}
            </span>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
