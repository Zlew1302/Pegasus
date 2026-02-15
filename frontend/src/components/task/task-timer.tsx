"use client";

import { useEffect, useState } from "react";
import { Clock, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimeTracking } from "@/hooks/use-time-tracking";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} Min`;
}

function LiveCounter({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="font-mono text-sm text-[hsl(var(--accent-orange))]">
      {elapsed}
    </span>
  );
}

interface TaskTimerProps {
  taskId: string;
}

export function TaskTimer({ taskId }: TaskTimerProps) {
  const {
    runningEntry,
    totalMinutes,
    startTimer,
    stopTimer,
    addManualEntry,
  } = useTimeTracking(taskId);

  const [showManual, setShowManual] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNote, setManualNote] = useState("");

  const handleManualSubmit = async () => {
    const mins = parseInt(manualMinutes, 10);
    if (!mins || mins <= 0) return;
    await addManualEntry(mins, manualNote || undefined);
    setManualMinutes("");
    setManualNote("");
    setShowManual(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        {runningEntry ? (
          <>
            <LiveCounter startedAt={runningEntry.started_at} />
            <span className="text-[10px] text-muted-foreground">läuft</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={stopTimer}
            >
              <Pause className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              {totalMinutes > 0
                ? formatDuration(totalMinutes)
                : "Keine Zeit erfasst"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={startTimer}
            >
              <Play className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowManual(!showManual)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {showManual && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            placeholder="Min"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            className="h-7 w-16 rounded border border-border bg-secondary px-2 text-xs"
          />
          <input
            type="text"
            placeholder="Notiz"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            className="h-7 flex-1 rounded border border-border bg-secondary px-2 text-xs"
          />
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleManualSubmit}>
            Speichern
          </Button>
        </div>
      )}
    </div>
  );
}
