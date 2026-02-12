"use client";

import { Bot } from "lucide-react";
import type { Block } from "@/types";

interface AgentBlockProps {
  block: Block;
}

export function AgentBlock({ block }: AgentBlockProps) {
  const meta = parseMeta(block.meta_json);

  return (
    <div className="rounded-lg border border-[hsl(var(--accent-orange))]/30 bg-[hsl(var(--accent-orange))]/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
        <span className="text-xs font-medium text-[hsl(var(--accent-orange))]">
          Agent-Block
        </span>
        {meta.agent_type_id ? (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {String(meta.agent_type_id)}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {block.content || "Agent-Prompt eingeben..."}
      </p>
      {meta.task_id ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Task: {String(meta.task_id)}
        </p>
      ) : null}
    </div>
  );
}

function parseMeta(metaJson: string | null): Record<string, unknown> {
  if (!metaJson) return {};
  try {
    return JSON.parse(metaJson);
  } catch {
    return {};
  }
}
