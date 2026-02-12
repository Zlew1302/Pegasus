"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  User,
  Wrench,
  ExternalLink,
  Check,
  Rocket,
  Pencil,
} from "lucide-react";
import type { SpotlightMessage, SpotlightAction } from "@/types";

interface SpotlightMessageProps {
  message: SpotlightMessage;
  isStreaming?: boolean;
  onNavigate?: (path: string) => void;
}

function ActionBadge({
  action,
  onNavigate,
}: {
  action: SpotlightAction;
  onNavigate?: (path: string) => void;
}) {
  const config = {
    navigate: {
      icon: ExternalLink,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    created: {
      icon: Check,
      color: "text-green-400 bg-green-500/10 border-green-500/20",
    },
    updated: {
      icon: Pencil,
      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    },
    spawned: {
      icon: Rocket,
      color: "text-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange))]/10 border-[hsl(var(--accent-orange))]/20",
    },
  };

  const { icon: Icon, color } = config[action.type] || config.navigate;

  return (
    <button
      onClick={() => {
        if (action.type === "navigate" && action.path && onNavigate) {
          onNavigate(action.path);
        }
      }}
      className={`mt-1.5 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-110 ${color} ${
        action.type === "navigate" ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <Icon className="h-3 w-3" />
      {action.label}
    </button>
  );
}

export function SpotlightMessageBubble({
  message,
  isStreaming,
  onNavigate,
}: SpotlightMessageProps) {
  const isUser = message.role === "user";

  const toolCalls = message.toolCalls || [];
  const actions = message.actions || [];

  // Memoize markdown rendering
  const markdownContent = useMemo(() => {
    if (isUser || !message.content) return null;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Compact styling for spotlight
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-1.5 ml-4 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-1.5 ml-4 list-decimal space-y-0.5">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-xs">{children}</li>,
          h2: ({ children }) => (
            <h2 className="mb-1 mt-2 text-sm font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-1.5 text-xs font-semibold first:mt-0">
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">
              {children}
            </code>
          ),
        }}
      >
        {message.content}
      </ReactMarkdown>
    );
  }, [message.content, isUser]);

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="flex max-w-[85%] items-start gap-2">
          <div className="rounded-lg bg-[hsl(var(--accent-orange))]/15 px-3 py-2 text-xs text-foreground">
            {message.content}
          </div>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start px-4 py-1.5">
      <div className="flex max-w-[90%] items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent-orange))]/20">
          <Bot className="h-3 w-3 text-[hsl(var(--accent-orange))]" />
        </div>
        <div className="min-w-0 flex-1">
          {/* Tool call badges */}
          {toolCalls.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {toolCalls.map((tc, i) => (
                <span
                  key={i}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tc.status === "running"
                      ? "animate-pulse bg-amber-500/10 text-amber-400"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Wrench className="h-2.5 w-2.5" />
                  {tc.name}
                </span>
              ))}
            </div>
          )}

          {/* Message content */}
          {message.content ? (
            <div className="text-xs leading-relaxed text-foreground/90">
              {markdownContent}
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--accent-orange))]" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--accent-orange))]" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[hsl(var(--accent-orange))]" style={{ animationDelay: "300ms" }} />
            </div>
          ) : null}

          {/* Action badges */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {actions.map((action, i) => (
                <ActionBadge
                  key={i}
                  action={action}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
