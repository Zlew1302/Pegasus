"use client";

import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentSuggestions } from "@/hooks/use-agents";

interface AgentSuggestionProps {
  taskId: string;
  onSpawn: (agentTypeId: string) => void;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 70) return "text-green-400 border-green-500/30 bg-green-500/10";
  if (confidence >= 40) return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
  return "text-muted-foreground border-border bg-muted/50";
}

export function AgentSuggestionCards({ taskId, onSpawn }: AgentSuggestionProps) {
  const { suggestions, isLoading } = useAgentSuggestions(taskId);

  if (isLoading || suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Empfohlene Agents</span>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <div
            key={s.agent_type_id}
            className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
          >
            <Bot className="h-4 w-4 text-[var(--agent-glow-color)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{s.agent_type_name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {s.reason}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-[10px] ${confidenceColor(s.confidence)}`}
            >
              {s.confidence}%
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-7 text-xs"
              onClick={() => onSpawn(s.agent_type_id)}
            >
              Zuweisen
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
