"use client";

import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAgentTypes } from "@/hooks/use-agents";
import { AgentCreateDialog } from "./agent-create-dialog";

interface AgentSpawnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSpawn: (agentTypeId: string) => void;
}

export function AgentSpawnDialog({
  open,
  onOpenChange,
  onSpawn,
}: AgentSpawnDialogProps) {
  const { agentTypes, isLoading, mutate } = useAgentTypes();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agent zuweisen</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Lade Agenten...</p>
            )}
            {agentTypes.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSpawn(agent.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-[var(--agent-glow-color)]/50 hover:bg-accent/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--agent-glow-color)]/10">
                  <Bot className="h-4 w-4 text-[var(--agent-glow-color)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{agent.name}</p>
                  {agent.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {agent.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Modell: {agent.model.split("-").slice(0, 2).join(" ")}</span>
                    {agent.is_custom && (
                      <span className="rounded bg-[var(--agent-glow-color)]/10 px-1.5 py-0.5 text-[var(--agent-glow-color)]">
                        Benutzerdefiniert
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {!isLoading && agentTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Keine Agent-Typen verfuegbar.
              </p>
            )}

            {/* Create new agent type */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:border-[var(--agent-glow-color)]/50 hover:bg-accent/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Neuen Agenten erstellen</p>
                <p className="text-[10px] text-muted-foreground/60">
                  Eigene Konfiguration, Tools & Autonomie festlegen
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AgentCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          mutate();
          setShowCreate(false);
        }}
      />
    </>
  );
}
