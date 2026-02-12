"use client";

import { Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAgentTypes } from "@/hooks/use-agents";

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
  const { agentTypes, isLoading } = useAgentTypes();

  return (
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
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Modell: {agent.model}
                </p>
              </div>
            </button>
          ))}
          {!isLoading && agentTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Keine Agent-Typen verfügbar.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
