"use client";

import { useState } from "react";
import { MessageSquareWarning, Bot, Clock, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { InfoPopup } from "./info-popup";
import type { ApprovalWithContext } from "@/types";

interface PendingInputWidgetProps {
  count: number;
}

export function PendingInputWidget({ count }: PendingInputWidgetProps) {
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <>
      <div
        className="flex h-full cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:border-yellow-500/50"
        onClick={() => setPopupOpen(true)}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Offene Eingaben
          </span>
          <MessageSquareWarning className="h-3.5 w-3.5 text-yellow-500" />
        </div>
        <div>
          <span className={`text-lg font-bold leading-tight ${count > 0 ? "text-yellow-500" : "text-foreground"}`}>
            {count}
          </span>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {count === 0
              ? "Keine offenen Genehmigungen"
              : count === 1
                ? "Genehmigung wartet"
                : "Genehmigungen warten"}
          </p>
        </div>
      </div>

      <PendingInputPopup open={popupOpen} onClose={() => setPopupOpen(false)} />
    </>
  );
}

function PendingInputPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: approvals } = useSWR<ApprovalWithContext[]>(
    open ? "/approvals/with-context?status=pending" : null,
    fetcher
  );

  return (
    <InfoPopup open={open} onClose={onClose} title="Offene Genehmigungen">
      {!approvals || approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/30" />
          <p className="text-xs text-muted-foreground">
            Keine offenen Genehmigungen.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3"
            >
              <p className="text-xs font-medium text-yellow-400">
                {a.description || a.type}
              </p>

              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {a.agent_type_name && (
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3 text-[var(--agent-glow-color)]" />
                    <span>Agent: <span className="text-foreground">{a.agent_type_name}</span></span>
                  </div>
                )}
                {a.task_title && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Aufgabe: <span className="text-foreground">{a.task_title}</span></span>
                  </div>
                )}
                {a.project_title && (
                  <div className="flex items-center gap-2">
                    <span className="ml-0.5 h-2 w-2 rounded-sm bg-[hsl(var(--accent-orange))]" />
                    <span>Projekt: <span className="text-foreground">{a.project_title}</span></span>
                  </div>
                )}
              </div>

              {typeof a.progress_percent === "number" && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{a.current_step ? `Schritt: ${a.current_step}` : "Fortschritt"}</span>
                    <span>{a.progress_percent}%</span>
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all"
                      style={{ width: `${a.progress_percent}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="mt-2 text-[10px] text-muted-foreground/60">
                Angefragt{" "}
                {formatDistanceToNow(new Date(a.requested_at), {
                  locale: de,
                  addSuffix: true,
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </InfoPopup>
  );
}
