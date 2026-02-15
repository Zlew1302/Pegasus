"use client";

import { useState } from "react";
import { ScrollText, Bot, User, Cog } from "lucide-react";
import { useAuditTrail } from "@/hooks/use-profile";

const ACTOR_ICONS: Record<string, typeof Bot> = {
  agent: Bot,
  human: User,
  system: Cog,
};

export function AuditTrail() {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const { entries, isLoading } = useAuditTrail(limit, offset);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Audit Trail</h3>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Wird geladen...
          </p>
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Keine Einträge vorhanden
          </p>
        ) : (
          entries.map((entry, idx) => {
            const Icon = ACTOR_ICONS[entry.actor_type] ?? Cog;
            return (
              <div
                key={`${entry.timestamp}-${idx}`}
                className="flex gap-3 rounded-md bg-secondary/20 px-3 py-2"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      {entry.target_title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString("de-DE")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.action}
                  </p>
                  {entry.tokens && (
                    <span className="text-xs text-muted-foreground">
                      {entry.tokens.toLocaleString()} Tokens
                      {entry.cost_cents
                        ? ` | ${(entry.cost_cents / 100).toFixed(2)} €`
                        : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {entries.length === limit && (
        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Zurück
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}
