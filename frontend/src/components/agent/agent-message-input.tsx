"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMessageToAgent } from "@/hooks/use-agents";

interface AgentMessageInputProps {
  instanceId: string;
}

export function AgentMessageInput({ instanceId }: AgentMessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;

    setSending(true);
    try {
      await sendMessageToAgent(instanceId, text);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Nachricht an Agent..."
        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--agent-glow-color)]"
        disabled={sending}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={handleSend}
        disabled={sending || !message.trim()}
      >
        <Send className="h-3 w-3" />
      </Button>
    </div>
  );
}
