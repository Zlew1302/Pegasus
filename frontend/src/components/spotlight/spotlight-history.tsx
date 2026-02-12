"use client";

import { X, Bot, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import type { SpotlightMessage } from "@/types";

interface SpotlightHistoryProps {
  messages: SpotlightMessage[];
  open: boolean;
  onClose: () => void;
}

export function SpotlightHistory({
  messages,
  open,
  onClose,
}: SpotlightHistoryProps) {
  if (!open) return null;

  return (
    <div className="spotlight-history-panel absolute inset-0 z-20 flex flex-col overflow-hidden rounded-xl bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Verlauf</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            {messages.length} Nachrichten
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bot className="h-8 w-8 opacity-30" />
            <p className="text-xs">Noch keine Nachrichten in dieser Session</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {messages.map((message) => (
              <div
                key={message.id}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/20"
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    message.role === "user"
                      ? "bg-secondary"
                      : "bg-[hsl(var(--accent-orange))]/20"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="h-2.5 w-2.5 text-muted-foreground" />
                  ) : (
                    <Bot className="h-2.5 w-2.5 text-[hsl(var(--accent-orange))]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-xs text-foreground/80">
                    {message.content || "..."}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {formatDistanceToNow(message.timestamp, {
                      locale: de,
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
