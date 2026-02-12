"use client";

import { Bot } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { AgentType } from "@/types";

interface AgentShortcutsProps {
  embedded?: boolean;
}

export function AgentShortcuts({ embedded = false }: AgentShortcutsProps) {
  const { data: agentTypes } = useSWR<AgentType[]>(
    "/agents/types",
    fetcher
  );

  const content = (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {!agentTypes || agentTypes.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Keine Agent-Typen verfügbar
        </p>
      ) : (
        agentTypes.map((at) => (
          <button
            key={at.id}
            className="flex w-full items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
          >
            <Bot className="h-4 w-4 text-[var(--agent-glow-color)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{at.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {at.description}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );

  if (embedded) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Agent-Schnellstart</h3>
      {content}
    </div>
  );
}
