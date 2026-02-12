"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, Trash2, X } from "lucide-react";
import { useSpotlight } from "@/hooks/use-spotlight";
import { usePageContext } from "@/hooks/use-page-context";
import { SpotlightMessageBubble } from "./spotlight-message";
import { SpotlightSuggestions } from "./spotlight-suggestions";
import { SpotlightHistory } from "./spotlight-history";

export function SpotlightOverlay() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pageContext = usePageContext();

  const handleNavigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const { messages, isStreaming, sendMessage, clearHistory, cancelStream } =
    useSpotlight({
      context: pageContext,
      onNavigate: handleNavigate,
    });

  // Global Cmd+K listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setShowHistory(false);
    } else {
      cancelStream();
    }
  }, [open, cancelStream]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleSuggestionSelect = (query: string) => {
    // If suggestion ends with a space, put it in the input for user to complete
    if (query.endsWith(" ")) {
      setInput(query);
      inputRef.current?.focus();
    } else {
      sendMessage(query);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  if (!open) return null;

  const hasMessages = messages.length > 0;

  return (
    <div className="spotlight-backdrop fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Spotlight Panel */}
      <div className="spotlight-panel relative w-full max-w-[620px] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        {/* Input Area */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center border-b border-border px-4">
            <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Frag mich etwas oder gib einen Befehl ein..."
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              disabled={isStreaming}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (isStreaming) {
                    cancelStream();
                  } else {
                    handleClose();
                  }
                }
              }}
            />

            {/* Right-side buttons */}
            <div className="flex items-center gap-1">
              {hasMessages && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="Verlauf"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="Verlauf löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <kbd className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">
                  ESC
                </kbd>
              </button>
            </div>
          </div>
        </form>

        {/* Content Area */}
        <div className="relative max-h-[50vh] overflow-y-auto">
          {!hasMessages ? (
            <SpotlightSuggestions onSelect={handleSuggestionSelect} />
          ) : (
            <div className="py-2">
              {messages.map((msg, idx) => (
                <SpotlightMessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming &&
                    idx === messages.length - 1 &&
                    msg.role === "assistant"
                  }
                  onNavigate={handleNavigate}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* History Panel (overlays the content) */}
          <SpotlightHistory
            messages={messages}
            open={showHistory}
            onClose={() => setShowHistory(false)}
          />
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-1.5">
          <span className="text-[10px] text-muted-foreground/50">
            CrewBoard AI
          </span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <span>
              <kbd className="rounded bg-secondary/60 px-1 py-0.5 font-mono">
                ↵
              </kbd>{" "}
              senden
            </span>
            <span>
              <kbd className="rounded bg-secondary/60 px-1 py-0.5 font-mono">
                ⌘K
              </kbd>{" "}
              toggle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
