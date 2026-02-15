"use client";

import { useState } from "react";
import {
  Bot,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Zap,
  Brain,
  Wrench,
  FileText,
  ChevronDown,
  ChevronUp,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalWithContext } from "@/types";

interface ApprovalDetailProps {
  approval: ApprovalWithContext;
  onResolve: (approvalId: string, status: string, comment?: string) => void;
}

export function ApprovalDetail({ approval, onResolve }: ApprovalDetailProps) {
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [thoughtsExpanded, setThoughtsExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  // Parse thought log
  let thoughts: { text: string; timestamp: string }[] = [];
  if (approval.thought_log) {
    try {
      thoughts = JSON.parse(approval.thought_log);
    } catch {
      // ignore
    }
  }

  const recentThoughts = thoughts.slice(-10);
  const hasMoreThoughts = thoughts.length > 10;

  return (
    <div className="space-y-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
      {/* Header: Was braucht der Agent? */}
      <div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500 animate-pulse" />
          <p className="text-sm font-semibold text-yellow-200">
            Genehmigung erforderlich
          </p>
        </div>

        {approval.description && (
          <div className="mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
            <p className="text-sm text-yellow-100">{approval.description}</p>
          </div>
        )}
      </div>

      {/* Agent-Kontext */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {approval.agent_type_name && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2">
            <Bot className="h-3 w-3 text-[var(--agent-glow-color)]" />
            <div>
              <p className="text-[10px] text-muted-foreground">Agent</p>
              <p className="font-medium">{approval.agent_type_name}</p>
            </div>
          </div>
        )}
        {approval.task_title && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2">
            <Zap className="h-3 w-3 text-blue-400" />
            <div>
              <p className="text-[10px] text-muted-foreground">Aufgabe</p>
              <p className="font-medium truncate">{approval.task_title}</p>
            </div>
          </div>
        )}
        {approval.project_title && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2">
            <FolderKanban className="h-3 w-3 text-[hsl(var(--accent-orange))]" />
            <div>
              <p className="text-[10px] text-muted-foreground">Projekt</p>
              <p className="font-medium truncate">{approval.project_title}</p>
            </div>
          </div>
        )}
        {typeof approval.progress_percent === "number" && (
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Fortschritt</p>
              <p className="font-medium">{approval.progress_percent}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Fortschrittsbalken */}
      {typeof approval.progress_percent === "number" && approval.progress_percent > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{approval.current_step ?? "Aktueller Schritt"}</span>
            <span>
              {approval.total_steps
                ? `Schritt ${Math.round((approval.progress_percent / 100) * approval.total_steps)} / ${approval.total_steps}`
                : `${approval.progress_percent}%`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-yellow-500 transition-all"
              style={{ width: `${approval.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Bisherige Schritte */}
      {approval.recent_steps && approval.recent_steps.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wrench className="h-3 w-3" />
            Bisherige Schritte
          </h4>
          <div className="space-y-1">
            {approval.recent_steps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px]"
              >
                {step.step_type === "llm_call" ? (
                  <Brain className="h-3 w-3 shrink-0 text-blue-400" />
                ) : (
                  <Wrench className="h-3 w-3 shrink-0 text-amber-400" />
                )}
                <span className="flex-1 truncate text-foreground">
                  {step.description ?? `Schritt ${step.step_number}`}
                </span>
                {step.duration_ms != null && (
                  <span className="shrink-0 text-muted-foreground">
                    {step.duration_ms < 1000
                      ? `${step.duration_ms}ms`
                      : `${(step.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gedankenprotokoll */}
      {recentThoughts.length > 0 && (
        <div>
          <button
            onClick={() => setThoughtsExpanded(!thoughtsExpanded)}
            className="mb-2 flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Brain className="h-3 w-3" />
            Gedankenprotokoll ({thoughts.length} Einträge)
            {thoughtsExpanded ? (
              <ChevronUp className="ml-auto h-3 w-3" />
            ) : (
              <ChevronDown className="ml-auto h-3 w-3" />
            )}
          </button>
          {thoughtsExpanded && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2.5">
              <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                {(hasMoreThoughts && !thoughtsExpanded ? recentThoughts : thoughts.slice(-30)).map((t, i) => (
                  <p
                    key={i}
                    className={`leading-relaxed ${
                      t.text.startsWith("🔧")
                        ? "text-amber-400/80"
                        : t.text.startsWith("🤖")
                          ? "text-blue-400/80"
                          : ""
                    }`}
                  >
                    {t.text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent-Output */}
      {approval.task_output_content && (
        <div>
          <button
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="mb-2 flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-3 w-3" />
            Agent-Ergebnis (Vorschau)
            {outputExpanded ? (
              <ChevronUp className="ml-auto h-3 w-3" />
            ) : (
              <ChevronDown className="ml-auto h-3 w-3" />
            )}
          </button>
          {outputExpanded && (
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background p-3">
              <div className="prose prose-invert prose-sm max-w-none text-xs">
                <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {approval.task_output_content}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kommentar */}
      {showComment && (
        <Textarea
          placeholder="Dein Feedback oder Änderungswünsche..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="text-sm"
          rows={3}
          autoFocus
        />
      )}

      {/* Aktionen */}
      <div className="flex flex-wrap gap-2 border-t border-yellow-500/10 pt-3">
        <Button
          size="sm"
          className="gap-1.5 bg-green-600 hover:bg-green-700"
          onClick={() => onResolve(approval.id, "approved", comment || undefined)}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Genehmigen
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={() => onResolve(approval.id, "rejected", comment || undefined)}
        >
          <XCircle className="h-3.5 w-3.5" />
          Ablehnen
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            if (showComment && comment.trim()) {
              onResolve(approval.id, "changes_requested", comment);
            } else {
              setShowComment(true);
            }
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Änderungen anfordern
        </Button>
      </div>
    </div>
  );
}
