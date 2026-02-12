"use client";

import { useState, useCallback, useRef } from "react";
import type {
  SpotlightMessage,
  SpotlightAction,
  SpotlightToolCall,
  SpotlightContext,
} from "@/types";

interface UseSpotlightOptions {
  context: SpotlightContext;
  onNavigate?: (path: string) => void;
}

interface UseSpotlightReturn {
  messages: SpotlightMessage[];
  isStreaming: boolean;
  sendMessage: (text: string) => void;
  clearHistory: () => void;
  cancelStream: () => void;
}

/**
 * Hook for the Spotlight AI chat.
 * Sends POST to /api/spotlight/chat, reads SSE stream via ReadableStream.
 */
export function useSpotlight({
  context,
  onNavigate,
}: UseSpotlightOptions): UseSpotlightReturn {
  const [messages, setMessages] = useState<SpotlightMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Cancel any in-flight request
      abortRef.current?.abort();

      const userMessage: SpotlightMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const assistantMessage: SpotlightMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        toolCalls: [],
        actions: [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      // Build history for API (max 20 messages, exclude current)
      const history = messages.slice(-18).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/spotlight/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            context,
            history,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              eventData = line.slice(5).trim();
            } else if (line === "" && eventType && eventData) {
              // Complete event — process it
              processEvent(eventType, eventData, assistantMessage.id);
              eventType = "";
              eventData = "";
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled — that's fine
        } else {
          const errorMsg =
            err instanceof Error ? err.message : "Unbekannter Fehler";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content || `❌ Fehler: ${errorMsg}` }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, isStreaming, messages],
  );

  function processEvent(
    eventType: string,
    dataStr: string,
    assistantId: string,
  ) {
    try {
      const data = JSON.parse(dataStr);

      switch (eventType) {
        case "token":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + (data.text || "") }
                : m,
            ),
          );
          break;

        case "tool_call":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolCalls: [
                      ...(m.toolCalls || []),
                      { name: data.tool_name, status: "running" as const },
                    ],
                  }
                : m,
            ),
          );
          break;

        case "action": {
          const action: SpotlightAction = {
            type: data.type,
            label: data.label || "",
            path: data.path,
            entityId: data.entityId,
          };

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, actions: [...(m.actions || []), action] }
                : m,
            ),
          );

          // Auto-navigate after a short delay
          if (data.type === "navigate" && data.path && onNavigate) {
            setTimeout(() => onNavigate(data.path), 600);
          }
          break;
        }

        case "done":
          // Mark all tool calls as done
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: data.content || m.content,
                    toolCalls: m.toolCalls?.map((tc) => ({
                      ...tc,
                      status: "done" as const,
                    })),
                  }
                : m,
            ),
          );
          break;

        case "error":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content || `❌ ${data.message || "Unbekannter Fehler"}`,
                  }
                : m,
            ),
          );
          break;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearHistory,
    cancelStream,
  };
}
